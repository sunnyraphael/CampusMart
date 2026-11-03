import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto'

const db=new PGlite({extensions:{pgcrypto}})
const buyer='11111111-1111-4111-8111-111111111111',vendor='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',other='99999999-9999-4999-8999-999999999999'
const seller='44444444-4444-4444-8444-444444444444',order='55555555-5555-4555-8555-555555555555',product='66666666-6666-4666-8666-666666666666'
let itemNumber=0
const as=async(id,fn)=>{await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}'`);try{return await fn()}finally{await db.exec('reset role')}}
const rpc=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result
async function item(status='pending',verified=true){const id=`77777777-7777-4777-8777-${String(++itemNumber).padStart(12,'0')}`;await db.query('update public.orders set payment_verified_at=$1,payment_verification_ref=$2 where id=$3',[verified?new Date():null,verified?'verified-fixture-ref':null,order]);await db.query('insert into public.order_items(id,order_id,seller_id,product_id,quantity,unit_price,subtotal,fulfillment_status) values($1,$2,$3,$4,1,1234.56,1234.56,$5)',[id,order,seller,product,status]);return id}
async function handedOver(id){const code=await as(buyer,()=>rpc('cm_issue_delivery_code',[id]));await as(vendor,()=>rpc('cm_verify_delivery_code',[id,code.code]));await as(buyer,()=>rpc('cm_confirm_delivery',[id]));return code}
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create table public.users(id uuid primary key,full_name text,email text);
    create table public.sellers(id uuid primary key,user_id uuid,store_name text,wallet_balance numeric default 0,total_earned numeric default 0);
    create table public.products(id uuid primary key,title text);
    create table public.orders(id uuid primary key,user_id uuid,payment_status text check(payment_status in ('unpaid','paid','refunded')),created_at timestamptz default now(),phone_number text,delivery_method text,delivery_address text);
    create table public.order_items(id uuid primary key,order_id uuid,seller_id uuid,product_id uuid,quantity integer check(quantity>0),unit_price numeric,subtotal numeric,
      fulfillment_status text not null default 'pending' check(fulfillment_status in ('pending','confirmed','shipped','delivered','received','disputed','refunded')),
      delivered_at timestamptz,received_at timestamptz,auto_release_at timestamptz,dispute_reason text,commission_amount numeric,payout_amount numeric,released_at timestamptz,
      dispute_resolution text check(dispute_resolution in ('release','refund')),dispute_resolved_at timestamptz,dispute_resolved_by uuid,dispute_admin_note text,refund_amount numeric);
    create table public.transactions(id uuid primary key default gen_random_uuid(),seller_id uuid,order_item_id uuid,type text,gross_amount numeric,commission_amount numeric,amount numeric,status text,description text,created_at timestamptz default now());
    create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,type text constraint notifications_type_check check(type in ('order_placed','order_confirmed','order_shipped','order_delivered','order_cancelled')),message text,order_id uuid,created_at timestamptz default now());
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;
    create function public.release_due_payouts() returns integer language sql as $$select 1$$;
    create function public.release_item_payout(p_item_id uuid) returns void language plpgsql as $$begin update public.sellers set wallet_balance=wallet_balance+100;end$$;
    create function public.confirm_item_received(p_item_id uuid) returns void language plpgsql as $$begin perform public.release_item_payout(p_item_id);end$$;
    insert into public.users values('${buyer}','Buyer','buyer@example.test'),('${vendor}','Vendor','vendor@example.test'),('${admin}','Admin','admin@example.test'),('${other}','Other','other@example.test');
    insert into public.sellers(id,user_id,store_name) values('${seller}','${vendor}','Campus Store');
    insert into public.products values('${product}','Campus headphones');
    insert into public.orders(id,user_id,payment_status,delivery_method) values('${order}','${buyer}','paid','pickup');
    grant select,update on public.orders to authenticated;
    grant update(fulfillment_status),select on public.order_items to authenticated;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202610310003_order_delivery_approval.sql',import.meta.url),'utf8'))
  await db.exec(`alter table public.sellers add column phone text;
    alter table public.orders add column total_amount numeric,add column status text default 'pending' check(status in ('pending','confirmed','processing','shipped','delivered','completed','disputed','cancelled')),add column payment_ref text,add column delivery_notes text,add column delivery_fee numeric default 0,add column service_fee numeric default 0;
    alter table public.products add column seller_id uuid default '${seller}',add column price numeric default 1234.56,add column stock_quantity integer default 10,add column status text default 'active';`)
  await db.exec(await readFile(new URL('../supabase/migrations/202610310004_trial_checkout.sql',import.meta.url),'utf8'))
  // Reproduce the live failure before applying the forward-only repair.
  await assert.rejects(rpc('cm_create_trial_order',[buyer,crypto.randomUUID(),[{product_id:product,quantity:1}],'pickup','','08012345678','Constraint regression',1259.56]),
    error=>error.code==='23514'&&/notifications_type_check/.test(error.message))
  assert.equal(Number((await db.query('select count(*) n from public.orders where is_trial')).rows[0].n),0)
  assert.equal(Number((await db.query('select count(*) n from public.trial_checkout_requests')).rows[0].n),0)
  await db.exec(await readFile(new URL('../supabase/migrations/202610310005_order_update_notifications.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202611010004_buyer_order_cancellation.sql',import.meta.url),'utf8'))
  await db.exec(`alter table public.orders enable row level security;alter table public.order_items enable row level security;
    create policy base_orders_read on public.orders for select to authenticated using(user_id=auth.uid());
    create policy base_orders_update on public.orders for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());`)
})
after(()=>db.close())

test('notification repair preserves legacy types and continues rejecting unknown types',async()=>{
  for(const type of ['order_placed','order_confirmed','order_shipped','order_delivered','order_cancelled','order_update']) {
    await db.query('insert into public.notifications(user_id,type,message) values($1,$2,$3)',[buyer,type,'Notification constraint regression'])
  }
  await assert.rejects(db.query('insert into public.notifications(user_id,type,message) values($1,$2,$3)',[buyer,'unsupported_type','Rejected']),error=>error.code==='23514')
  await db.exec(await readFile(new URL('../supabase/migrations/202610310005_order_update_notifications.sql',import.meta.url),'utf8'))
})

test('vendor progression is sequential and restricted to the owning vendor',async()=>{
  const id=await item()
  await as(other,()=>assert.rejects(rpc('cm_vendor_update_delivery',[id,'confirmed']),/not available/))
  await as(vendor,async()=>{
    await assert.rejects(rpc('cm_vendor_update_delivery',[id,'delivered']),/one step/)
    await rpc('cm_vendor_update_delivery',[id,'confirmed'])
    await rpc('cm_vendor_update_delivery',[id,'shipped',null,'Campus rider','ABC','https://example.test/track','Meet at Hall A'])
    await assert.rejects(rpc('cm_vendor_update_delivery',[id,'shipped',null,null,null,'javascript:alert(1)']),/tracking link/)
    const rows=await rpc('cm_order_tracking',[order]);const row=rows.find(x=>x.item_id===id)
    assert.equal(row.status,'shipped');assert.equal(row.tracking_number,'ABC');assert.equal(row.events.length,2)
  })
  await as(other,()=>assert.rejects(rpc('cm_order_tracking',[order]),/not available/))
})

test('codes are buyer-only, salted hashes, expire and reject replay without credit',async()=>{
  const id=await item('shipped')
  await as(vendor,()=>assert.rejects(rpc('cm_issue_delivery_code',[id]),/not available/))
  const code=await as(buyer,()=>rpc('cm_issue_delivery_code',[id]));assert.match(code.code,/^\d{6}$/)
  const stored=(await db.query('select * from public.order_deliveries where item_id=$1',[id])).rows[0]
  assert.notEqual(stored.code_hash,code.code);assert.equal(stored.code_hash.length,64)
  await as(buyer,async()=>{
    await assert.rejects(db.exec('select * from public.order_deliveries'),/permission denied/)
    assert.doesNotMatch(JSON.stringify(await rpc('cm_order_tracking',[order])),/code_hash|code_salt|"code":/)
    await assert.rejects(rpc('cm_issue_delivery_code',[id]),/one minute/)
  })
  await db.query("update public.order_deliveries set code_expires_at=now()-interval '1 second' where item_id=$1",[id])
  assert.equal((await as(vendor,()=>rpc('cm_verify_delivery_code',[id,code.code]))).ok,false)
  await db.query("update public.order_deliveries set code_issued_at=now()-interval '2 minutes' where item_id=$1",[id])
  const fresh=await as(buyer,()=>rpc('cm_issue_delivery_code',[id]))
  assert.equal((await as(vendor,()=>rpc('cm_verify_delivery_code',[id,fresh.code]))).ok,true)
  await as(buyer,()=>assert.rejects(rpc('cm_issue_delivery_code',[id]),/already been verified/))
  assert.equal((await db.query('select released_at from public.order_items where id=$1',[id])).rows[0].released_at,null)
})

test('wrong-code attempts commit and lock the code after five failures',async()=>{
  const id=await item('shipped');await as(buyer,()=>rpc('cm_issue_delivery_code',[id]))
  for(let n=0;n<5;n++)assert.equal((await as(vendor,()=>rpc('cm_verify_delivery_code',[id,'not-a-code']))).ok,false)
  const result=await as(vendor,()=>rpc('cm_verify_delivery_code',[id,'123456']));assert.match(result.message,/Too many/)
  assert.equal((await db.query('select code_attempts from public.order_deliveries where item_id=$1',[id])).rows[0].code_attempts,5)
})

test('an unissued code cannot be verified and status advances preserve delivery details',async()=>{
  const id=await item('shipped')
  const unissued=await as(vendor,()=>rpc('cm_verify_delivery_code',[id,'123456']));assert.equal(unissued.ok,false)
  await as(vendor,async()=>{
    await rpc('cm_vendor_update_delivery',[id,'shipped',null,'Campus rider','ABC-123','https://example.test/track','Hall A reception'])
    await rpc('cm_vendor_update_delivery',[id,'delivered'])
    const row=(await rpc('cm_order_tracking',[order])).find(r=>r.item_id===id)
    assert.equal(row.courier,'Campus rider');assert.equal(row.tracking_number,'ABC-123');assert.equal(row.delivery_note,'Hall A reception')
  })
})

test('receipt and handover never credit; only admin approval credits exact net once',async()=>{
  const id=await item('shipped');await handedOver(id)
  const before=Number((await db.query('select wallet_balance from public.sellers')).rows[0].wallet_balance)
  await as(buyer,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Checked all evidence']),/Admin access/))
  await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Checked all evidence']))
  const row=(await db.query('select * from public.order_items where id=$1',[id])).rows[0]
  assert.equal(Number(row.commission_amount),61.73);assert.equal(Number(row.payout_amount),1172.83);assert.ok(row.released_at)
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Repeated request']),/already been credited/))
  assert.equal(Number((await db.query('select wallet_balance from public.sellers')).rows[0].wallet_balance),before+1172.83)
  assert.equal((await db.query('select * from public.transactions where order_item_id=$1',[id])).rows.length,1)
})

test('unverified payments, missing handover, holds and unpaid orders cannot be credited',async()=>{
  const id=await item('delivered',false);await handedOver(id)
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Looks delivered']),/server-verified payment/))
  await as(buyer,()=>assert.rejects(db.query('update public.orders set payment_verified_at=now(),payment_verification_ref=$1 where id=$2',['forged',order]),/verification service/))
  await db.query('update public.orders set payment_verified_at=now(),payment_verification_ref=$1 where id=$2',['real-fixture-ref',order])
  await as(admin,()=>rpc('cm_admin_hold_delivery',[id,'Investigating delivery',true]))
  await as(vendor,async()=>assert.ok((await rpc('cm_vendor_delivery_holds')).includes(id)))
  await as(other,async()=>assert.equal((await rpc('cm_vendor_delivery_holds')).length,0))
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Looks delivered']),/review hold/))
  await as(admin,()=>rpc('cm_admin_hold_delivery',[id,'Investigation completed',false]))
  await as(vendor,async()=>assert.ok(!(await rpc('cm_vendor_delivery_holds')).includes(id)))
  await db.query("update public.orders set payment_status='unpaid' where id=$1",[order])
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Looks delivered']),/server-verified payment/))
  await db.query("update public.orders set payment_status='paid' where id=$1",[order])
  const missing=await item('delivered');await as(buyer,()=>rpc('cm_confirm_delivery',[missing]))
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[missing,'Looks delivered']),/verified delivery code/))
})

test('buyer disputes after confirmation block credit and admin resolution cannot bypass approval',async()=>{
  const id=await item('shipped');await handedOver(id)
  await as(buyer,()=>rpc('cm_report_order_problem',[id,'The headphones stopped working']))
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Ignore dispute']),/confirmation/))
  await as(admin,()=>rpc('cm_admin_resolve_delivery_dispute',[id,'release','Replacement provided']))
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Replacement delivered']),/confirmation/))
  assert.equal((await db.query('select released_at from public.order_items where id=$1',[id])).rows[0].released_at,null)
  await as(buyer,()=>rpc('cm_confirm_delivery',[id]))
  await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Buyer confirmed replacement']))
})

test('refund decision records an owed refund without vendor credit; queues are admin-only',async()=>{
  const id=await item('shipped');await as(buyer,()=>rpc('cm_report_order_problem',[id,'The item never arrived']))
  await as(other,()=>assert.rejects(rpc('cm_admin_delivery_queue',['held',1]),/Admin access/))
  await as(admin,async()=>{
    assert.ok((await rpc('cm_admin_delivery_queue',['held',1])).some(r=>r.item_id===id))
    await rpc('cm_admin_resolve_delivery_dispute',[id,'refund','No delivery evidence provided'])
    assert.ok(!(await rpc('cm_admin_delivery_queue',['held',1])).some(r=>r.item_id===id))
  })
  const row=(await db.query('select * from public.order_items where id=$1',[id])).rows[0]
  assert.equal(row.fulfillment_status,'refunded');assert.equal(Number(row.refund_amount),1234.56);assert.equal(row.released_at,null)
})

test('legacy releases and direct item updates cannot bypass the new approval flow',async()=>{
  const id=await item('delivered')
  await as(buyer,()=>assert.rejects(rpc('confirm_item_received',[id]),/permission denied/))
  await assert.rejects(rpc('release_item_payout',[id]),/moved to/)
  assert.equal(await rpc('release_due_payouts'),null)
  await as(vendor,()=>assert.rejects(db.query("update public.order_items set fulfillment_status='received' where id=$1",[id]),/permission denied/))
  await assert.rejects(db.query('update public.order_items set released_at=now() where id=$1',[id]),/Admin approval/)
})

test('in-app reminders are idempotent per day and never release money',async()=>{
  const id=await item('delivered')
  await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'delivered']))
  await db.query("update public.order_deliveries set reported_at=now()-interval '4 days',review_after=now()-interval '1 day' where item_id=$1",[id])
  await as(buyer,()=>assert.rejects(rpc('cm_delivery_reminders'),/permission denied/))
  const first=await rpc('cm_delivery_reminders');assert.ok(first>=1)
  assert.equal(await rpc('cm_delivery_reminders'),0)
  assert.equal((await db.query('select released_at from public.order_items where id=$1',[id])).rows[0].released_at,null)
})

test('approving one vendor item cannot credit another vendor or delivery',async()=>{
  const id=await item('shipped');await handedOver(id)
  const otherSeller='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await db.query('insert into public.sellers(id,user_id,store_name) values($1,$2,$3)',[otherSeller,other,'Other store'])
  const otherItem=await item('shipped');await db.query('update public.order_items set seller_id=$1 where id=$2',[otherSeller,otherItem])
  await as(vendor,()=>assert.rejects(rpc('cm_verify_delivery_code',[otherItem,'123456']),/not available/))
  await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Confirmed first vendor delivery']))
  assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[otherSeller])).rows[0].wallet_balance),0)
  assert.equal((await db.query('select released_at from public.order_items where id=$1',[otherItem])).rows[0].released_at,null)
  await as(vendor,async()=>assert.ok(!(await rpc('cm_order_tracking',[order])).some(r=>r.item_id===otherItem)))
})

test('admin notes remain private and a ledger failure rolls back the whole approval',async()=>{
  const id=await item('shipped');await handedOver(id)
  await as(admin,()=>rpc('cm_admin_hold_delivery',[id,'Private investigation detail',true]))
  await as(admin,()=>rpc('cm_admin_hold_delivery',[id,'Private investigation finished',false]))
  await as(buyer,async()=>assert.doesNotMatch(JSON.stringify(await rpc('cm_order_tracking',[order])),/Private investigation|admin_note/))
  await as(admin,async()=>assert.match(JSON.stringify(await rpc('cm_admin_delivery_queue',['pending',1])),/Private investigation detail/))
  const before=Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance)
  await db.exec("create function public.test_ledger_failure() returns trigger language plpgsql as $$begin raise exception 'Ledger unavailable';end$$;create trigger test_ledger_failure before insert on public.transactions for each row execute function public.test_ledger_failure()")
  try {await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'All delivery evidence checked']),/Ledger unavailable/))}
  finally {await db.exec('drop trigger test_ledger_failure on public.transactions;drop function public.test_ledger_failure()')}
  assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before)
  assert.equal((await db.query('select approved_at from public.order_deliveries where item_id=$1',[id])).rows[0].approved_at,null)
  assert.equal((await db.query('select released_at from public.order_items where id=$1',[id])).rows[0].released_at,null)
})

let testerNumber=0
const newTester=async()=>{const id=`bbbbbbbb-bbbb-4bbb-8bbb-${String(++testerNumber).padStart(12,'0')}`;await db.query('insert into public.users(id,full_name,email) values($1,$2,$3)',[id,'Trial buyer','trial@example.test']);return id}
const service=async fn=>{await db.exec('set role service_role');try{return await fn()}finally{await db.exec('reset role')}}
const trialArgs=(user,request=crypto.randomUUID(),total=1259.56)=>[user,request,[{product_id:product,quantity:1}],'pickup','','08012345678','Trial order',total]

test('trial checkout computes current prices and fees, is unpaid, and never reserves stock',async()=>{
  const tester=await newTester(),args=trialArgs(tester)
  await as(tester,()=>assert.rejects(rpc('cm_create_trial_order',args),/permission denied/))
  const stock=(await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity
  const result=await service(()=>rpc('cm_create_trial_order',args))
  assert.equal(result.total_amount,1259.56);assert.equal(result.is_trial,true)
  const saved=(await db.query('select * from public.orders where id=$1',[result.id])).rows[0]
  assert.equal(saved.payment_status,'unpaid');assert.equal(saved.payment_verified_at,null);assert.equal(saved.payment_ref,null)
  assert.equal(Number(saved.service_fee),25);assert.equal(Number(saved.delivery_fee),0)
  assert.equal((await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity,stock)
  await service(async()=>{
    assert.equal((await rpc('cm_create_trial_order',args)).id,result.id)
    await assert.rejects(rpc('cm_create_trial_order',args.map((v,i)=>i===6?'Changed note':v)),/attempt changed/)
  })
})

test('trial delivery reaches admin approval without creating real money or a payment verification',async()=>{
  const tester=await newTester(),result=await service(()=>rpc('cm_create_trial_order',trialArgs(tester)))
  const id=(await db.query('select id from public.order_items where order_id=$1',[result.id])).rows[0].id
  const moneyBefore=(await db.query('select wallet_balance,total_earned from public.sellers where id=$1',[seller])).rows[0]
  const txBefore=(await db.query('select count(*) n from public.transactions')).rows[0].n
  await as(vendor,async()=>{
    await rpc('cm_vendor_update_delivery',[id,'confirmed']);await rpc('cm_vendor_update_delivery',[id,'shipped'])
  })
  const code=await as(tester,()=>rpc('cm_issue_delivery_code',[id]))
  await as(vendor,()=>rpc('cm_verify_delivery_code',[id,code.code]))
  await as(tester,()=>rpc('cm_confirm_delivery',[id]))
  await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Checked trial handover and receipt']))
  const row=(await db.query('select * from public.order_items where id=$1',[id])).rows[0]
  assert.ok(row.released_at);assert.equal(Number(row.payout_amount),1172.83)
  assert.deepEqual((await db.query('select wallet_balance,total_earned from public.sellers where id=$1',[seller])).rows[0],moneyBefore)
  assert.equal((await db.query('select count(*) n from public.transactions')).rows[0].n,txBefore)
  assert.equal((await db.query('select payment_verified_at from public.orders where id=$1',[result.id])).rows[0].payment_verified_at,null)
  await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'Repeat approval']),/already been credited/))
  await assert.rejects(db.query("insert into public.transactions(seller_id,order_item_id,type,amount) values($1,$2,'earning',100)",[seller,id]),/cannot create real/)
})

test('trial orders cannot become real, paid or verified, and are private to participants',async()=>{
  const tester=await newTester(),result=await service(()=>rpc('cm_create_trial_order',trialArgs(tester)))
  await assert.rejects(db.query('update public.orders set is_trial=false where id=$1',[result.id]),/cannot switch/)
  await assert.rejects(db.query("update public.orders set payment_status='paid' where id=$1",[result.id]),/cannot be marked paid/)
  await assert.rejects(db.query("update public.orders set payment_verified_at=now(),payment_verification_ref='forged' where id=$1",[result.id]),/cannot be marked paid/)
  await as(other,async()=>assert.equal((await db.query('select id from public.orders where id=$1',[result.id])).rows.length,0))
  await as(vendor,async()=>{
    assert.equal((await db.query('select id from public.orders where id=$1',[result.id])).rows.length,1)
    assert.equal((await db.query('select id from public.order_items where order_id=$1',[result.id])).rows.length,1)
  })
})

test('trial checkout rejects stale totals, unavailable stock and invalid delivery inputs atomically',async()=>{
  const tester=await newTester()
  await service(async()=>{
    await assert.rejects(rpc('cm_create_trial_order',trialArgs(tester,crypto.randomUUID(),1)),/Prices changed/)
    const overstock=trialArgs(tester);overstock[2]=[{product_id:product,quantity:99}]
    await assert.rejects(rpc('cm_create_trial_order',overstock),/exceeds stock/)
    const duplicate=trialArgs(tester);duplicate[2].push(duplicate[2][0])
    await assert.rejects(rpc('cm_create_trial_order',duplicate),/duplicate/)
    const address=trialArgs(tester);address[3]='delivery';address[4]='a'
    await assert.rejects(rpc('cm_create_trial_order',address),/delivery address/)
  })
  assert.equal(Number((await db.query('select count(*) n from public.orders where user_id=$1',[tester])).rows[0].n),0)
  const delivery=trialArgs(tester,crypto.randomUUID(),1759.56);delivery[3]='delivery';delivery[4]='Hall A reception'
  assert.equal((await service(()=>rpc('cm_create_trial_order',delivery))).total_amount,1759.56)
})

test('trial fee waiver and rate limit are enforced by the server',async()=>{
  const tester=await newTester()
  await db.query('update public.products set price=20000 where id=$1',[product])
  try {
    for(let n=0;n<5;n++)await service(()=>rpc('cm_create_trial_order',trialArgs(tester,crypto.randomUUID(),20000)))
    await service(()=>assert.rejects(rpc('cm_create_trial_order',trialArgs(tester,crypto.randomUUID(),20000)),/five trial orders/))
    const row=(await db.query('select service_fee from public.orders where user_id=$1 limit 1',[tester])).rows[0]
    assert.equal(Number(row.service_fee),0)
  } finally {await db.query('update public.products set price=1234.56 where id=$1',[product])}
})

test('an unpaid trial dispute is visible to admin and refund approval cannot send real money',async()=>{
  const tester=await newTester(),result=await service(()=>rpc('cm_create_trial_order',trialArgs(tester)))
  const id=(await db.query('select id from public.order_items where order_id=$1',[result.id])).rows[0].id
  await as(vendor,async()=>{await rpc('cm_vendor_update_delivery',[id,'confirmed']);await rpc('cm_vendor_update_delivery',[id,'shipped'])})
  await as(tester,()=>rpc('cm_report_order_problem',[id,'Testing a trial item that never arrived']))
  await as(tester,()=>assert.rejects(rpc('cm_admin_order_disputes',[false]),/Admin access/))
  await as(admin,async()=>{
    const row=(await rpc('cm_admin_order_disputes',[false])).find(i=>i.item_id===id)
    assert.ok(row);assert.equal(row.is_trial,true)
    await rpc('cm_admin_resolve_delivery_dispute',[id,'refund','Trial refund decision for testing'])
    assert.ok((await rpc('cm_admin_order_disputes',[true])).some(i=>i.item_id===id))
    assert.ok(!(await rpc('cm_admin_order_disputes',[false])).some(i=>i.item_id===id))
  })
  assert.equal((await db.query('select * from public.transactions where order_item_id=$1',[id])).rows.length,0)
})

async function cancellationOrder({age=0,status='pending',trial=true,count=2}={}) {
  const id=crypto.randomUUID(),items=[]
  await db.query(`insert into public.orders(id,user_id,payment_status,status,is_trial,total_amount,created_at) values($1,$2,$3,'pending',$4,2500,now()-($5*interval '1 minute'))`,[id,buyer,trial?'unpaid':'paid',trial,age])
  for(let index=0;index<count;index++){
    const itemId=crypto.randomUUID();items.push(itemId)
    await db.query('insert into public.order_items(id,order_id,seller_id,product_id,quantity,unit_price,subtotal,fulfillment_status) values($1,$2,$3,$4,1,1234.56,1234.56,$5)',[itemId,id,seller,product,status])
  }
  return {id,items}
}
test('buyer cancellation is owner-only and never exposes the private audit table',async()=>{
  const {id}=await cancellationOrder()
  await as(other,()=>assert.rejects(rpc('cm_order_cancellation_quote',[id]),/not available/))
  await as(vendor,()=>assert.rejects(rpc('cm_cancel_buyer_order',[id]),/not available/))
  await as(buyer,()=>assert.rejects(db.query('select * from public.order_cancellations'),/permission denied/))
  assert.equal((await as(buyer,()=>rpc('cm_order_cancellation_quote',[id]))).can_cancel,true)
  await as(buyer,()=>assert.rejects(db.query("update public.orders set created_at=now()-interval '1 minute' where id=$1",[id]),/placement time/))
  await as(buyer,()=>assert.rejects(db.query("update public.orders set status='cancelled' where id=$1",[id]),/cancellation action/))
  await as(buyer,()=>assert.rejects(db.query('update public.orders set user_id=$1 where id=$2',[other,id]),/placement time/))
})
test('whole trial cancellation is atomic, idempotent and never creates money or stock',async()=>{
  const {id,items}=await cancellationOrder({status:'confirmed'})
  const beforeStock=(await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity
  const beforeMoney=(await db.query('select count(*) n from public.transactions')).rows[0].n
  const result=await as(buyer,()=>rpc('cm_cancel_buyer_order',[id,'Changed plans']))
  assert.equal(result.cancelled,true);assert.equal(result.refund_amount,0);assert.equal(result.retained_service_fee,0);assert.equal(result.refund_status,'not_charged')
  await as(buyer,()=>assert.rejects(db.query("update public.orders set status='pending' where id=$1",[id]),/cancellation action/))
  assert.equal((await db.query('select status from public.orders where id=$1',[id])).rows[0].status,'cancelled')
  assert.deepEqual((await db.query('select fulfillment_status from public.order_items where order_id=$1',[id])).rows.map(row=>row.fulfillment_status),['cancelled','cancelled'])
  await db.query("update public.orders set created_at=now()-interval '1 hour' where id=$1",[id])
  assert.equal((await as(buyer,()=>rpc('cm_cancel_buyer_order',[id]))).cancelled,true)
  assert.equal(Number((await db.query('select count(*) n from public.order_tracking_events where item_id=any($1::uuid[])',[items])).rows[0].n),2)
  assert.equal(Number((await db.query('select count(*) n from public.notifications where order_id=$1 and user_id=$2',[id,vendor])).rows[0].n),2)
  assert.equal((await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity,beforeStock)
  assert.equal((await db.query('select count(*) n from public.transactions')).rows[0].n,beforeMoney)
  await as(vendor,()=>assert.rejects(rpc('cm_vendor_update_delivery',[items[0],'confirmed']),/locked/))
  await as(buyer,()=>assert.rejects(rpc('cm_issue_delivery_code',[items[0]]),/available when/))
})
test('the server enforces the 30-minute boundary and dispatch for every item',async()=>{
  for(const options of [{age:30},{age:31},{status:'shipped'},{status:'delivered'},{status:'disputed'},{count:0}]){
    const {id}=await cancellationOrder(options)
    assert.equal((await as(buyer,()=>rpc('cm_order_cancellation_quote',[id]))).can_cancel,false)
    await as(buyer,()=>assert.rejects(rpc('cm_cancel_buyer_order',[id]),/window|item|order/i))
    assert.equal((await db.query('select status from public.orders where id=$1',[id])).rows[0].status,'pending')
  }
  const {id,items}=await cancellationOrder()
  assert.equal((await as(buyer,()=>rpc('cm_order_cancellation_quote',[id]))).can_cancel,true)
  await as(vendor,()=>rpc('cm_vendor_update_delivery',[items[1],'confirmed']))
  await as(vendor,()=>rpc('cm_vendor_update_delivery',[items[1],'shipped']))
  await as(buyer,()=>assert.rejects(rpc('cm_cancel_buyer_order',[id]),/dispatched/))
  assert.equal(Number((await db.query('select count(*) n from public.order_cancellations where order_id=$1',[id])).rows[0].n),0)
})
test('real paid cancellation fails closed until payment and inventory integration is connected',async()=>{
  const {id}=await cancellationOrder({trial:false})
  const quote=await as(buyer,()=>rpc('cm_order_cancellation_quote',[id]))
  assert.equal(quote.can_cancel,false);assert.match(quote.reason,/integration/)
  await as(buyer,()=>assert.rejects(rpc('cm_cancel_buyer_order',[id]),/integration/))
  const row=(await db.query('select status,payment_status from public.orders where id=$1',[id])).rows[0]
  assert.equal(row.status,'pending');assert.equal(row.payment_status,'paid')
})

test('Paystack payment, refund and payout migrations preserve financial invariants',async t=>{
  await db.exec(`create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.marketplace_consents(user_id uuid primary key,age_band text);
    insert into auth.users select id,email,now() from public.users;
    insert into public.marketplace_consents select id,'adult' from public.users;
    create function public.cm_consent_allows_trade(p_user uuid) returns boolean language sql stable as $$select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)$$;
    create function public.cm_consent_allows_selling(p_user uuid) returns boolean language sql stable as $$select public.cm_consent_allows_trade(p_user)$$;
    alter table public.sellers add column is_kyc_verified boolean default true,add column kyc_status text default 'approved';`)
  for(const file of ['202611010001_account_controls.sql','202611010005_paystack_payments.sql','202611010006_paystack_refunds_and_payouts.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
  const create=async(mode='test',requestId=crypto.randomUUID(),expected=10200,quantity=1)=>{
    await db.exec("update public.paystack_payments set created_at=now()-interval '2 hours'")
    await db.query("update public.products set price=10000,stock_quantity=10,status='active' where id=$1",[product])
    return rpc('cm_create_paystack_order',[buyer,requestId,[{product_id:product,quantity}],'pickup','','08012345678','Paystack test',expected,mode,true])
  }
  const verify=async(p,id=String(Math.floor(Math.random()*1000000000)+1))=>rpc('cm_verify_paystack_payment',[p.reference,id,Number(p.amount_kobo),'buyer@example.test','NGN',p.mode,25000])
  await t.test('server prices, reservations, adult checks and private grants',async()=>{
    const p=await create()
    assert.equal(Number(p.amount_kobo),1020000);assert.equal(Number(p.retain_fee_kobo),20000)
    assert.equal((await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity,9)
    const retry=await rpc('cm_create_paystack_order',[buyer,p.request_id,[{product_id:product,quantity:1}],'pickup','','08012345678','Paystack test',10200,'test',true])
    assert.equal(retry.order_id,p.order_id)
    await assert.rejects(create('test',crypto.randomUUID(),1),/Prices changed/)
    await as(buyer,()=>assert.rejects(db.query('select * from public.paystack_payments'),/permission denied/))
    await as(buyer,()=>assert.rejects(rpc('cm_verify_paystack_payment',[p.reference,'10',Number(p.amount_kobo),'buyer@example.test','NGN','test']),/permission denied/))
    await db.query("update public.marketplace_consents set age_band='under_18' where user_id=$1",[buyer])
    await assert.rejects(create(),/adult/)
    await db.query("update public.marketplace_consents set age_band='adult' where user_id=$1",[buyer])
  })
  await t.test('verification rejects wrong amount, payer, currency or mode and is replay-safe',async()=>{
    const p=await create()
    for(const args of [[1,'buyer@example.test','NGN','test'],[1020000,'other@example.test','NGN','test'],[1020000,'buyer@example.test','USD','test'],[1020000,'buyer@example.test','NGN','live']])await assert.rejects(rpc('cm_verify_paystack_payment',[p.reference,'100',...args]),/match/)
    await verify(p,'101');await verify(p,'101')
    await assert.rejects(verify(p,'102'),/different transaction/)
    assert.equal((await db.query('select payment_status from public.orders where id=$1',[p.order_id])).rows[0].payment_status,'paid')
    assert.equal((await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity,10)
    await as(buyer,()=>assert.rejects(db.query("update public.orders set payment_status='refunded' where id=$1",[p.order_id]),/payment service/))
  })
  await t.test('late verified payments queue full refunds without fulfilling or restoring stock twice',async()=>{
    const p=await create('live')
    await db.query("update public.paystack_payments set expires_at=now()-interval '1 minute' where order_id=$1",[p.order_id])
    await rpc('cm_expire_paystack_payment',[p.reference]);await rpc('cm_expire_paystack_payment',[p.reference])
    const before=(await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity
    await verify(p,'103')
    assert.equal((await db.query('select stock_quantity from public.products where id=$1',[product])).rows[0].stock_quantity,before)
    const jobs=(await db.query('select * from public.paystack_refunds where order_id=$1',[p.order_id])).rows
    assert.equal(jobs.length,1);assert.equal(Number(jobs[0].amount_kobo),1020000)
    assert.equal((await db.query('select status from public.orders where id=$1',[p.order_id])).rows[0].status,'cancelled')
  })
  await t.test('voluntary paid cancellation retains only the disclosed CampusMart fee and never lies about bank credit',async()=>{
    const p=await create('live');await verify(p,'104')
    const quote=await as(buyer,()=>rpc('cm_order_cancellation_quote',[p.order_id]))
    assert.equal(Number(quote.refund_amount),10000);assert.equal(Number(quote.retained_service_fee),200)
    await as(buyer,()=>rpc('cm_cancel_buyer_order',[p.order_id,'Changed plans']))
    await as(buyer,()=>rpc('cm_cancel_buyer_order',[p.order_id,'Retry']))
    const jobs=(await db.query('select * from public.paystack_refunds where order_id=$1',[p.order_id])).rows
    assert.equal(jobs.length,1);assert.equal(Number(jobs[0].amount_kobo),1000000);assert.equal(jobs[0].state,'queued')
    assert.equal((await db.query('select payment_status from public.orders where id=$1',[p.order_id])).rows[0].payment_status,'paid')
    await rpc('cm_paystack_refund_result',[jobs[0].id,'501','processed'])
    assert.equal((await db.query('select payment_status from public.orders where id=$1',[p.order_id])).rows[0].payment_status,'paid')
    assert.equal((await as(buyer,()=>rpc('cm_payment_summary',[p.order_id]))).refunds[0].status,'processed')
  })
  await t.test('reviewed full refunds and provider-fee deductions are separate from voluntary service fees',async()=>{
    const full=await create('live');await verify(full,'105')
    await as(buyer,()=>assert.rejects(rpc('cm_admin_queue_refund',[full.order_id,null,false,true,'Customer tried admin refund']),/Administrator/))
    const id=await as(admin,()=>rpc('cm_admin_queue_refund',[full.order_id,null,false,true,'Faulty item: full statutory remedy is owed.',1020000,0]))
    assert.equal(Number((await db.query('select amount_kobo from public.paystack_refunds where id=$1',[id])).rows[0].amount_kobo),1020000)
    await rpc('cm_paystack_refund_result',[id,'502','processed'])
    assert.equal((await db.query('select payment_status from public.orders where id=$1',[full.order_id])).rows[0].payment_status,'refunded')
    const partial=await create('live');await verify(partial,'106')
    await as(admin,()=>assert.rejects(rpc('cm_admin_queue_refund',[partial.order_id,null,true,true,'Stale preview must not create a refund.',995001,25000]),/changed|match|refresh/i))
    const deduct=await as(admin,()=>rpc('cm_admin_queue_refund',[partial.order_id,null,true,true,'Reviewed circumstances, prior disclosure and permitted deduction.',995000,25000]))
    const job=(await db.query('select * from public.paystack_refunds where id=$1',[deduct])).rows[0]
    assert.equal(Number(job.amount_kobo),995000);assert.equal(Number(job.processing_fee_retained_kobo),25000)
  })
  await t.test('test-domain delivery approvals never credit real vendor money',async()=>{
    const p=await create();await verify(p,'107')
    const id=(await db.query('select id from public.order_items where order_id=$1',[p.order_id])).rows[0].id
    await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'confirmed']));await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'shipped']));await handedOver(id)
    const before=Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance)
    await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Paystack test handover reviewed.']))
    assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before)
  })
  await t.test('live approved transfers reserve earnings once, require a beneficiary, and restore failures once',async()=>{
    const p=await create('live');await verify(p,'108')
    const id=(await db.query('select id from public.order_items where order_id=$1',[p.order_id])).rows[0].id
    await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'confirmed']));await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'shipped']));await handedOver(id)
    await as(admin,()=>assert.rejects(rpc('cm_admin_queue_transfer',[id,'Review beneficiary and earnings',true]),/approved/))
    await as(admin,()=>rpc('cm_admin_approve_delivery',[id,'Verified payment, buyer receipt and handover.']))
    await as(admin,()=>assert.rejects(rpc('cm_admin_queue_transfer',[id,'Review beneficiary and earnings',true]),/payout account/))
    await db.query("insert into public.paystack_recipients(seller_id,mode,recipient_code,account_name,bank_name,last_four) values($1,'live','RCP_test','Vendor Example','Test Bank','1234')",[seller])
    const version=(await db.query('select updated_at from public.paystack_recipients where seller_id=$1',[seller])).rows[0].updated_at
    const before=Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance)
    await as(admin,()=>assert.rejects(rpc('cm_admin_queue_transfer',[id,'Stale beneficiary was displayed.',true,new Date(0),950000]),/account changed/))
    const job=await as(admin,()=>rpc('cm_admin_queue_transfer',[id,'Beneficiary and approved earnings reviewed.',true,version,950000]))
    assert.equal(await as(admin,()=>rpc('cm_admin_queue_transfer',[id,'Retrying same approved payout.',true])),job)
    assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before-9500)
    assert.equal(await rpc('cm_claim_paystack_transfer',[job]),true);assert.equal(await rpc('cm_claim_paystack_transfer',[job]),false)
    await rpc('cm_paystack_transfer_result',[job,'TRF_example','failed']);await rpc('cm_paystack_transfer_result',[job,'TRF_example','failed'])
    assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before)
    const retry=await as(admin,()=>rpc('cm_admin_queue_transfer',[id,'Provider failure confirmed; retry reviewed.',true,version,950000]))
    assert.notEqual(retry,job)
    assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before-9500)
    await as(vendor,()=>assert.rejects(rpc('cm_cancel_unsent_transfer',[retry,'Vendor cannot cancel finance jobs.']),/Administrator/))
    await as(admin,()=>rpc('cm_cancel_unsent_transfer',[retry,'Cancelled before submission to the provider.']))
    await as(admin,()=>rpc('cm_cancel_unsent_transfer',[retry,'Repeated cancellation must not restore twice.']))
    assert.equal(Number((await db.query('select wallet_balance from public.sellers where id=$1',[seller])).rows[0].wallet_balance),before)
    await db.exec('grant select,update on public.sellers to authenticated')
    await as(vendor,()=>assert.rejects(db.query('update public.sellers set wallet_balance=999999 where id=$1',[seller]),/Financial/))
  })
  await t.test('waived service fees retain zero and paid dispatch blocks cancellation',async()=>{
    const p=await create('live',crypto.randomUUID(),20000,2);await verify(p,'109')
    const quote=await as(buyer,()=>rpc('cm_order_cancellation_quote',[p.order_id]));assert.equal(Number(quote.retained_service_fee),0);assert.equal(Number(quote.refund_amount),20000)
    const id=(await db.query('select id from public.order_items where order_id=$1',[p.order_id])).rows[0].id
    await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'confirmed']));await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'shipped']))
    await as(buyer,()=>assert.rejects(rpc('cm_cancel_buyer_order',[p.order_id]),/dispatched/))
  })
  await t.test('payout bank resolution is adult-vendor only and rate limited across modes',async()=>{
    await assert.rejects(rpc('cm_begin_payout_setup',[buyer,'test']),/vendor/)
    for(let n=0;n<5;n++)await rpc('cm_begin_payout_setup',[vendor,n%2?'live':'test'])
    await assert.rejects(rpc('cm_begin_payout_setup',[vendor,'live']),/Too many/)
  })
  await t.test('verification after a missed expiry still refunds rather than fulfilling stale reservations',async()=>{
    const p=await create('live');await db.query("update public.paystack_payments set expires_at=now()-interval '1 second' where order_id=$1",[p.order_id]);await verify(p,'110')
    assert.equal((await db.query('select status from public.orders where id=$1',[p.order_id])).rows[0].status,'cancelled')
    assert.equal(Number((await db.query('select amount_kobo from public.paystack_refunds where order_id=$1',[p.order_id])).rows[0].amount_kobo),1020000)
  })
  await t.test('provider review blocks approval even after an ordinary delivery hold is cleared',async()=>{
    const p=await create('live');await verify(p,'111');const id=(await db.query('select id from public.order_items where order_id=$1',[p.order_id])).rows[0].id
    await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'confirmed']));await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'shipped']));await handedOver(id)
    await rpc('cm_paystack_hold',[p.reference]);await as(admin,()=>rpc('cm_admin_hold_delivery',[id,'Cleared delivery-specific hold only.',false]))
    await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,'An ordinary hold release is not payment approval.']),/under review/))
    assert.equal((await db.query('select released_at from public.order_items where id=$1',[id])).rows[0].released_at,null)
  })
  await t.test('test payments cannot create purchase-verified reviews',async()=>{
    await create()
    const pid=crypto.randomUUID();await db.query("insert into public.products(id,title,seller_id,price,stock_quantity,status) values($1,'Test-only listing',$2,10000,10,'active')",[pid,seller])
    const p=await rpc('cm_create_paystack_order',[buyer,crypto.randomUUID(),[{product_id:pid,quantity:1}],'pickup','','08012345678','Test review guard',10200,'test',true]);await verify(p,'112')
    const id=(await db.query('select id from public.order_items where order_id=$1',[p.order_id])).rows[0].id
    await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'confirmed']));await as(vendor,()=>rpc('cm_vendor_update_delivery',[id,'shipped']));await handedOver(id)
    await as(buyer,()=>assert.rejects(rpc('cm_review_product',[pid,5,'No real purchase took place.']),/Only buyers/))
  })
  await t.test('payment migrations preserve trial cancellation and do not generate refund jobs for trials',async()=>{
    await db.query("update public.orders set created_at=now()-interval '1 hour' where is_trial")
    const trialOrder=await rpc('cm_create_trial_order',[buyer,crypto.randomUUID(),[{product_id:product,quantity:1}],'pickup','','08012345678','Trial after payments',10200])
    await as(buyer,()=>rpc('cm_cancel_buyer_order',[trialOrder.id]))
    assert.equal(Number((await db.query('select count(*) n from public.paystack_refunds where order_id=$1',[trialOrder.id])).rows[0].n),0)
  })

  await t.test('paid cancellation blocks closure until the net refund is processed',async()=>{
    const uid=crypto.randomUUID(),email='closure-buyer@example.test';await db.query('insert into auth.users values($1,$2,now())',[uid,email]);await db.query('insert into public.users(id,full_name,email) values($1,$2,$3)',[uid,'Closing buyer',email]);await db.query("insert into public.marketplace_consents values($1,'adult')",[uid]);
    const p=await rpc('cm_create_paystack_order',[uid,crypto.randomUUID(),[{product_id:product,quantity:1}],'pickup','','08012345678','Closure after refund',10200,'live',true]);await rpc('cm_verify_paystack_payment',[p.reference,'113',1020000,email,'NGN','live',18000]);await as(uid,()=>rpc('cm_cancel_buyer_order',[p.order_id]));
    const request=await as(uid,()=>rpc('cm_request_account_change',['close_account','Close after settlement.']));
    await as(admin,()=>assert.rejects(rpc('cm_admin_review_account_change',[request,'approve_closure','Refund has not yet reached final provider state.']),/pending refunds/));
    const job=(await db.query('select id from public.paystack_refunds where order_id=$1',[p.order_id])).rows[0].id;await rpc('cm_paystack_refund_result',[job,'703','processed']);
    await as(admin,()=>rpc('cm_admin_review_account_change',[request,'approve_closure','Refund processed and cancellation fee settled.']));assert.equal((await as(uid,()=>rpc('cm_account_status'))).active,false)
  })

  await t.test('password unlock and a per-decision PIN guard real finance functions without changing ledger rules',async()=>{
    await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function public.cm_admin_membership() returns boolean language sql stable as $$select auth.uid()='${admin}'::uuid$$;`)
    await db.exec(await readFile(new URL('../supabase/migrations/202611030002_admin_password_and_pin.sql',import.meta.url),'utf8'))
    const sid=crypto.randomUUID(),claims={session_id:sid,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]}
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)])
    await as(buyer,()=>assert.rejects(rpc('cm_unlock_admin'),/password/))
    await as(admin,async()=>{assert.equal(await rpc('is_admin'),false);await rpc('cm_unlock_admin');assert.equal(await rpc('is_admin'),true);assert.equal((await rpc('cm_admin_pin_status')).configured,false);await assert.rejects(rpc('cm_set_admin_pin',['111111']),/six digits/);assert.equal((await rpc('cm_set_admin_pin',['246810'])).ok,true)})
    const stored=(await db.query('select pin_hash from admin_pin_credentials where user_id=$1',[admin])).rows[0].pin_hash
    assert.ok(stored.startsWith('$2'));assert.notEqual(stored,'246810')
    await as(admin,()=>assert.rejects(db.query('select * from admin_pin_credentials'),/permission denied/))
    const p=await create('live');await verify(p)
    const id=(await db.query('select id from order_items where order_id=$1',[p.order_id])).rows[0].id
    await db.query("update order_items set fulfillment_status='shipped' where id=$1",[id]);await handedOver(id)
    const payload={p_item_id:id,p_note:'Reviewed payment, buyer receipt and delivery code.'}
    await as(admin,()=>assert.rejects(rpc('cm_admin_approve_delivery',[id,payload.p_note]),/transaction PIN/))
    for(let n=0;n<5;n++)assert.equal((await as(admin,()=>rpc('cm_admin_finance_decision',['approve_delivery',payload,'999999']))).ok,false)
    assert.equal((await as(admin,()=>rpc('cm_admin_finance_decision',['approve_delivery',payload,'246810']))).ok,false)
    assert.equal((await db.query('select released_at from order_items where id=$1',[id])).rows[0].released_at,null)
    await db.query("update admin_pin_credentials set locked_until=now()-interval '1 second' where user_id=$1",[admin])
    const before=Number((await db.query('select wallet_balance from sellers where id=$1',[seller])).rows[0].wallet_balance)
    assert.equal((await as(admin,()=>rpc('cm_admin_finance_decision',['approve_delivery',payload,'246810']))).ok,true)
    assert.equal(Math.round(Number((await db.query('select wallet_balance from sellers where id=$1',[seller])).rows[0].wallet_balance)*100)-Math.round(before*100),950000)
    await as(admin,()=>assert.rejects(rpc('cm_admin_finance_decision',['approve_delivery',payload,'246810']),/already/))
    const recipient=(await db.query("select updated_at::text stamp from paystack_recipients where seller_id=$1 and mode='live'",[seller])).rows[0]
    assert.ok(recipient)
    const transferPayload={p_item_id:id,p_note:'Reviewed beneficiary and payout amount.',p_confirmed:true,p_recipient_updated_at:recipient.stamp,p_expected_amount:950000}
    await as(admin,()=>assert.rejects(rpc('cm_admin_queue_transfer',[id,transferPayload.p_note,true,recipient.stamp,950000]),/transaction PIN/))
    const transfer=await as(admin,()=>rpc('cm_admin_finance_decision',['transfer',transferPayload,'246810']));assert.equal(transfer.ok,true)
    assert.equal((await as(admin,()=>rpc('cm_admin_finance_decision',['transfer',transferPayload,'246810']))).result,transfer.result)
    assert.equal(Number((await db.query('select count(*) n from admin_pin_permissions')).rows[0].n),0)
    await as(admin,()=>assert.rejects(rpc('cm_cancel_unsent_transfer',[transfer.result,'Cancel after checking existing provider status.']),/transaction PIN/))
    assert.equal((await as(admin,()=>rpc('cm_admin_finance_decision',['cancel_transfer',{p_id:transfer.result,p_note:'Cancel the queued transfer after reviewing its status.'},'246810']))).ok,true)
    await as(admin,async()=>{const wrong=await rpc('cm_set_admin_pin',['864209','999999']);assert.equal(wrong.ok,false);assert.equal((await rpc('cm_set_admin_pin',['864209','246810'])).ok,true)})
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({...claims,session_id:crypto.randomUUID()})])
    assert.equal(await as(admin,()=>rpc('is_admin')),false)
    await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({...claims,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)-400}]})]);await as(admin,()=>assert.rejects(rpc('cm_unlock_admin'),/password/))
  })

})
