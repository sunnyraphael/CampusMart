import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite()
const owner='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',store='44444444-4444-4444-8444-444444444444',product='55555555-5555-4555-8555-555555555555',draft='66666666-6666-4666-8666-666666666666'
const as=async(id,fn)=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await fn()}finally{await db.exec('reset role;reset request.jwt.claim.sub')}}
const rpc=async(name,args)=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result
const manage=(user,action)=>as(user,()=>rpc('cm_manage_store',[store,action,'Reviewed store management request.',user===admin]))
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table auth.users(id uuid primary key);
    create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    create table public.users(id uuid primary key,role text,full_name text,email text);
    create table public.sellers(id uuid primary key,user_id uuid,store_name text,logo_url text,wallet_balance numeric default 0);
    create table public.products(id uuid primary key,seller_id uuid references public.sellers(id),status text,images text[] default '{}');
    create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid,is_trial boolean default false,payment_environment text,payment_status text default 'paid',created_at timestamptz default now());
    create table public.order_items(id uuid primary key default gen_random_uuid(),seller_id uuid,order_id uuid,fulfillment_status text,released_at timestamptz,dispute_reason text,dispute_resolution text);
    create table public.buyer_messages(id uuid,sender_id uuid,body text);create table public.support_requests(id uuid,user_id uuid,body text);
    create table public.paystack_transfers(id uuid,seller_id uuid,state text);create table public.paystack_refunds(id uuid,order_id uuid,state text);
    grant select,update,insert,delete on public.sellers,public.products,public.orders,public.order_items,public.buyer_messages,public.support_requests to authenticated;
    insert into public.users values('${owner}','vendor','Owner','owner@test'),('${admin}','admin','Admin','admin@test'),('${other}','buyer','Other','other@test');
    insert into auth.users values('${owner}'),('${admin}'),('${other}');
    insert into public.sellers(id,user_id,store_name) values('${store}','${owner}','Test Store');
    insert into public.products values('${product}','${store}','active','{}'),('${draft}','${store}','draft','{}');`)
  for(const file of ['202610310002_vendor_enrollment_and_image_cleanup.sql','202611010001_account_controls.sql','202611020001_store_management.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
})
after(()=>db.close())
test('store actions reject outsiders, direct flags and short reasons',async()=>{
  await assert.rejects(manage(other,'pause'),/unavailable/)
  await as(other,()=>assert.rejects(rpc('cm_store_overview',[store]),/unavailable/))
  await as(owner,()=>assert.rejects(db.exec(`update public.sellers set admin_paused=true where id='${store}'`),/management controls/))
  await as(owner,()=>assert.rejects(rpc('cm_manage_store',[store,'close','no']),/reason/))
})
test('pause hides active listings, blocks stale-cart orders and resumes only previously published items',async()=>{
  await manage(owner,'pause')
  assert.equal((await db.query('select status from products where id=$1',[product])).rows[0].status,'draft')
  await as(owner,()=>assert.rejects(db.query("update products set status='active' where id=$1",[draft]),/paused or closed/))
  await assert.rejects(db.query("insert into order_items(seller_id) values($1)",[store]),/temporarily unavailable/)
  await manage(owner,'resume')
  assert.equal((await db.query('select status from products where id=$1',[product])).rows[0].status,'active')
  assert.equal((await db.query('select status from products where id=$1',[draft])).rows[0].status,'draft')
})
test('owner cannot undo admin pause or admin closure through old account controls',async()=>{
  await manage(admin,'pause');await manage(owner,'resume')
  assert.equal((await db.query('select status from products where id=$1',[product])).rows[0].status,'draft')
  await manage(admin,'resume');await manage(admin,'close')
  await assert.rejects(manage(owner,'reopen'),/administrator/)
  await as(owner,()=>assert.rejects(rpc('cm_set_store_closed',[false]),/administrator/))
  await manage(admin,'reopen')
  assert.equal((await db.query('select status from products where id=$1',[product])).rows[0].status,'draft')
})
test('real order statistics count distinct orders, exclude simulations and retain dispute history',async()=>{
  const make=async(mode,trial,statuses)=>{
    const order=(await db.query('insert into orders(user_id,payment_environment,is_trial) values($1,$2,$3) returning id',[other,mode,trial])).rows[0].id
    for(const status of statuses)await db.query('insert into order_items(seller_id,order_id,fulfillment_status,released_at,dispute_reason) values($1,$2,$3,$4,$5)',[store,order,status,status==='received'?new Date():null,status==='refunded'?'Item damaged':null])
  }
  await make('live',false,['received','received']);await make('live',false,['refunded']);await make('live',false,['confirmed']);await make('live',false,['received','refunded']);await make('test',false,['received']);await make(null,true,['received'])
  const stats=await as(admin,()=>rpc('cm_store_overview',[store]))
  assert.equal(stats.orders,4);assert.equal(stats.completed,1);assert.equal(stats.unsuccessful,1);assert.equal(stats.ongoing,1);assert.equal(stats.disputes,2);assert.equal(stats.mixed,1)
})
test('permanent public-photo removal requires closure and settled obligations, queues files, preserves orders',async()=>{
  await assert.rejects(manage(owner,'purge_images'),/Close the store/)
  const image=`https://project.test/storage/v1/object/public/product-images/${store}/item.jpg`,logo=`https://project.test/storage/v1/object/public/product-images/${store}/logo.png`
  await db.query('update products set images=$1 where id=$2',[[image],product]);await db.query('update sellers set logo_url=$1 where id=$2',[logo,store]);await manage(owner,'close')
  await assert.rejects(manage(owner,'purge_images'),/Resolve orders/)
  await db.exec("update order_items set fulfillment_status='refunded',released_at=null;update sellers set wallet_balance=100")
  await assert.rejects(manage(owner,'purge_images'),/wallet/)
  await db.exec('update sellers set wallet_balance=0');await manage(owner,'purge_images')
  assert.equal((await db.query('select logo_url from sellers')).rows[0].logo_url,null)
  assert.deepEqual((await db.query('select images from products where id=$1',[product])).rows[0].images,[])
  assert.equal(Number((await db.query('select count(*) n from listing_image_cleanup')).rows[0].n),2)
  assert.equal(Number((await db.query('select count(*) n from orders')).rows[0].n),6)
  await manage(owner,'reopen');await as(owner,()=>assert.rejects(db.query('update sellers set logo_url=$1 where id=$2',[logo,store]),/removed|queued/))
  assert.ok(Number((await db.query('select count(*) n from store_management_events')).rows[0].n)>5)
})
