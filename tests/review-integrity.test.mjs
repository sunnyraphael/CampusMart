import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const db=new PGlite()
const vendor='11111111-1111-4111-8111-111111111111'
const buyer='22222222-2222-4222-8222-222222222222'
const otherBuyer='33333333-3333-4333-8333-333333333333'
const existing='44444444-4444-4444-8444-444444444444'
const unreviewed='55555555-5555-4555-8555-555555555555'
const newListing='66666666-6666-4666-8666-666666666666'
const rpcListing='77777777-7777-4777-8777-777777777777'
let originalReviews

async function asUser(id,work) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`)
  try {return await work()} finally {await db.exec('reset role')}
}
async function totals(product) {
  const row=(await db.query('select avg_rating,total_reviews from public.products where id=$1',[product])).rows[0]
  return {average:row.avg_rating===null?null:Number(row.avg_rating),count:row.total_reviews}
}
async function reviews() {return (await db.query('select id,user_id,product_id,rating,comment from public.reviews order by id')).rows}

before(async()=>{
  await db.exec(`
    create role anon;create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create table public.products(id uuid primary key,vendor_id uuid not null,title text,avg_rating numeric,total_reviews integer);
    create table public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null,product_id uuid not null references public.products(id),rating integer not null,comment text,unique(user_id,product_id));
    alter table public.products enable row level security;
    alter table public.reviews enable row level security;
    create policy own_products on public.products for all to authenticated using(vendor_id=auth.uid()) with check(vendor_id=auth.uid());
    grant select,insert,update on public.products to authenticated;
    revoke all on public.reviews from anon,authenticated;
    insert into public.products values('${existing}','${vendor}','Reviewed listing',5,900),('${unreviewed}','${vendor}','No reviews',4.99,700);
    insert into public.reviews(user_id,product_id,rating,comment) values('${buyer}','${existing}',5,'Positive experience'),('${otherBuyer}','${existing}',1,'Item condition was disappointing');
    create table public.sellers(id uuid primary key,user_id uuid);
    insert into public.sellers values('${vendor}','${vendor}');
    alter table public.products add column seller_id uuid not null default '${vendor}';
  `)
  originalReviews=await reviews()
  await db.exec(await readFile(new URL('../supabase/migrations/202611010003_review_integrity.sql',import.meta.url),'utf8'))
  // Model the existing RPC's trusted write sequence. Paid/received eligibility
  // is exercised against the actual RPC in buyer-database.test.mjs.
  await db.exec(`
    create function public.fixture_review_product(p_product uuid,p_rating integer,p_comment text) returns void
    language plpgsql security definer set search_path='' as $$
    begin
      perform 1 from public.products where id=p_product for update;
      insert into public.reviews(user_id,product_id,rating,comment) values(auth.uid(),p_product,p_rating,p_comment)
      on conflict(user_id,product_id) do update set rating=excluded.rating,comment=excluded.comment;
      update public.products set avg_rating=(select avg(rating) from public.reviews where product_id=p_product),total_reviews=(select count(*) from public.reviews where product_id=p_product) where id=p_product;
    end;$$;
    revoke all on function public.fixture_review_product(uuid,integer,text) from public,anon;
    grant execute on function public.fixture_review_product(uuid,integer,text) to authenticated;
  `)
})
after(()=>db.close())

test('migration reconciles existing summaries from actual rows without editing reviews',async()=>{
  assert.deepEqual(await totals(existing),{average:3,count:2})
  assert.deepEqual(await totals(unreviewed),{average:null,count:0})
  assert.deepEqual(await reviews(),originalReviews)
})

test('a vendor cannot create a product with invented five-star scores or review counts',async()=>{
  await asUser(vendor,()=>db.query('insert into public.products(id,vendor_id,title,avg_rating,total_reviews) values($1,$2,$3,5,12000)',[newListing,vendor,'New listing']))
  assert.deepEqual(await totals(newListing),{average:null,count:0})
  assert.deepEqual(await reviews(),originalReviews)
})

test('vendor updates cannot replace genuine aggregates even without permission to read reviews',async()=>{
  await asUser(vendor,async()=>{
    await assert.rejects(db.query('select * from public.reviews'),/permission denied/)
    await db.query('update public.products set avg_rating=5,total_reviews=9999 where id=$1',[existing])
    await db.query('update public.products set avg_rating=5 where id=$1',[unreviewed])
    await db.query('update public.products set total_reviews=500 where id=$1',[newListing])
  })
  assert.deepEqual(await totals(existing),{average:3,count:2})
  assert.deepEqual(await totals(unreviewed),{average:null,count:0})
  assert.deepEqual(await totals(newListing),{average:null,count:0})
  assert.deepEqual(await reviews(),originalReviews)
})

test('RPC-style review writes count real positive and negative feedback, and edits preserve the row',async()=>{
  await asUser(vendor,()=>db.query('insert into public.products(id,vendor_id,title) values($1,$2,$3)',[rpcListing,vendor,'Purchased listing']))
  await asUser(buyer,()=>db.query('select public.fixture_review_product($1,$2,$3)',[rpcListing,5,'Worked well']))
  assert.deepEqual(await totals(rpcListing),{average:5,count:1})
  await asUser(otherBuyer,()=>db.query('select public.fixture_review_product($1,$2,$3)',[rpcListing,1,'Not as described']))
  assert.deepEqual(await totals(rpcListing),{average:3,count:2})
  const beforeEdit=await reviews()
  await asUser(buyer,()=>db.query('select public.fixture_review_product($1,$2,$3)',[rpcListing,2,'Updated after using the item']))
  assert.deepEqual(await totals(rpcListing),{average:1.5,count:2})
  const afterEdit=await reviews()
  assert.deepEqual(afterEdit.map(row=>row.id),beforeEdit.map(row=>row.id))
  assert.deepEqual(afterEdit.filter(row=>row.product_id!==rpcListing),originalReviews)
  assert.equal(afterEdit.find(row=>row.product_id===rpcListing&&row.user_id===otherBuyer).rating,1)
})

test('aggregate trigger is not an authenticated or anonymous callable API',async()=>{
  for(const role of ['anon','authenticated']){
    const result=await db.query('select has_function_privilege($1,$2,$3) allowed',[role,'public.cm_derive_product_review_totals()','EXECUTE'])
    assert.equal(result.rows[0].allowed,false)
  }
  await asUser(vendor,()=>assert.rejects(db.query('select public.cm_derive_product_review_totals()'),/permission denied/))
})

test('a vendor cannot submit a self-review even through the trusted review write path',async()=>{
  const previous=await reviews()
  await asUser(vendor,()=>assert.rejects(db.query('select public.fixture_review_product($1,$2,$3)',[rpcListing,5,'My own product']),/cannot review their own listings/))
  assert.deepEqual(await reviews(),previous)
})

test('authorized review removal immediately repairs the count and average',async()=>{
  await db.query('delete from public.reviews where product_id=$1 and user_id=$2',[rpcListing,otherBuyer])
  assert.deepEqual(await totals(rpcListing),{average:2,count:1})
  await db.query('delete from public.reviews where product_id=$1',[rpcListing])
  assert.deepEqual(await totals(rpcListing),{average:null,count:0})
})
