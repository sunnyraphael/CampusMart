import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('all privacy migrations compose: guardian closure stops new sales and preserves existing fulfilment',async()=>{
  const db=new PGlite()
  const guardian='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',buyer='44444444-4444-4444-8444-444444444444'
  const as=async(id,work)=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await work()}finally{await db.exec('reset role;reset request.jwt.claim.sub')}}
  const rpc=async(name,args=[]) =>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result
  const signup=async(id,email,metadata)=>{
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,email,metadata])
    await db.query('insert into public.users(id,full_name,email) values($1,$2,$3)',[id,'Test user',email])
  }
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
      create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
      create table public.users(id uuid primary key,full_name text,email text);
      create table public.sellers(id uuid primary key default gen_random_uuid(),user_id uuid,store_name text,wallet_balance numeric default 0);
      create table public.products(id uuid primary key default gen_random_uuid(),seller_id uuid,status text,avg_rating numeric,total_reviews integer);
      create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid);
      create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,seller_id uuid,fulfillment_status text default 'pending',released_at timestamptz);
      create table public.buyer_conversations(id uuid primary key default gen_random_uuid(),buyer_id uuid);
      create table public.buyer_messages(id uuid primary key default gen_random_uuid(),sender_id uuid,body text);
      create table public.support_requests(id uuid primary key default gen_random_uuid(),user_id uuid,body text);
      create table public.reviews(id uuid primary key default gen_random_uuid(),product_id uuid,user_id uuid,rating integer,comment text);
      grant select,insert,update on public.users,public.sellers,public.products,public.orders,public.order_items,public.buyer_conversations,public.buyer_messages,public.support_requests to authenticated;`)
    for(const file of ['202611010001_account_controls.sql','202611010002_marketplace_consent.sql','202611010003_review_integrity.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
    for(const [id,email]of [[guardian,'guardian@example.test'],[admin,'admin@example.test'],[buyer,'buyer@example.test']])await signup(id,email,{age_band:'adult',terms_accepted:true})
    await as(guardian,()=>rpc('cm_accept_vendor_terms',[true]))
    const permission=await as(guardian,()=>rpc('cm_request_guardian_permission',['student@example.test','parent',true,true]))
    await as(admin,()=>rpc('cm_admin_review_guardian',[permission,true,true,'Identity, authority and selling permission were reviewed.']))
    await signup(student,'student@example.test',{age_band:'under_18',terms_accepted:true,guardian_request_id:permission})
    await as(student,()=>rpc('cm_accept_vendor_terms',[true]))
    const store=(await as(student,()=>db.query('insert into public.sellers(user_id,store_name) values($1,$2) returning id',[student,'Student store']))).rows[0].id
    const product=(await as(student,()=>db.query("insert into public.products(seller_id,status,avg_rating,total_reviews) values($1,'active',5,999) returning id,avg_rating,total_reviews",[store]))).rows[0]
    assert.equal(product.avg_rating,null);assert.equal(product.total_reviews,0)
    const order=(await as(buyer,()=>db.query('insert into public.orders(user_id) values($1) returning id,terms_version',[buyer]))).rows[0]
    assert.equal(order.terms_version,'2026-11-01')
    const item=(await as(buyer,()=>db.query('insert into public.order_items(order_id,seller_id) values($1,$2) returning id',[order.id,store]))).rows[0].id
    const closure=await as(guardian,()=>rpc('cm_request_account_change',['close_account','Close my guardian account.']))
    await as(admin,()=>rpc('cm_admin_review_account_change',[closure,'approve_closure','Reviewed the request, balances and outstanding obligations.']))
    assert.equal((await db.query('select status from public.products where id=$1',[product.id])).rows[0].status,'draft')
    assert.equal((await as(student,()=>rpc('cm_consent_status'))).eligible,false)
    await as(buyer,()=>assert.rejects(db.query('insert into public.order_items(order_id,seller_id) values($1,$2)',[order.id,store]),/Review your account permissions/))
    await as(student,()=>db.query("update public.order_items set fulfillment_status='delivered' where id=$1",[item]))
    assert.equal((await db.query('select fulfillment_status from public.order_items where id=$1',[item])).rows[0].fulfillment_status,'delivered')
    await as(student,()=>db.query('insert into public.support_requests(user_id,body) values($1,$2)',[student,'Help with my existing order.']))
    const deletion=await as(student,()=>rpc('cm_request_account_change',['delete_data','Remove eligible saved information.']))
    assert.ok(deletion)
  }finally{await db.close()}
})
