import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'

const db=new PGlite()
const ids={guardian:'11111111-1111-4111-8111-111111111111',student:'22222222-2222-4222-8222-222222222222',admin:'33333333-3333-4333-8333-333333333333',stranger:'44444444-4444-4444-8444-444444444444',unconfirmed:'55555555-5555-4555-8555-555555555555',legacy:'66666666-6666-4666-8666-666666666666'}
const studentEmail='student@example.test'
let permission,studentOrder
const as=async(id,run)=>{await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}'`);try{return await run()}finally{await db.exec('reset role')}}
const rpc=async(name,args=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result
async function signup(id,email,metadata={},confirmed=true){
  await db.query('insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,$4)',[id,email,metadata,confirmed?new Date():null])
  await db.query('insert into public.users(id,full_name,email) values($1,$2,$3)',[id,email.split('@')[0],email])
}
before(async()=>{
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table public.users(id uuid primary key,full_name text,email text);
    create table public.sellers(id uuid primary key default gen_random_uuid(),user_id uuid,store_name text);
    create table public.products(id uuid primary key default gen_random_uuid(),seller_id uuid,status text);
    create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid,status text default 'pending');
    create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,seller_id uuid,fulfillment_status text default 'pending');
    create table public.buyer_conversations(id uuid primary key default gen_random_uuid(),buyer_id uuid);
    create table public.buyer_messages(id uuid primary key default gen_random_uuid(),sender_id uuid,body text);
    create table public.test_inactive_accounts(user_id uuid primary key);
    create table public.account_access(user_id uuid primary key,closed_at timestamptz);
    create function public.cm_account_is_active(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select p_user is not null and not exists(select 1 from public.test_inactive_accounts where user_id=p_user) and not exists(select 1 from public.account_access where user_id=p_user and closed_at is not null)$$;
    create function public.is_admin() returns boolean language sql stable as $$select auth.uid()='${ids.admin}'::uuid$$;
    grant select,insert,update on public.sellers,public.products,public.orders,public.order_items,public.buyer_conversations,public.buyer_messages to authenticated;
  `)
  await signup(ids.legacy,'legacy@example.test')
  await db.exec(await readFile(new URL('../supabase/migrations/202611010002_marketplace_consent.sql',import.meta.url),'utf8'))
  await signup(ids.guardian,'guardian@example.test',{age_band:'adult',terms_accepted:true})
  await signup(ids.admin,'admin@example.test',{age_band:'adult',terms_accepted:true})
  await signup(ids.stranger,'stranger@example.test',{age_band:'adult',terms_accepted:true})
  await signup(ids.unconfirmed,'unconfirmed@example.test',{age_band:'adult',terms_accepted:true},false)
})
after(()=>db.close())

test('unknown and unconfirmed accounts cannot trade or request guardian permission',async()=>{
  await as(ids.legacy,async()=>{
    const status=await rpc('cm_consent_status');assert.equal(status.accepted,false);assert.equal(status.eligible,false)
    await assert.rejects(db.query('insert into public.orders(user_id) values($1)',[ids.legacy]),/Review your account permissions/)
  })
  await as(ids.unconfirmed,async()=>{
    assert.equal((await rpc('cm_consent_status')).eligible,false)
    await assert.rejects(rpc('cm_accept_marketplace_terms',['adult',true,null]),/Confirm your sign-in email/)
    await assert.rejects(rpc('cm_request_guardian_permission',[studentEmail,'parent',true]),/confirmed adult account/)
  })
})
test('new accounts cannot be created without explicit age and terms declarations, including unknown OAuth signups',async()=>{
  const pending='77777777-7777-4777-8777-777777777777'
  for(const metadata of [{},{full_name:'Google account',provider:'google'},{terms_accepted:true},{age_band:'adult'},{age_band:'adult',terms_accepted:false},{age_band:'unknown',terms_accepted:true}]){
    await assert.rejects(signup(pending,'not-created@example.test',metadata),/email registration form/)
    assert.equal(Number((await db.query('select count(*) n from auth.users where id=$1',[pending])).rows[0].n),0)
    assert.equal(Number((await db.query('select count(*) n from public.marketplace_consents where user_id=$1',[pending])).rows[0].n),0)
  }
})
test('accounts that existed before the migration remain usable after explicit current terms acceptance',async()=>{
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{provider:'google',full_name:'Existing account'},ids.legacy])
  await as(ids.legacy,async()=>{
    assert.equal((await rpc('cm_consent_status')).accepted,false)
    await assert.rejects(rpc('cm_accept_marketplace_terms',['adult',false,null]),/accept the terms/)
    await rpc('cm_accept_marketplace_terms',['adult',true,null])
    assert.equal((await rpc('cm_consent_status')).eligible,true)
    const order=(await db.query('insert into public.orders(user_id) values($1) returning terms_version,terms_accepted_at',[ids.legacy])).rows[0]
    assert.equal(order.terms_version,'2026-11-01');assert.ok(order.terms_accepted_at)
  })
})
test('minor signup requires an approved guardian permission matching the student email',async()=>{
  await assert.rejects(signup(ids.student,studentEmail,{age_band:'under_18',terms_accepted:true}),/Guardian permission must be approved/)
  assert.equal(Number((await db.query('select count(*) n from auth.users where id=$1',[ids.student])).rows[0].n),0)
  permission=await as(ids.guardian,()=>rpc('cm_request_guardian_permission',[studentEmail.toUpperCase(),'parent',true]))
  await assert.rejects(signup(ids.student,studentEmail,{age_band:'under_18',terms_accepted:true,guardian_request_id:permission}),/Guardian permission must be approved/)
  await as(ids.admin,()=>rpc('cm_admin_review_guardian',[permission,true,true,'Identity, authority and permission reviewed.']))
  await assert.rejects(signup(ids.student,'different@example.test',{age_band:'under_18',terms_accepted:true,guardian_request_id:permission}),/Guardian permission must be approved/)
  assert.equal(Number((await db.query('select count(*) n from auth.users where id=$1',[ids.student])).rows[0].n),0)
})
test('guardian requests require adult consent and store only a normalized hash of the student email',async()=>{
  const row=(await db.query('select * from public.guardian_permissions where id=$1',[permission])).rows[0]
  assert.equal(row.student_email_hash,createHash('sha256').update(studentEmail).digest('hex'))
  assert.equal(row.guardian_id,ids.guardian)
  assert.equal(row.allows_selling,false)
  assert.equal(JSON.stringify(row).includes(studentEmail),false)
  await as(ids.guardian,async()=>{
    assert.equal(await rpc('cm_request_guardian_permission',[studentEmail,'parent',true]),permission)
    await assert.rejects(rpc('cm_request_guardian_permission',[studentEmail,'parent',true,true]),/Accept the vendor terms/)
    await assert.rejects(rpc('cm_request_guardian_permission',['guardian@example.test','parent',true]),/separate sign-in email/)
    await assert.rejects(rpc('cm_request_guardian_permission',['another@example.test','parent',false]),/Parent or legal guardian permission/)
    await assert.rejects(rpc('cm_request_guardian_permission',['another@example.test','friend',true]),/Parent or legal guardian permission/)
  })
})
test('only an admin can approve and approval requires verified identity, authority and a recorded note',async()=>{
  const request=await as(ids.guardian,()=>rpc('cm_request_guardian_permission',['another-student@example.test','legal_guardian',true]))
  await as(ids.stranger,()=>assert.rejects(rpc('cm_admin_review_guardian',[request,true,true,'Attempted unauthorized approval.']),/Administrator access/))
  await as(ids.admin,async()=>{
    await assert.rejects(rpc('cm_admin_review_guardian',[request,true,false,'The verification has not been done.']),/Check guardian identity/)
    await assert.rejects(rpc('cm_admin_review_guardian',[request,true,true,'short']),/10 to 1,000/)
    assert.equal((await rpc('cm_admin_guardian_queue')).some(row=>row.id===request),true)
    await rpc('cm_admin_review_guardian',[request,false,false,'Unable to verify parental authority.'])
    await assert.rejects(rpc('cm_admin_review_guardian',[request,true,true,'Attempt to overwrite a recorded decision.']),/already been reviewed/)
  })
})
test('an administrator cannot approve their own guardian request',async()=>{
  const own=await as(ids.admin,()=>rpc('cm_request_guardian_permission',['admin-student@example.test','parent',true]))
  await as(ids.admin,()=>assert.rejects(rpc('cm_admin_review_guardian',[own,true,true,'I reviewed my own parental authority.']),/Another administrator/))
  assert.equal((await db.query('select state from public.guardian_permissions where id=$1',[own])).rows[0].state,'pending')
})
test('guardian approval is blocked when the guardian account became inactive after requesting permission',async()=>{
  const request=await as(ids.guardian,()=>rpc('cm_request_guardian_permission',['closed-guardian-student@example.test','parent',true]))
  await db.query('insert into public.test_inactive_accounts(user_id) values($1)',[ids.guardian])
  try {
    await as(ids.admin,()=>assert.rejects(rpc('cm_admin_review_guardian',[request,true,true,'The guardian identity was reviewed.']),/active, confirmed account/))
    assert.equal((await db.query('select state from public.guardian_permissions where id=$1',[request])).rows[0].state,'pending')
  } finally {await db.query('delete from public.test_inactive_accounts where user_id=$1',[ids.guardian])}
})
test('approved students can trade, cannot change their age band or self-approve, and auth metadata grants no authority',async()=>{
  await signup(ids.student,studentEmail,{age_band:'under_18',terms_accepted:true,guardian_request_id:permission})
  studentOrder=await as(ids.student,async()=>{
    const status=await rpc('cm_consent_status');assert.equal(status.age_band,'under_18');assert.equal(status.accepted,true);assert.equal(status.eligible,true)
    const id=(await db.query('insert into public.orders(user_id) values($1) returning id',[ids.student])).rows[0].id
    await db.query('insert into public.buyer_conversations(buyer_id) values($1)',[ids.student])
    await db.query('insert into public.buyer_messages(sender_id,body) values($1,$2)',[ids.student,'Can I arrange pickup?'])
    await assert.rejects(rpc('cm_accept_marketplace_terms',['adult',true,null]),/correct your recorded age band/)
    await assert.rejects(rpc('cm_admin_review_guardian',[permission,true,true,'Self approval is not permitted.']),/Administrator access/)
    await assert.rejects(rpc('cm_request_guardian_permission',['someone@example.test','parent',true]),/confirmed adult account/)
    await assert.rejects(rpc('cm_accept_vendor_terms',[true]),/guardian to authorize selling/)
    await assert.rejects(db.query("update public.marketplace_consents set age_band='adult',guardian_request_id=null where user_id=$1",[ids.student]),/permission denied/)
    return id
  })
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{age_band:'adult',role:'admin',terms_accepted:true},ids.student])
  await as(ids.student,async()=>{
    assert.equal((await rpc('cm_consent_status')).age_band,'under_18')
    await assert.rejects(rpc('cm_admin_guardian_queue'),/Administrator access/)
  })
})
test('private consent rows are readable only by their owner and cannot be forged directly',async()=>{
  await as(ids.student,async()=>{
    assert.equal((await db.query('select * from public.marketplace_consents')).rows.length,1)
    assert.equal((await db.query('select * from public.guardian_permissions')).rows.length,0)
    assert.equal((await db.query('select * from public.marketplace_consent_events')).rows.every(row=>row.user_id===ids.student),true)
    await assert.rejects(db.query("insert into public.marketplace_consents(user_id,age_band,terms_version) values($1,'adult','2026-11-01')",[ids.student]),/permission denied/)
  })
  await as(ids.stranger,async()=>{
    assert.equal((await db.query('select * from public.guardian_permissions')).rows.length,0)
    assert.equal((await db.query('select * from public.marketplace_consents where user_id=$1',[ids.student])).rows.length,0)
    await assert.rejects(rpc('cm_withdraw_guardian_permission',[permission]),/not available for withdrawal/)
    await assert.rejects(rpc('cm_permission_matches',[permission,studentEmail]),/permission denied/)
  })
})
test('vendor terms are explicit and required before a store opens or listings are published',async()=>{
  await as(ids.guardian,async()=>{
    await assert.rejects(db.query('insert into public.sellers(user_id,store_name) values($1,$2)',[ids.guardian,'Guardian store']),/vendor needs current terms/)
    await assert.rejects(rpc('cm_accept_vendor_terms',[false]),/accept the vendor terms/)
    await rpc('cm_accept_vendor_terms',[true])
    const store=(await db.query('insert into public.sellers(user_id,store_name) values($1,$2) returning id',[ids.guardian,'Guardian store'])).rows[0].id
    await db.query("insert into public.products(seller_id,status) values($1,'active')",[store])
    assert.equal((await rpc('cm_consent_status')).vendor_terms,true)
    assert.equal((await db.query("select count(*) n from public.marketplace_consent_events where purpose='vendor_terms'")).rows[0].n,1)
  })
})
test('buyer-only guardian permission cannot be silently upgraded to selling',async()=>{
  await as(ids.guardian,()=>assert.rejects(rpc('cm_request_guardian_permission',[studentEmail,'parent',true,true]),/Withdraw the existing permission/))
  const row=(await db.query('select state,allows_selling from public.guardian_permissions where id=$1',[permission])).rows[0]
  assert.equal(row.state,'approved');assert.equal(row.allows_selling,false)
  await as(ids.student,async()=>{
    assert.equal((await rpc('cm_consent_status')).selling_eligible,false)
    await assert.rejects(rpc('cm_accept_vendor_terms',[true]),/guardian to authorize selling/)
  })
})
test('reviewed minor selling permits a store; withdrawal unpublishes and blocks new sales while fulfillment continues',async()=>{
  const youngVendor='88888888-8888-4888-8888-888888888888'
  const email='young-vendor@example.test'
  const selling=await as(ids.guardian,()=>rpc('cm_request_guardian_permission',[email,'parent',true,true]))
  const metadata={age_band:'under_18',terms_accepted:true,guardian_request_id:selling}
  await assert.rejects(signup(youngVendor,email,metadata),/Guardian permission must be approved/)
  await as(ids.admin,()=>rpc('cm_admin_review_guardian',[selling,true,true,'Identity, authority and specific selling permission reviewed.']))
  await signup(youngVendor,email,metadata)
  const store=await as(youngVendor,async()=>{
    const status=await rpc('cm_consent_status');assert.equal(status.selling_eligible,true);assert.equal(status.vendor_terms,false)
    await assert.rejects(db.query('insert into public.sellers(user_id,store_name) values($1,$2)',[youngVendor,'Student store']),/vendor needs current terms/)
    await rpc('cm_accept_vendor_terms',[true])
    const id=(await db.query('insert into public.sellers(user_id,store_name) values($1,$2) returning id',[youngVendor,'Student store'])).rows[0].id
    await db.query("insert into public.products(seller_id,status) values($1,'active')",[id])
    return id
  })
  const draft=(await db.query("insert into public.products(seller_id,status) values($1,'inactive') returning id",[store])).rows[0].id
  const published=(await db.query("select id from public.products where seller_id=$1 and status='active'",[store])).rows[0].id
  const order=await as(ids.stranger,async()=>(await db.query('insert into public.orders(user_id) values($1) returning id',[ids.stranger])).rows[0].id)
  const item=await as(ids.stranger,async()=>(await db.query('insert into public.order_items(order_id,seller_id) values($1,$2) returning id',[order,store])).rows[0].id)
  await db.query('insert into public.test_inactive_accounts(user_id) values($1)',[ids.guardian])
  try {
    await as(ids.stranger,()=>assert.rejects(db.query('insert into public.order_items(order_id,seller_id) values($1,$2)',[order,store]),/Review your account permissions/))
  } finally {await db.query('delete from public.test_inactive_accounts where user_id=$1',[ids.guardian])}
  await as(ids.guardian,()=>rpc('cm_withdraw_guardian_permission',[selling]))
  assert.equal((await db.query('select status from public.products where id=$1',[published])).rows[0].status,'draft')
  await as(ids.stranger,()=>assert.rejects(db.query('insert into public.order_items(order_id,seller_id) values($1,$2)',[order,store]),/Review your account permissions/))
  await as(youngVendor,async()=>{
    await db.query("update public.order_items set fulfillment_status='delivered' where id=$1",[item])
    assert.equal((await db.query('select fulfillment_status from public.order_items where id=$1',[item])).rows[0].fulfillment_status,'delivered')
    assert.equal((await rpc('cm_consent_status')).selling_eligible,false)
    await assert.rejects(db.query("insert into public.products(seller_id,status) values($1,'active')",[store]),/Review your account permissions/)
    await assert.rejects(db.query("update public.products set status='active' where id=$1",[draft]),/Review your account permissions/)
    await db.query("update public.products set status='inactive' where seller_id=$1",[store])
  })
})
test('closing a guardian account drafts dependent store listings and blocks new sales; reopening does not republish',async()=>{
  const dependent='99999999-9999-4999-8999-999999999999'
  const email='guardian-closure-student@example.test'
  const reference=await as(ids.guardian,()=>rpc('cm_request_guardian_permission',[email,'parent',true,true]))
  await as(ids.admin,()=>rpc('cm_admin_review_guardian',[reference,true,true,'Adult identity, authority and store oversight reviewed.']))
  await signup(dependent,email,{age_band:'under_18',terms_accepted:true,guardian_request_id:reference})
  const store=await as(dependent,async()=>{
    await rpc('cm_accept_vendor_terms',[true])
    return (await db.query('insert into public.sellers(user_id,store_name) values($1,$2) returning id',[dependent,'Dependent student store'])).rows[0].id
  })
  const product=await as(dependent,async()=>(await db.query("insert into public.products(seller_id,status) values($1,'active') returning id",[store])).rows[0].id)
  const order=await as(ids.stranger,async()=>(await db.query('insert into public.orders(user_id) values($1) returning id',[ids.stranger])).rows[0].id)
  const item=await as(ids.stranger,async()=>(await db.query('insert into public.order_items(order_id,seller_id) values($1,$2) returning id',[order,store])).rows[0].id)
  await db.query('insert into public.account_access(user_id,closed_at) values($1,now())',[ids.guardian])
  try {
    assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
    assert.equal(await as(dependent,async()=>(await rpc('cm_consent_status')).selling_eligible),false)
    await as(ids.stranger,()=>assert.rejects(db.query('insert into public.order_items(order_id,seller_id) values($1,$2)',[order,store]),/Review your account permissions/))
    await as(dependent,()=>db.query("update public.order_items set fulfillment_status='delivered' where id=$1",[item]))
    assert.equal((await db.query('select fulfillment_status from public.order_items where id=$1',[item])).rows[0].fulfillment_status,'delivered')
    await db.query('update public.account_access set closed_at=null where user_id=$1',[ids.guardian])
    assert.equal(await as(dependent,async()=>(await rpc('cm_consent_status')).selling_eligible),true)
    assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
    await as(dependent,()=>db.query("update public.products set status='active' where id=$1",[product]))
    await db.query('update public.account_access set closed_at=now() where user_id=$1',[ids.guardian])
    assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
  } finally {await db.query('update public.account_access set closed_at=null where user_id=$1',[ids.guardian])}
  assert.equal((await db.query('select status from public.products where id=$1',[product])).rows[0].status,'draft')
})
test('an inactive guardian account makes existing student permission ineligible without blocking fulfillment',async()=>{
  await db.query('insert into public.test_inactive_accounts(user_id) values($1)',[ids.guardian])
  await as(ids.student,async()=>{
    assert.equal((await rpc('cm_consent_status')).eligible,false)
    await assert.rejects(db.query('insert into public.orders(user_id) values($1)',[ids.student]),/Review your account permissions/)
    await db.query("update public.orders set status='confirmed' where id=$1",[studentOrder])
    assert.equal((await db.query('select status from public.orders where id=$1',[studentOrder])).rows[0].status,'confirmed')
  })
  await db.query('delete from public.test_inactive_accounts where user_id=$1',[ids.guardian])
  assert.equal(await as(ids.student,async()=>(await rpc('cm_consent_status')).eligible),true)
})
test('guardian withdrawal blocks new orders and messages but preserves existing fulfillment updates',async()=>{
  await as(ids.guardian,()=>rpc('cm_withdraw_guardian_permission',[permission]))
  await as(ids.student,async()=>{
    assert.equal((await rpc('cm_consent_status')).eligible,false)
    await assert.rejects(db.query('insert into public.orders(user_id) values($1)',[ids.student]),/Review your account permissions/)
    await assert.rejects(db.query('insert into public.buyer_conversations(buyer_id) values($1)',[ids.student]),/Review your account permissions/)
    await assert.rejects(db.query('insert into public.buyer_messages(sender_id,body) values($1,$2)',[ids.student,'A new message']),/Review your account permissions/)
    await db.query("update public.orders set status='delivered' where id=$1",[studentOrder])
    assert.equal((await db.query('select status from public.orders where id=$1',[studentOrder])).rows[0].status,'delivered')
    await assert.rejects(rpc('cm_accept_marketplace_terms',['under_18',true,permission]),/reviewed guardian permission/)
  })
})
