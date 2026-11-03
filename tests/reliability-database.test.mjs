import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',buyer='33333333-3333-4333-8333-333333333333',store='44444444-4444-4444-8444-444444444444',product='55555555-5555-4555-8555-555555555555',origin='https://project.test'
const rpc=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result
const as=async(id,fn)=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await fn()}finally{await db.exec('reset role;reset request.jwt.claim.sub')}}
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage to authenticated,service_role;grant execute on function auth.uid() to authenticated;
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    create table public.users(id uuid primary key,role text,full_name text,email text,phone text);
    create table public.sellers(id uuid primary key,user_id uuid,store_name text,logo_url text,wallet_balance numeric default 0);
    create table public.products(id uuid primary key,seller_id uuid references public.sellers(id),status text,images text[] default '{}',created_at timestamptz default now(),stock_quantity int default 10,availability text default 'on_campus',title text default 'Product');
    create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid,is_trial boolean default false,payment_environment text,payment_status text default 'paid',status text default 'pending',created_at timestamptz default now());
    create table public.order_items(id uuid primary key default gen_random_uuid(),seller_id uuid,order_id uuid,fulfillment_status text,released_at timestamptz,dispute_reason text,dispute_resolution text,product_id uuid,quantity int default 1,subtotal numeric default 1000,payout_amount numeric);
    create table public.order_deliveries(item_id uuid,held_at timestamptz);
    create table public.buyer_messages(id uuid primary key default gen_random_uuid(),sender_id uuid,body text,conversation_id uuid,created_at timestamptz default now());
    create table public.buyer_conversations(id uuid primary key default gen_random_uuid(),buyer_id uuid,vendor_id uuid,product_id uuid,updated_at timestamptz default now(),buyer_read_at timestamptz default 'epoch',vendor_read_at timestamptz default 'epoch');
    create table public.support_requests(id uuid default gen_random_uuid(),user_id uuid,body text);
    create table public.saved_searches(id uuid default gen_random_uuid(),user_id uuid);
    create table public.wishlist(user_id uuid,product_id uuid);
    create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,is_read boolean default false,created_at timestamptz default now());
    create table public.paystack_payments(mode text,state text,last_checked_at timestamptz);
    create table public.paystack_transfers(id uuid,seller_id uuid,state text);create table public.paystack_refunds(id uuid,order_id uuid,state text,updated_at timestamptz default now());
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}',created_at timestamptz default now());
    create table storage.buckets(id text primary key,file_size_limit bigint,allowed_mime_types text[]);insert into storage.buckets(id) values('product-images'),('kyc-documents');
    alter table storage.objects enable row level security;create policy upload_test on storage.objects for insert to authenticated with check(true);
    grant select,insert,update,delete on all tables in schema public to authenticated;grant select,insert,update on storage.objects to authenticated;
    insert into public.users values('${owner}','vendor','Owner','owner@test',null),('${admin}','admin','Admin','admin@test',null),('${buyer}','buyer','Buyer','buyer@test',null);
    insert into auth.users values('${owner}'),('${admin}'),('${buyer}');insert into public.sellers(id,user_id,store_name) values('${store}','${owner}','Test store');
    insert into public.products(id,seller_id,status) values('${product}','${store}','active');`)
  for(const name of ['202610310002_vendor_enrollment_and_image_cleanup.sql','202611010001_account_controls.sql','202611020001_store_management.sql','202611020002_reliability.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
})
after(()=>db.close())
test('health is public but operational data, maintenance and cleanup are privileged',async()=>{
  await db.exec('set role anon');try{assert.equal(await rpc('cm_health_ping'),true);await assert.rejects(rpc('cm_admin_operations'),/permission denied/)}finally{await db.exec('reset role')}
  await as(owner,()=>assert.rejects(rpc('cm_admin_operations'),/Administrator/))
  await as(owner,()=>assert.rejects(rpc('cm_queue_orphan_images',[origin]),/permission denied/))
  await as(owner,()=>assert.rejects(db.query('select * from operations_samples'),/permission denied/))
})
test('active originals protect their thumbnails; removing a photo queues both siblings',async()=>{
  const base=store+'/test',full=origin+'/storage/v1/object/public/product-images/'+base+'-full.webp',thumb=full.replace('-full.webp','-thumb.webp')
  await db.query('update products set images=$1 where id=$2',[[full],product])
  for(const suffix of ['-full.webp','-thumb.webp'])await db.query("insert into storage.objects(bucket_id,name,created_at) values('product-images',$1,now()-interval '3 days')",[base+suffix])
  assert.equal(await rpc('cm_image_referenced',[base+'-thumb.webp']),true)
  assert.equal(await rpc('cm_queue_orphan_images',[origin]),0)
  await db.query("update products set images='{}' where id=$1",[product])
  assert.deepEqual((await db.query('select image_url from listing_image_cleanup order by image_url')).rows.map(r=>r.image_url),[full,thumb])
  await as(owner,()=>assert.rejects(db.query('update products set images=$1 where id=$2',[[full],product]),/being removed/))
  const jobs=(await db.query('select * from public.cm_claim_operations_cleanup()')).rows;assert.equal(jobs.length,2)
  for(const job of jobs)await rpc('cm_finish_operations_cleanup',[job.id,job.lease_token,true])
})
test('cleanup ignores recent uploads and private verification files',async()=>{
  await db.query("insert into storage.objects(bucket_id,name,created_at) values('product-images',$1,now()-interval '3 days'),('product-images',$2,now()),('kyc-documents',$3,now()-interval '3 days')",[store+'/orphan.webp',store+'/fresh.webp',store+'/private.jpg'])
  assert.equal(await rpc('cm_queue_orphan_images',[origin]),1)
  const pending=(await db.query("select image_url from listing_image_cleanup where status='pending'")).rows
  assert.equal(pending.length,1);assert.ok(pending[0].image_url.endsWith('/orphan.webp'))
})
test('support spam is blocked in the database, independently per account',async()=>{
  for(let n=0;n<5;n++)await as(buyer,()=>db.query('insert into support_requests(user_id,body) values($1,$2)',[buyer,'Need help with my order.']))
  await as(buyer,()=>assert.rejects(db.query('insert into support_requests(user_id,body) values($1,$2)',[buyer,'Sixth request.']),/Too many/))
  await as(owner,()=>db.query('insert into support_requests(user_id,body) values($1,$2)',[owner,'Different account.']))
})
test('maintenance blocks new orders but keeps existing-order updates and health available',async()=>{
  const existing=(await db.query('insert into orders(user_id) values($1) returning id',[buyer])).rows[0].id
  await as(admin,()=>rpc('cm_admin_operations',[{maintenance:true}]))
  assert.equal(await rpc('cm_checkout_available'),false)
  await assert.rejects(db.query('insert into orders(user_id) values($1)',[buyer]),/temporarily unavailable/)
  await db.query("update orders set status='confirmed' where id=$1",[existing]);assert.equal(await rpc('cm_health_ping'),true)
  await as(admin,()=>rpc('cm_admin_operations',[{maintenance:false}]))
})
test('capacity alerts use real storage metadata and stop new uploads at 90 percent',async()=>{
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('kyc-documents',$1,'{\"size\":800000000}')",[store+'/legacy-large.jpg'])
  await rpc('cm_operations_sample');let data=await as(admin,()=>rpc('cm_admin_operations'))
  assert.equal(data.sample.storage_bytes,800000000);assert.equal(data.alerts.find(a=>a.metric==='storage').severity,'warning')
  assert.equal(await as(owner,()=>rpc('cm_upload_budget')),true)
  await db.query("update storage.objects set metadata='{\"size\":910000000}' where name=$1",[store+'/legacy-large.jpg'])
  await rpc('cm_operations_sample');data=await as(admin,()=>rpc('cm_admin_operations'));assert.equal(data.alerts.find(a=>a.metric==='storage').severity,'critical')
  assert.equal(await as(owner,()=>rpc('cm_upload_budget')),false)
  await as(owner,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[store+'/blocked.webp']),/row-level security/))
  await db.query("delete from storage.objects where name=$1",[store+'/legacy-large.jpg'])
})
test('vendor overview aggregates all real orders without leaking other stores or test revenue',async()=>{
  for(const mode of ['live','test']){const id=(await db.query('insert into orders(user_id,payment_environment) values($1,$2) returning id',[buyer,mode])).rows[0].id;await db.query("insert into order_items(seller_id,order_id,product_id,fulfillment_status,subtotal,quantity) values($1,$2,$3,'pending',1000,2)",[store,id,product])}
  const v=await as(owner,()=>rpc('cm_vendor_overview'));assert.equal(v.stats.totalSales,1000);assert.equal(v.stats.totalOrders,1);assert.equal(v.stats.unitsSold,2);assert.equal(v.chartData.length,7)
  const pending=await as(owner,()=>rpc('cm_vendor_pending_earnings'));assert.equal(pending.inProgress,950);assert.equal(pending.onHold,0)
  const paid=(await db.query("select i.id from order_items i join orders o on o.id=i.order_id where o.payment_environment='live'")).rows[0].id
  await db.query('insert into order_deliveries(item_id,held_at) values($1,now())',[paid])
  const held=await as(owner,()=>rpc('cm_vendor_pending_earnings'));assert.equal(held.inProgress,0);assert.equal(held.onHold,950)
  await as(buyer,()=>assert.rejects(rpc('cm_vendor_overview'),/Vendor access/))
})
test('inbox pages are bounded and account summary exposes only the caller data',async()=>{
  await db.exec('alter table buyer_conversations disable trigger cm_conversation_limit')
  for(let n=0;n<25;n++)await db.query('insert into buyer_conversations(buyer_id,vendor_id) values($1,$2)',[buyer,store])
  const page=await as(buyer,()=>rpc('cm_conversations_page',[0]));assert.equal(page.length,21)
  assert.equal((await as(buyer,()=>rpc('cm_conversations_page',[20]))).length,5)
  assert.equal((await as(admin,()=>rpc('cm_conversations_page',[0]))).length,0)
  const summary=await as(buyer,()=>rpc('cm_account_summary'));assert.equal(summary.full_name,'Buyer');assert.equal(summary.seller_id,null);assert.equal(summary.is_admin,false)
  assert.equal((await as(buyer,()=>rpc('cm_conversation_header',[page[0].id]))).other_name,'Test store')
  assert.equal(await as(admin,()=>rpc('cm_conversation_header',[page[0].id])),null)
})
