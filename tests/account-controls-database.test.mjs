import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const db=new PGlite()
const buyer='11111111-1111-4111-8111-111111111111',vendor='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',stranger='99999999-9999-4999-8999-999999999999'
const store='44444444-4444-4444-8444-444444444444',product='55555555-5555-4555-8555-555555555555',order='66666666-6666-4666-8666-666666666666'
const as=async(id,fn)=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await fn()}finally{await db.exec('reset role;reset request.jwt.claim.sub')}}
const rpc=async(name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result

before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    create table public.users(id uuid primary key,full_name text,email text);
    create table public.sellers(id uuid primary key,user_id uuid,store_name text,wallet_balance numeric default 0);
    create table public.products(id uuid primary key default gen_random_uuid(),seller_id uuid,status text);
    create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,seller_id uuid,fulfillment_status text,released_at timestamptz);
    create table public.buyer_messages(id uuid default gen_random_uuid(),sender_id uuid,body text);
    create table public.support_requests(id uuid default gen_random_uuid(),user_id uuid,body text);
    grant select,insert,update,delete on public.products,public.sellers,public.orders,public.order_items,public.buyer_messages,public.support_requests to authenticated;
    insert into auth.users values('${buyer}'),('${vendor}'),('${admin}'),('${stranger}');
    insert into public.users values('${buyer}','Buyer','buyer@example.test'),('${vendor}','Vendor','vendor@example.test'),('${admin}','Admin','admin@example.test'),('${stranger}','Other','other@example.test');
    insert into public.sellers values('${store}','${vendor}','Campus Store',0);
    insert into public.products values('${product}','${store}','active');
    insert into public.orders values('${order}','${buyer}');`)
  await db.exec(await readFile(new URL('../supabase/migrations/202611010001_account_controls.sql',import.meta.url),'utf8'))
  await db.exec(`alter table public.orders add column is_trial boolean default false,add column status text default 'pending',add column created_at timestamptz default now();
    alter table public.order_items add column auto_release_at timestamptz;
    create function public.cm_delivery_event(uuid,text,text) returns void language sql as $$select$$;`)
  await db.exec(await readFile(new URL('../supabase/migrations/202611010004_buyer_order_cancellation.sql',import.meta.url),'utf8'))
})
after(()=>db.close())

test('privacy requests are owner-only, idempotent and cannot be forged or self-approved',async()=>{
  const id=await as(buyer,()=>rpc('cm_request_account_change',['delete_data','Remove an old contact detail']))
  assert.equal(await as(buyer,()=>rpc('cm_request_account_change',['delete_data','Retry'])),id)
  await as(stranger,async()=>{
    assert.equal((await db.query('select * from public.account_change_requests')).rows.length,0)
    await assert.rejects(rpc('cm_cancel_account_change',[id]),/belonging to your account/)
    await assert.rejects(rpc('cm_admin_review_account_change',[id,'approve_closure','Pretend to approve someone else']),/Administrator/)
    await assert.rejects(db.query('insert into public.account_change_requests(user_id,kind) values($1,$2)',[buyer,'close_account']),/permission denied/)
  })
  await as(buyer,()=>rpc('cm_cancel_account_change',[id]))
  assert.equal((await db.query('select status from public.account_change_requests where id=$1',[id])).rows[0].status,'cancelled')
})
test('closing only the owned store drafts listings, stops new sales and preserves buyer access',async()=>{
  await as(buyer,()=>assert.rejects(rpc('cm_set_store_closed',[true]),/no store/))
  await as(vendor,()=>rpc('cm_set_store_closed',[true]))
  assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
  assert.equal((await as(vendor,()=>rpc('cm_account_status'))).active,true)
  await as(vendor,()=>assert.rejects(db.query('update public.products set status=$1 where id=$2',['active',product]),/store is closed/))
  await assert.rejects(db.query('insert into public.order_items(order_id,seller_id,fulfillment_status) values($1,$2,$3)',[order,store,'pending']),/closed store/)
  await as(vendor,()=>rpc('cm_set_store_closed',[false]))
  assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
  await as(vendor,()=>db.query('update public.products set status=$1 where id=$2',['active',product]))
})
test('store closure cannot be bypassed by a direct seller update',async()=>{
  await as(vendor,()=>assert.rejects(db.query('update public.sellers set store_closed_at=now() where id=$1',[store]),/Use account controls/))
  assert.equal((await db.query('select store_closed_at from public.sellers')).rows[0].store_closed_at,null)
})
test('account-only rejects an open store; both closes store immediately and cancellation does not reopen it',async()=>{
  await as(vendor,()=>assert.rejects(rpc('cm_request_account_change',['close_account','']),/Close your store first/))
  const id=await as(vendor,()=>rpc('cm_request_account_change',['close_both','Please close everything']))
  assert.ok((await as(vendor,()=>rpc('cm_account_status'))).store_closed_at)
  await as(vendor,()=>rpc('cm_cancel_account_change',[id]))
  assert.ok((await as(vendor,()=>rpc('cm_account_status'))).store_closed_at)
})
test('admin closure requires settled orders and wallet, then blocks account writes and new orders',async()=>{
  await as(vendor,()=>rpc('cm_set_store_closed',[false]))
  const pending=(await db.query('insert into public.order_items(order_id,seller_id,fulfillment_status) values($1,$2,$3) returning id',[order,store,'pending'])).rows[0].id
  const id=await as(vendor,()=>rpc('cm_request_account_change',['close_both','Close after everything is settled']))
  // An open buyer-side order prevents closing the buyer, independently of vendor balances.
  const buyerRequest=await as(buyer,()=>rpc('cm_request_account_change',['close_account','Close this buyer account']))
  await as(admin,()=>assert.rejects(rpc('cm_admin_review_account_change',[buyerRequest,'approve_closure','Reviewed the account obligations']),/Resolve open orders/))
  await db.query('update public.order_items set fulfillment_status=$1,released_at=now() where id=$2',['received',pending])
  await db.query('update public.sellers set wallet_balance=100 where id=$1',[store])
  await as(admin,()=>assert.rejects(rpc('cm_admin_review_account_change',[id,'approve_closure','Reviewed the account obligations']),/Settle the vendor wallet/))
  await db.query('update public.sellers set wallet_balance=0 where id=$1',[store])
  await as(admin,()=>rpc('cm_admin_review_account_change',[id,'approve_closure','Orders settled; wallet cleared; required records retained.']))
  assert.equal((await as(vendor,()=>rpc('cm_account_status'))).active,false)
  await as(vendor,async()=>{
    await assert.rejects(rpc('cm_set_store_closed',[false]),/account is closed/)
    await assert.rejects(db.query('insert into public.orders(user_id) values($1)',[vendor]),/account is closed/)
    await assert.rejects(db.query('insert into public.buyer_messages(sender_id,body) values($1,$2)',[vendor,'No longer allowed']),/account is closed/)
    // Privacy rights and support remain usable after deactivation.
    await rpc('cm_request_account_change',['delete_data','Remove eligible data from this closed account'])
    await db.query('insert into public.support_requests(user_id,body) values($1,$2)',[vendor,'Help with my privacy request'])
  })
  assert.equal((await db.query('select count(*) n from public.orders')).rows[0].n,1)
})
test('data removal review never pretends to erase data, and review history is retained',async()=>{
  const id=await as(stranger,()=>rpc('cm_request_account_change',['delete_data','Review my personal data']))
  await as(admin,()=>assert.rejects(rpc('cm_admin_review_account_change',[id,'approve_closure','Try marking data deletion complete']),/does not erase data/))
  await as(admin,()=>rpc('cm_admin_review_account_change',[id,'in_review','We are identifying records eligible for removal and retention.']))
  const queue=await as(admin,()=>rpc('cm_admin_account_requests',['open']))
  const row=queue.find(request=>request.id===id)
  assert.equal(row.status,'in_review');assert.equal(row.events.length,2)
  assert.equal((await db.query('select count(*) n from public.users where id=$1',[stranger])).rows[0].n,1)
  await as(stranger,()=>assert.rejects(rpc('cm_cancel_account_change',[id]),/Only a pending request/))
})

test('a cancelled trial permits account closure, but an unaudited cancelled order still blocks it',async()=>{
  const sid=crypto.randomUUID(),oid=crypto.randomUUID()
  await db.query('insert into public.sellers(id,user_id,store_name) values($1,$2,$3)',[sid,admin,'Another store'])
  await db.query("insert into public.orders(id,user_id,is_trial) values($1,$2,true)",[oid,stranger])
  await db.query("insert into public.order_items(order_id,seller_id,fulfillment_status) values($1,$2,'pending')",[oid,sid])
  const request=await as(stranger,()=>rpc('cm_request_account_change',['close_account','Close after cancellation']))
  await db.query("update public.order_items set fulfillment_status='cancelled' where order_id=$1",[oid])
  await as(admin,()=>assert.rejects(rpc('cm_admin_review_account_change',[request,'approve_closure','Must not bypass settlement checks.']),/Resolve open orders/))
  await db.query("update public.order_items set fulfillment_status='pending' where order_id=$1",[oid])
  await as(stranger,()=>rpc('cm_cancel_buyer_order',[oid]))
  await as(admin,()=>rpc('cm_admin_review_account_change',[request,'approve_closure','Cancelled trial has no remaining financial obligation.']))
  assert.equal((await as(stranger,()=>rpc('cm_account_status'))).active,false)
})
