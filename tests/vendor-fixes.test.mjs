import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {ownedProductImagePath} from '../src/lib/vendor/images.ts'
import {vendorPageTitle} from '../src/lib/vendor/navigation.ts'
import {localRedirectUrl} from '../src/lib/buyer/validation.ts'

const db=new PGlite()
const buyer='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const owner='33333333-3333-4333-8333-333333333333'
const admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const store='44444444-4444-4444-8444-444444444444'
const productA='55555555-5555-4555-8555-555555555555'
const productB='66666666-6666-4666-8666-666666666666'
const project='https://project.supabase.co'
const photo=`${project}/storage/v1/object/public/product-images/${store}/shared.jpg`
async function asUser(id,fn){await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await fn()}finally{await db.exec('reset role')}}

before(async()=>{
  await db.exec(`
    create role anon;create role authenticated;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create table public.users(id uuid primary key,role text,full_name text);
    create table public.sellers(id uuid primary key,user_id uuid);
    create table public.products(id uuid primary key,seller_id uuid references public.sellers(id),images text[]);
    create table public.order_items(id uuid primary key default gen_random_uuid(),product_id uuid references public.products(id) on delete restrict);
    create schema storage;grant usage on schema storage to authenticated;
    create table storage.objects(bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,delete on storage.objects to authenticated;
    insert into auth.users values('${buyer}'),('${other}'),('${owner}'),('${admin}');
    insert into public.users values('${buyer}','buyer','Buyer'),('${other}','buyer','Other buyer'),('${owner}','vendor','Vendor'),('${admin}','admin','Admin');
    insert into public.sellers values('${store}','${owner}');
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202610310002_vendor_enrollment_and_image_cleanup.sql',import.meta.url),'utf8'))
})
after(()=>db.close())

test('enrollment upgrades only the caller and never assigns an administrative role',async()=>{
  await asUser(buyer,()=>db.exec('select public.cm_enroll_vendor()'))
  await asUser(buyer,()=>db.exec('select public.cm_enroll_vendor()'))
  const rows=(await db.query('select id,role from public.users order by id')).rows
  assert.equal(rows.find((r)=>r.id===buyer).role,'vendor')
  assert.equal(rows.find((r)=>r.id===other).role,'buyer')
  await asUser(admin,()=>assert.rejects(db.exec('select public.cm_enroll_vendor()'),/cannot enroll/))
  await db.exec('set role anon')
  try{await assert.rejects(db.exec('select public.cm_enroll_vendor()'),/permission denied/)}finally{await db.exec('reset role')}
})

test('deleting one duplicate retains the shared photo; deleting the last copy queues it',async()=>{
  await db.query('insert into public.products(id,seller_id,images) values($1,$2,$3),($4,$2,$3)',[productA,store,[photo],productB])
  await db.query('insert into storage.objects values($1,$2)',['product-images',`${store}/shared.jpg`])
  await asUser(other,()=>assert.rejects(db.query('select public.cm_delete_listing($1)',[productA]),/not available/))
  await asUser(owner,async()=>{
    await db.query('select public.cm_delete_listing($1)',[productA])
    assert.equal((await db.query('select * from public.cm_claim_listing_image_cleanup()')).rows.length,0)
    assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0)
    await db.query('select public.cm_delete_listing($1)',[productB])
  })
  assert.equal((await db.query('select * from public.listing_image_cleanup')).rows.length,1)
  await asUser(other,async()=>assert.equal((await db.query('select * from public.cm_claim_listing_image_cleanup()')).rows.length,0))
})

test('cleanup claims block stale duplicates; failed storage cleanup is retryable',async()=>{
  const claim=await asUser(owner,async()=>(await db.query('select * from public.cm_claim_listing_image_cleanup()')).rows[0])
  assert.ok(claim)
  await asUser(other,async()=>assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0))
  assert.equal((await db.query('select public.cm_can_remove_listing_image($1,$2) as allowed',['kyc-documents',`${store}/shared.jpg`])).rows[0].allowed,false)
  await assert.rejects(db.query('insert into public.products values($1,$2,$3)',[productA,store,[photo]]),/photo is being removed/)
  await asUser(other,()=>assert.rejects(db.query('select public.cm_finish_listing_image_cleanup($1,$2,$3)',[claim.id,claim.lease_token,'deleted']),/not available/))
  await asUser(owner,()=>db.query('select public.cm_finish_listing_image_cleanup($1,$2,$3)',[claim.id,claim.lease_token,'pending']))
  // Once the last reference is removed, a stale browser tab must upload again.
  // A failed API response is ambiguous: the file might already have been deleted.
  await assert.rejects(db.query('insert into public.products values($1,$2,$3)',[productA,store,[photo]]),/photo is being removed/)
  const retried=await asUser(owner,async()=>(await db.query('select * from public.cm_claim_listing_image_cleanup()')).rows[0])
  assert.notEqual(retried.lease_token,claim.lease_token)
  await asUser(owner,async()=>assert.equal((await db.query('delete from storage.objects returning name')).rows.length,1))
  await asUser(owner,()=>db.query('select public.cm_finish_listing_image_cleanup($1,$2,$3)',[retried.id,retried.lease_token,'deleted']))
  await assert.rejects(db.query('insert into public.products values($1,$2,$3)',[productB,store,[photo]]),/no longer available/)
})

test('edit removals are queued and failed product deletes do not create cleanup work',async()=>{
  const second=photo.replace('shared.jpg','edit.jpg')
  await db.query('insert into public.products values($1,$2,$3)',[productA,store,[second]])
  await db.query('insert into public.order_items(product_id) values($1)',[productA])
  await asUser(owner,()=>assert.rejects(db.query('select public.cm_delete_listing($1)',[productA]),/foreign key/))
  assert.equal((await db.query('select * from public.listing_image_cleanup where image_url=$1',[second])).rows.length,0)
  await db.query('update public.products set images=$1 where id=$2',[[],productA])
  assert.equal((await db.query('select * from public.listing_image_cleanup where image_url=$1',[second])).rows.length,1)
})

test('storage cleanup only accepts the same project, bucket and vendor folder',()=>{
  assert.equal(ownedProductImagePath(photo,project,store),`${store}/shared.jpg`)
  for(const value of [photo.replace(project,'https://evil.example'),photo.replace(store,buyer),photo.replace('/product-images/','/kyc-documents/'),photo+'?token=unexpected',`${project}/storage/v1/object/public/product-images/${store}/%2e%2e%2fsecret`,photo.replace('shared.jpg','%invalid')])assert.equal(ownedProductImagePath(value,project,store),null)
})

test('internal redirects preserve query filters and fragments without changing origin',()=>{
  const url=localRedirectUrl('https://campusmart.test/login','/products?category=books&q=math%20notes#results')
  assert.equal(url.pathname,'/products');assert.equal(url.searchParams.get('q'),'math notes');assert.equal(url.hash,'#results')
  assert.equal(localRedirectUrl('https://campusmart.test','//evil.example').origin,'https://campusmart.test')
  assert.equal(localRedirectUrl('https://campusmart.test','/login').pathname,'/login')
})

test('vendor headings match overview, listings, editing, orders and settings',()=>{
  for(const [path,title]of [['/vendor/dashboard','Overview'],['/vendor/orders','Orders'],['/vendor/earnings','Earnings'],['/vendor/settings','Store settings'],['/vendor/listings/new','New listing'],[`/vendor/listings/${productA}/edit`,'Edit listing'],[`/vendor/orders/${productA}/slip`,'Packing slip']])assert.equal(vendorPageTitle(path),title)
})
