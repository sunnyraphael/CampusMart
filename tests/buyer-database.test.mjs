import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db=new PGlite()
const buyer='11111111-1111-4111-8111-111111111111'
const stranger='22222222-2222-4222-8222-222222222222'
const vendor='33333333-3333-4333-8333-333333333333'
const store='44444444-4444-4444-8444-444444444444'
const product='55555555-5555-4555-8555-555555555555'
const order='66666666-6666-4666-8666-666666666666'
let chat

async function asUser(id,fn) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}'`)
  try {return await fn()} finally {await db.exec('reset role')}
}

before(async()=>{
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    create table public.users(id uuid primary key,full_name text,phone text,role text);
    create table public.sellers(id uuid primary key,user_id uuid,store_name text);
    create table public.products(id uuid primary key,seller_id uuid,status text,avg_rating numeric,total_reviews integer);
    create table public.orders(id uuid primary key,user_id uuid,payment_status text);
    create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,product_id uuid,fulfillment_status text);
    create table public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid,product_id uuid,rating integer,comment text);
    create table public.wishlist(id uuid primary key default gen_random_uuid(),user_id uuid,product_id uuid);
    create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,message text,is_read boolean default false);
    grant insert(user_id,product_id,rating),update(rating,comment) on public.reviews to authenticated;
    create function public.is_admin() returns boolean language sql stable as $$ select false $$;
    insert into auth.users values('${buyer}'),('${stranger}'),('${vendor}');
    insert into public.users values('${buyer}','Buyer',null,'buyer'),('${stranger}','Other buyer',null,'buyer'),('${vendor}','Vendor',null,'vendor');
    insert into public.sellers values('${store}','${vendor}','Campus Store');
    insert into public.products(id,seller_id,status) values('${product}','${store}','active');
    insert into public.orders values('${order}','${buyer}','paid');
    insert into public.order_items(order_id,product_id,fulfillment_status) values('${order}','${product}','received');
    insert into public.notifications(user_id,message) values('${buyer}','Your item shipped'),('${stranger}','Private update');
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202610310001_buyer_features.sql',import.meta.url),'utf8'))
})
after(()=>db.close())

test('chat is created only for another vendor; outsiders cannot read or send',async()=>{
  chat=await asUser(buyer,async()=>{
    const r=await db.query('select public.cm_start_conversation($1,$2) as id',[store,product]);return r.rows[0].id
  })
  await asUser(vendor,()=>assert.rejects(db.query('select public.cm_start_conversation($1,$2)',[store,product]),/own store/))
  await asUser(stranger,async()=>{
    assert.equal((await db.query('select * from public.buyer_conversations')).rows.length,0)
    await assert.rejects(db.query('select public.cm_send_message($1,$2)',[chat,'Private intrusion']),/not available/)
  })
})

test('buyer and vendor can exchange messages; read markers cannot clear future messages',async()=>{
  await asUser(buyer,()=>db.query('select public.cm_send_message($1,$2)',[chat,'Is this available?']))
  await asUser(vendor,async()=>{
    assert.equal((await db.query('select * from public.buyer_messages')).rows.length,1)
    assert.equal(Number((await db.query('select * from public.cm_conversations()')).rows[0].unread_count),1)
    await db.query('select public.cm_read_conversation($1,$2)',[chat,'2099-01-01T00:00:00Z'])
    await db.query('select public.cm_send_message($1,$2)',[chat,'Yes, it is.'])
  })
  await asUser(buyer,async()=>{
    const r=await db.query('select * from public.cm_conversations()')
    assert.equal(Number(r.rows[0].unread_count),1)
    await assert.rejects(db.query('select public.cm_send_message($1,$2)',[chat,'   ']),/Write a message/)
    await assert.rejects(db.query('update public.buyer_messages set sender_id=$1',[stranger]),/permission denied/)
  })
  await asUser(stranger,async()=>assert.equal((await db.query('select * from public.buyer_messages')).rows.length,0))
})

test('favorite saves are idempotent and owner-only',async()=>{
  await asUser(buyer,async()=>{
    await db.query('select public.cm_set_favorite($1,true)',[product]);await db.query('select public.cm_set_favorite($1,true)',[product])
    assert.equal((await db.query('select * from public.wishlist')).rows.length,1)
  })
  await asUser(stranger,async()=>assert.equal((await db.query('select * from public.wishlist')).rows.length,0))
  await asUser(buyer,async()=>{
    await db.query('select public.cm_set_favorite($1,false)',[product]);assert.equal((await db.query('select * from public.wishlist')).rows.length,0)
  })
})

test('notification reads cannot change another user’s rows',async()=>{
  await asUser(buyer,async()=>{
    await db.exec('select public.cm_read_notifications()')
    const rows=(await db.query('select * from public.notifications')).rows
    assert.equal(rows.length,1);assert.equal(rows[0].is_read,true)
  })
  const rows=(await db.query('select * from public.notifications where user_id=$1',[stranger])).rows
  assert.equal(rows[0].is_read,false)
})

test('profile action cannot change a role or another user; invalid phones rejected',async()=>{
  await asUser(buyer,async()=>{
    await db.query('select public.cm_update_profile($1,$2)',['Updated buyer','08012345678'])
    await assert.rejects(db.query('select public.cm_update_profile($1,$2)',['Bad phone','xyz']),/phone number/)
    await assert.rejects(db.exec("update public.users set role='vendor'"),/permission denied/)
  })
  assert.equal((await db.query('select role from public.users where id=$1',[buyer])).rows[0].role,'buyer')
})

test('support validates order ownership and prevents requester status forgery',async()=>{
  await asUser(stranger,()=>assert.rejects(db.query('select public.cm_support_request($1,$2,$3)',['Order issue','This is not my order but I am trying to access it.',order]),/own orders/))
  await asUser(buyer,async()=>{
    await db.query('select public.cm_support_request($1,$2,$3)',['Order issue','My order has not arrived and I need an update.',order])
    await db.exec("update public.support_requests set status='resolved'")
    assert.equal((await db.query('select status from public.support_requests')).rows[0].status,'open')
  })
  await asUser(stranger,async()=>assert.equal((await db.query('select * from public.support_requests')).rows.length,0))
})

test('saved searches are private and cannot be inserted for a different account',async()=>{
  await asUser(buyer,()=>db.query('insert into public.saved_searches(user_id,name,query) values($1,$2,$3)',[buyer,'Books','book']))
  await asUser(stranger,async()=>{
    assert.equal((await db.query('select * from public.saved_searches')).rows.length,0)
    await assert.rejects(db.query('insert into public.saved_searches(user_id,name) values($1,$2)',[buyer,'Foreign search']),/row-level security/)
  })
})


test('reviews require a received paid purchase and aggregate updates stay accurate',async()=>{
  await asUser(stranger,()=>assert.rejects(db.query('select public.cm_review_product($1,$2,$3)',[product,5,'Unverified review']),/Only buyers/))
  await asUser(buyer,async()=>{
    await db.query('select public.cm_review_product($1,$2,$3)',[product,4,'Good item'])
    await db.query('select public.cm_review_product($1,$2,$3)',[product,5,'Updated review'])
    await assert.rejects(db.query('select public.cm_review_product($1,$2,$3)',[product,9,'Bad rating']),/rating/)
  })
  const row=(await db.query('select * from public.products where id=$1',[product])).rows[0]
  assert.equal(Number(row.avg_rating),5);assert.equal(row.total_reviews,1)
  await asUser(stranger,()=>assert.rejects(db.query('insert into public.reviews(user_id,product_id,rating) values($1,$2,$3)',[stranger,product,5]),/permission denied/))
})
