import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const db=new PGlite(),admin='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333'
async function auth(user=owner,mfa=false,age=0){await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,role:'authenticated',aal:mfa?'aal2':'aal1',amr:mfa?[{method:'totp',timestamp:Math.floor(Date.now()/1000)-age}]:[]})]);await db.exec('set role authenticated')}
const rpc=async(name,args=[])=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as value',args)).rows[0].value
before(async()=>{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;
create function public.is_admin() returns boolean language sql stable security definer as $$select auth.uid()='${admin}'::uuid$$;
create table public.private_admin_data(id int);insert into private_admin_data values(1);alter table private_admin_data enable row level security;create policy admin_read on private_admin_data to authenticated using(public.is_admin());grant select on private_admin_data to authenticated;
create table users(id uuid primary key,full_name text,phone text);
create table sellers(id uuid primary key,user_id uuid,logo_url text);
create table products(id uuid primary key default gen_random_uuid(),seller_id uuid,title text,description text,price numeric,images text[] default '{}',stock_quantity int);
create table orders(id uuid primary key default gen_random_uuid(),status text);
create table order_items(id uuid primary key default gen_random_uuid(),order_id uuid,product_id uuid,quantity int,fulfillment_status text);
create table paystack_payments(order_id uuid primary key,user_id uuid,reference text unique,mode text,state text default 'pending',stock_released boolean default false,created_at timestamptz default now(),expires_at timestamptz default now()+interval '30 minutes',provider_id text,last_checked_at timestamptz);
create table storage.objects(bucket_id text,name text);
create table listing_image_cleanup(image_url text,status text);
create table action_limits(user_id uuid,scope text,hits int,primary key(user_id,scope));
create function cm_allow_action(p_scope text) returns void language plpgsql security definer as $$declare n int;begin insert into public.action_limits values(auth.uid(),p_scope,1) on conflict(user_id,scope) do update set hits=public.action_limits.hits+1 returning hits into n;if n>(case p_scope when 'profile' then 20 else 30 end) then raise exception 'Too many requests';end if;end$$;
grant select,insert,update,delete on users,sellers,products,orders,order_items,paystack_payments to authenticated;
insert into users values('${owner}','Owner',null),('${other}','Other',null),('${admin}','Admin',null);
insert into sellers values('${owner}','${owner}',null),('${other}','${other}',null);`)
// Use the actual expiration and stock restoration functions, not a fake expiry implementation.
const original=await readFile('supabase/migrations/202611010005_paystack_payments.sql','utf8')
for(const name of ['cm_paystack_restore_stock','cm_expire_paystack_payment']){const start=original.indexOf('create function public.'+name+'('),end=original.indexOf('$$;',original.indexOf('as $$',start));await db.exec(original.slice(start,end+3))}
await db.exec(await readFile('supabase/migrations/202611030001_security_hardening.sql','utf8'))
await db.exec("select cm_configure_storage_origin('https://project.supabase.co')")
})
after(()=>db.close())
test('existing admin policies and is_admin require a recent MFA session, membership alone cannot authorise',async()=>{
 await auth(admin);assert.equal(await rpc('cm_admin_membership'),true);assert.equal(await rpc('is_admin'),false);assert.equal((await db.query('select * from private_admin_data')).rows.length,0)
 await auth(admin,true);assert.equal(await rpc('is_admin'),true);assert.equal((await db.query('select * from private_admin_data')).rows.length,1)
 await auth(admin,true,1000);assert.equal(await rpc('is_admin'),false)
 await auth(other,true);assert.equal(await rpc('is_admin'),false)
})
test('foreign and external photo references, oversized galleries and foreign logos are rejected',async()=>{
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");await db.query("insert into storage.objects values('product-images',$1),('product-images',$2)",[owner+'/a-full.webp',other+'/b-full.webp'])
 await auth(owner);await db.query('insert into products(seller_id,images) values($1,$2)',[owner,['https://project.supabase.co/storage/v1/object/public/product-images/'+owner+'/a-full.webp']])
 for(const url of ['https://project.supabase.co/storage/v1/object/public/product-images/'+other+'/b-full.webp','https://evil.test/storage/v1/object/public/product-images/'+owner+'/a-full.webp'])await assert.rejects(db.query('insert into products(seller_id,images) values($1,$2)',[owner,[url]]),/own store/)
 await assert.rejects(db.query('insert into products(seller_id,images) values($1,$2)',[owner,Array(6).fill('bad')]),/five listing/)
 await assert.rejects(db.query('update sellers set logo_url=$1 where id=$2',['https://project.supabase.co/storage/v1/object/public/product-images/'+other+'/b-full.webp',owner]),/own store/)
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");assert.equal(await rpc('cm_image_referenced',[owner+'/a-full.webp']),true)
})
test('profile and listing limits run on direct writes, even without server actions',async()=>{
 await auth(owner);for(let n=0;n<20;n++)await db.query('update users set full_name=$1 where id=$2',['Owner '+n,owner]);await assert.rejects(db.query('update users set full_name=$1 where id=$2',['Blocked',owner]),/Too many/)
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");await db.exec("delete from action_limits where scope='publish'");await auth(owner)
 for(let n=0;n<30;n++)await db.query('insert into products(seller_id,title) values($1,$2)',[owner,'Listing '+n]);await assert.rejects(db.query('insert into products(seller_id,title) values($1,$2)',[owner,'Blocked']),/Too many/)
})
test('unpaid reservation count and quantities are capped; batch expiry releases stock without Paystack calls',async()=>{
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");const product=crypto.randomUUID();await db.query('insert into products(id,seller_id,stock_quantity) values($1,$2,5)',[product,owner]);
 async function reserve(quantity=1){const order=crypto.randomUUID();await db.query('insert into orders(id) values($1)',[order]);await db.query("insert into order_items(order_id,product_id,quantity,fulfillment_status) values($1,$2,$3,'pending')",[order,product,quantity]);await db.query('insert into paystack_payments(order_id,user_id,reference,mode) values($1,$2,$3,$4)',[order,owner,crypto.randomUUID(),'test']);return order}
 await reserve();await reserve();await assert.rejects(reserve(),/two unpaid/)
 await db.exec("update paystack_payments set expires_at=now()-interval '1 minute'")
 assert.equal(await rpc('cm_expire_reservations',['test',50]),2)
 assert.equal((await db.query('select stock_quantity from products where id=$1',[product])).rows[0].stock_quantity,7)
 assert.equal(await rpc('cm_expire_reservations',['test',50]),0)
 await assert.rejects(reserve(6),/five of one/)
 await reserve();await auth(owner);await assert.rejects(rpc('cm_expire_reservations',['test',50]),/permission denied/)
})
test('payment check claims are atomic and private, with a 15-second cooldown',async()=>{
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");const ref=(await db.query("select reference from paystack_payments where state='pending' limit 1")).rows[0].reference
 assert.equal(await rpc('cm_claim_payment_check',[ref]),true);assert.equal(await rpc('cm_claim_payment_check',[ref]),false)
 await db.query("update paystack_payments set last_checked_at=now()-interval '16 seconds' where reference=$1",[ref]);assert.equal(await rpc('cm_claim_payment_check',[ref]),true)
 await auth(owner);await assert.rejects(rpc('cm_claim_payment_check',[ref]),/permission denied/)
})
test('network budgets are service-only and reject the 61st attempt',async()=>{
 await db.exec("reset role;select set_config('request.jwt.claims','{}',false)");const key='a'.repeat(64);for(let n=0;n<60;n++)await rpc('cm_security_budget',[key,'checkout_network']);await assert.rejects(rpc('cm_security_budget',[key,'checkout_network']),/Too many/)
 await auth(owner);await assert.rejects(rpc('cm_security_budget',[key,'checkout_network']),/permission denied/)
})
