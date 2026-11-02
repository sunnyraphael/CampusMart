begin;
create table public.paystack_recipients(
  seller_id uuid not null references public.sellers(id),mode text not null check(mode in ('test','live')),
  recipient_code text not null,account_name text not null,bank_name text not null,last_four text not null check(last_four~'^[0-9]{4}$'),updated_at timestamptz not null default now(),primary key(seller_id,mode)
);
create table public.paystack_transfers(
  id uuid primary key default gen_random_uuid(),item_id uuid not null references public.order_items(id),seller_id uuid not null references public.sellers(id),
  reference text not null unique,mode text not null check(mode in ('test','live')),amount_kobo bigint not null check(amount_kobo>0),recipient_code text not null,
  account_name text not null,bank_name text not null,last_four text not null,actor_id uuid not null references public.users(id),note text not null,
  state text not null default 'queued' check(state in ('queued','submitting','pending','success','failed','reversed','otp','uncertain','blocked','abandoned')),
  provider_code text unique,wallet_restored boolean not null default false,cancelled_by uuid references public.users(id),cancelled_note text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index paystack_one_active_transfer on public.paystack_transfers(item_id) where state not in ('failed','reversed','abandoned');
alter table public.paystack_refunds add column processing_fee_retained_kobo bigint not null default 0 check(processing_fee_retained_kobo>=0);
alter table public.paystack_recipients enable row level security;
alter table public.paystack_transfers enable row level security;
revoke all on public.paystack_recipients,public.paystack_transfers from public,anon,authenticated;
grant all on public.paystack_recipients,public.paystack_transfers to service_role;
create table public.paystack_account_changes(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users(id),mode text not null check(mode in ('test','live')),created_at timestamptz not null default now());
alter table public.paystack_account_changes enable row level security;
revoke all on public.paystack_account_changes from public,anon,authenticated;
grant all on public.paystack_account_changes to service_role;
create index paystack_account_changes_user_date on public.paystack_account_changes(user_id,created_at);
create function public.cm_begin_payout_setup(p_user_id uuid,p_mode text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.users where id=p_user_id for update;
  if p_mode is null or p_mode not in ('test','live') or not public.cm_consent_allows_selling(p_user_id) or not exists(select 1 from public.marketplace_consents where user_id=p_user_id and age_band='adult') or not exists(select 1 from public.sellers where user_id=p_user_id) then raise exception 'An eligible adult vendor is required.';end if;
  if (select count(*) from public.paystack_account_changes where user_id=p_user_id and created_at>now()-interval '1 hour')>=5 then raise exception 'Too many payout-account attempts. Wait one hour before trying again.';end if;
  insert into public.paystack_account_changes(user_id,mode) values(p_user_id,p_mode);
end $$;
revoke all on function public.cm_begin_payout_setup(uuid,text) from public,anon,authenticated;
grant execute on function public.cm_begin_payout_setup(uuid,text) to service_role;

create function public.cm_protect_seller_finance() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and
    ((tg_op='INSERT' and (coalesce(new.wallet_balance,0)<>0 or coalesce(new.total_earned,0)<>0 or coalesce((to_jsonb(new)->>'is_kyc_verified')::boolean,false) or to_jsonb(new)->>'kyc_status'='approved')) or
    (tg_op='UPDATE' and (new.wallet_balance is distinct from old.wallet_balance or new.total_earned is distinct from old.total_earned or
      to_jsonb(new)->'is_kyc_verified' is distinct from to_jsonb(old)->'is_kyc_verified' or to_jsonb(new)->'kyc_status' is distinct from to_jsonb(old)->'kyc_status'))) then raise exception 'Financial balances and verification are managed by the payment and verification services.'; end if;
  return new;
end $$;
create trigger cm_protect_seller_finance before insert or update on public.sellers for each row execute function public.cm_protect_seller_finance();

create function public.cm_admin_queue_refund(p_order_id uuid,p_item_id uuid default null,p_deduct_processing boolean default false,p_reviewed boolean default false,p_note text default null,p_expected_amount bigint default null,p_expected_fee bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.paystack_payments;i public.order_items;r record;v_gross bigint;v_fee bigint:=0;v_total numeric;v_id uuid;v_key text;v_previous bigint;v_previous_fee bigint;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Administrator access required.'; end if;
  if p_reviewed is not true or coalesce(length(btrim(p_note)),0) not between 10 and 1000 then raise exception 'Review consumer rights, the amount and the fee treatment, and record a reason.'; end if;
  perform 1 from public.order_items where order_id=p_order_id order by id for update;
  perform 1 from public.orders where id=p_order_id for update;
  select * into p from public.paystack_payments where order_id=p_order_id for update;
  if not found or p.provider_id is null or p.state not in ('paid','review') then raise exception 'A verified payment is required for a refund.'; end if;
  v_key:=case when p_item_id is null then 'admin-order:'||p_order_id else 'admin-item:'||p_item_id end;
  select id into v_id from public.paystack_refunds where dedup_key=v_key;
  if found then return v_id; end if;
  if exists(select 1 from public.order_items where order_id=p_order_id and (p_item_id is null or id=p_item_id) and released_at is not null) then raise exception 'Vendor funds were already credited. Reconcile and recover those funds before refunding.'; end if;
  if p_deduct_processing and p.provider_fee_kobo is null then raise exception 'The actual provider fee has not been verified. Do not guess a deduction.'; end if;
  select coalesce(sum(amount_kobo),0) into v_previous from public.paystack_refunds where order_id=p_order_id;
  if p_item_id is null then
    if exists(select 1 from public.paystack_refunds where order_id=p_order_id and state<>'processed') then raise exception 'Reconcile earlier refunds before refunding the remaining order balance.'; end if;
    v_gross:=p.amount_kobo-v_previous;
    if p_deduct_processing then
      select coalesce(sum(processing_fee_retained_kobo),0) into v_previous_fee from public.paystack_refunds where order_id=p_order_id;
      v_gross:=v_gross-v_previous_fee;v_fee:=greatest(0,p.provider_fee_kobo-v_previous_fee);
    end if;
  else
    select * into i from public.order_items where id=p_item_id and order_id=p_order_id;
    if not found or i.fulfillment_status not in ('disputed','refunded') then raise exception 'Review the item dispute before requesting an item refund.'; end if;
    if exists(select 1 from public.paystack_refunds where order_id=p_order_id and (item_id=p_item_id or item_id is null)) then raise exception 'This item or order already has a refund request.'; end if;
    select sum(subtotal) into v_total from public.order_items where order_id=p_order_id;
    -- Allocate order charges in kobo. The last item receives rounding remainders.
    if i.id=(select max(id::text)::uuid from public.order_items where order_id=p_order_id) then
      select p.amount_kobo-coalesce(sum(floor(p.amount_kobo*subtotal/v_total)),0) into v_gross from public.order_items where order_id=p_order_id and id<>i.id;
      if p_deduct_processing then select p.provider_fee_kobo-coalesce(sum(floor(p.provider_fee_kobo*subtotal/v_total)),0) into v_fee from public.order_items where order_id=p_order_id and id<>i.id; end if;
    else v_gross:=floor(p.amount_kobo*i.subtotal/v_total);if p_deduct_processing then v_fee:=floor(p.provider_fee_kobo*i.subtotal/v_total);end if; end if;
  end if;
  if v_gross-v_fee<=0 or v_gross-v_fee+v_previous>p.amount_kobo then raise exception 'The refund amount requires manual reconciliation.'; end if;
  if p_expected_amount is distinct from v_gross-v_fee or p_expected_fee is distinct from v_fee then raise exception 'The refund amount changed. Refresh and review the exact amount and deduction again.';end if;
  insert into public.paystack_refunds(order_id,item_id,dedup_key,amount_kobo,processing_fee_retained_kobo,note)
    values(p_order_id,p_item_id,v_key,v_gross-v_fee,v_fee,btrim(p_note)) returning id into v_id;
  if p_item_id is null then
    if not p.stock_released and not exists(select 1 from public.order_items where order_id=p_order_id and fulfillment_status not in ('pending','confirmed')) then perform public.cm_paystack_restore_stock(p_order_id);end if;
    update public.orders set status='cancelled' where id=p_order_id;
  end if;
  update public.order_items set fulfillment_status='refunded',auto_release_at=null where order_id=p_order_id and (p_item_id is null or id=p_item_id);
  for r in select id from public.order_items where order_id=p_order_id and (p_item_id is null or id=p_item_id) loop
    perform public.cm_delivery_event(r.id,'refund_requested','Admin approved a refund request. Bank credit is not yet confirmed.',btrim(p_note));
  end loop;
  return v_id;
end $$;

create function public.cm_admin_queue_transfer(p_item_id uuid,p_note text,p_confirmed boolean,p_recipient_updated_at timestamptz default null,p_expected_amount bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.order_items;o public.orders;p public.paystack_payments;s public.sellers;r public.paystack_recipients;v_id uuid;v_amount bigint;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Administrator access required.'; end if;
  if p_confirmed is not true or coalesce(length(btrim(p_note)),0) not between 10 and 1000 then raise exception 'Check the beneficiary and record your transfer review.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  select * into o from public.orders where id=i.order_id for update;
  select * into p from public.paystack_payments where order_id=i.order_id for update;
  select id into v_id from public.paystack_transfers where item_id=p_item_id and state not in ('failed','reversed','abandoned');
  if found then return v_id;end if;
  if p.state is distinct from 'paid' or p.provider_id is null or o.payment_status is distinct from 'paid' or i.released_at is null or i.fulfillment_status is distinct from 'received' or
    not exists(select 1 from public.order_deliveries where item_id=i.id and approved_at is not null and code_verified_at is not null and buyer_confirmed_at is not null and held_at is null) then raise exception 'Payment and delivery must be verified and admin-approved before a transfer.'; end if;
  if exists(select 1 from public.paystack_refunds where order_id=i.order_id and (item_id is null or item_id=i.id)) then raise exception 'This order has a refund request. Reconcile it before paying the vendor.'; end if;
  select * into s from public.sellers where id=i.seller_id for update;
  if not public.cm_consent_allows_selling(s.user_id) or not exists(select 1 from public.marketplace_consents where user_id=s.user_id and age_band='adult') or
    not (coalesce((to_jsonb(s)->>'is_kyc_verified')::boolean,false) or coalesce(to_jsonb(s)->>'kyc_status','')='approved') then raise exception 'An eligible adult vendor with reviewed verification is required.';end if;
  select * into r from public.paystack_recipients where seller_id=s.id and mode=p.mode for share;
  if not found then raise exception 'The vendor must configure a resolved payout account in this payment environment.';end if;
  if r.updated_at is distinct from p_recipient_updated_at then raise exception 'The payout account changed. Refresh and review the beneficiary again.';end if;
  v_amount:=round(i.payout_amount*100)::bigint;
  if v_amount is null or v_amount<=0 then raise exception 'Invalid approved payout amount.';end if;
  if v_amount is distinct from p_expected_amount then raise exception 'The payout amount changed. Refresh and review it again.';end if;
  if p.mode='live' then
    if coalesce(s.wallet_balance,0)*100<v_amount then raise exception 'Insufficient available vendor wallet balance.';end if;
    update public.sellers set wallet_balance=wallet_balance-v_amount/100.0 where id=s.id;
  end if;
  insert into public.paystack_transfers(item_id,seller_id,reference,mode,amount_kobo,recipient_code,account_name,bank_name,last_four,actor_id,note)
    values(i.id,s.id,'cmtr_'||replace(gen_random_uuid()::text,'-',''),p.mode,v_amount,r.recipient_code,r.account_name,r.bank_name,r.last_four,auth.uid(),btrim(p_note)) returning id into v_id;
  return v_id;
end $$;

create function public.cm_paystack_transfer_result(p_id uuid,p_code text,p_state text) returns void language plpgsql security definer set search_path='' as $$
declare t public.paystack_transfers;
begin
  if p_state is null or p_state not in ('pending','success','failed','reversed','otp','uncertain','blocked','abandoned') then raise exception 'Unknown transfer status.';end if;
  select * into t from public.paystack_transfers where id=p_id for update;
  if not found then raise exception 'Transfer not found.';end if;
  if t.provider_code is not null and p_code is not null and t.provider_code<>p_code then raise exception 'Transfer code mismatch.';end if;
  if t.state='reversed' or (t.state='success' and p_state<>'reversed') then return;end if;
  if t.wallet_restored and p_state='success' then raise exception 'A restored transfer requires reconciliation before marking successful.';end if;
  if p_state in ('failed','reversed','abandoned') and not t.wallet_restored then
    if t.mode='live' then update public.sellers set wallet_balance=wallet_balance+t.amount_kobo/100.0 where id=t.seller_id;end if;
    update public.paystack_transfers set wallet_restored=true where id=t.id;
  end if;
  update public.paystack_transfers set provider_code=coalesce(provider_code,p_code),state=p_state,updated_at=now() where id=t.id;
end $$;

create function public.cm_cancel_unsent_transfer(p_id uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare t public.paystack_transfers;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Administrator access required.';end if;
  if coalesce(length(btrim(p_note)),0) not between 10 and 1000 then raise exception 'Record a cancellation reason.';end if;
  select * into t from public.paystack_transfers where id=p_id for update;
  if not found then raise exception 'Transfer not found.';end if;
  if t.state='abandoned' and t.cancelled_by is not null then return;end if;
  if t.state not in ('queued','blocked') then raise exception 'This transfer may already have been sent. Reconcile with Paystack before taking further action.';end if;
  if t.mode='live' and not t.wallet_restored then update public.sellers set wallet_balance=wallet_balance+t.amount_kobo/100.0 where id=t.seller_id;end if;
  update public.paystack_transfers set state='abandoned',wallet_restored=true,cancelled_by=auth.uid(),cancelled_note=btrim(p_note),updated_at=now() where id=t.id;
end $$;
revoke all on function public.cm_cancel_unsent_transfer(uuid,text) from public,anon;
grant execute on function public.cm_cancel_unsent_transfer(uuid,text) to authenticated;

create function public.cm_payment_summary(p_order_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.paystack_payments;
begin
  select * into p from public.paystack_payments where order_id=p_order_id and user_id=auth.uid();
  if not found then return null;end if;
  return jsonb_build_object('reference',p.reference,'mode',p.mode,'state',p.state,'amount',p.amount_kobo/100.0,'service_fee_retained_on_cancellation',p.retain_fee_kobo/100.0,
    'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'amount',amount_kobo/100.0,'status',state,'processing_fee_retained',processing_fee_retained_kobo/100.0)) from public.paystack_refunds where order_id=p.order_id),'[]'::jsonb));
end $$;
do $$declare f record;begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cm_protect_seller_finance','cm_paystack_transfer_result') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
    execute format('grant execute on function %s to service_role',f.oid::regprocedure);
  end loop;
end $$;
revoke all on function public.cm_admin_queue_refund(uuid,uuid,boolean,boolean,text,bigint,bigint),public.cm_admin_queue_transfer(uuid,text,boolean,timestamptz,bigint),public.cm_payment_summary(uuid) from public,anon;
grant execute on function public.cm_admin_queue_refund(uuid,uuid,boolean,boolean,text,bigint,bigint),public.cm_admin_queue_transfer(uuid,text,boolean,timestamptz,bigint),public.cm_payment_summary(uuid) to authenticated;
-- The final approval override below preserves receipt/code/admin safeguards and
-- explicitly simulates test-domain credit without touching real wallet money.

create or replace function public.cm_admin_approve_delivery(p_item_id uuid,p_note text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; d public.order_deliveries; o public.orders; v_fee numeric; v_net numeric;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  if coalesce(length(btrim(p_note)),0) not between 5 and 1000 then raise exception 'Add an approval note of 5 to 1000 characters.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  if not found then raise exception 'This order item is not available.'; end if;
  -- The item lock serializes approval, disputes and repeat requests.
  select * into d from public.order_deliveries where item_id=i.id;
  if i.released_at is not null or d.approved_at is not null then raise exception 'This item has already been credited.'; end if;
  if i.fulfillment_status is distinct from 'received' or d.buyer_confirmed_at is null or d.code_verified_at is null then raise exception 'Buyer receipt confirmation and a verified delivery code are required.'; end if;
  if d.held_at is not null then raise exception 'Remove the review hold before approving credit.'; end if;
  select * into o from public.orders where id=i.order_id for update;
  if not o.is_trial and (o.payment_status is distinct from 'paid' or o.payment_verified_at is null or nullif(btrim(o.payment_verification_ref),'') is null) then raise exception 'A server-verified payment is required. Payment integration is not connected yet.'; end if;
  if i.seller_id is null or i.subtotal is null or i.subtotal<0 then raise exception 'Invalid vendor or item amount.'; end if;
  v_fee:=round(i.subtotal*0.05,2); v_net:=i.subtotal-v_fee;
  update public.order_deliveries set approved_at=now(),approved_by=auth.uid(),approval_note=btrim(p_note) where item_id=i.id;
  update public.order_items set commission_amount=v_fee,payout_amount=v_net,released_at=now(),auto_release_at=null where id=i.id;
  if o.payment_environment is not null and not exists(select 1 from public.paystack_payments where order_id=o.id and state='paid' and provider_id is not null) then raise exception 'Payment is under review. Resolve it before approving vendor credit.';end if;
  if o.is_trial or o.payment_environment='test' then
    perform public.cm_delivery_event(i.id,'trial_completed','Test approval completed. The displayed credit is simulated; no real vendor funds were created.',btrim(p_note));
    return;
  end if;
  update public.sellers set wallet_balance=coalesce(wallet_balance,0)+v_net,total_earned=coalesce(total_earned,0)+v_net where id=i.seller_id;
  if not found then raise exception 'The vendor account is not available.'; end if;
  insert into public.transactions(seller_id,order_item_id,type,gross_amount,commission_amount,amount,status,description)
    values(i.seller_id,i.id,'earning',i.subtotal,v_fee,v_net,'completed','Admin approved delivery credit');
  perform public.cm_delivery_event(i.id,'credited','Admin approved the delivery and credited the vendor wallet.',btrim(p_note));
end $$;

create function public.cm_claim_paystack_transfer(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare t public.paystack_transfers;
begin
  select * into t from public.paystack_transfers where id=p_id;
  if not found then return false;end if;
  perform 1 from public.order_items where id=t.item_id for update;
  perform 1 from public.orders where id=(select order_id from public.order_items where id=t.item_id) for update;
  perform 1 from public.paystack_payments where order_id=(select order_id from public.order_items where id=t.item_id) for update;
  select * into t from public.paystack_transfers where id=p_id for update;
  if t.state<>'queued' then return false;end if;
  if not exists(select 1 from public.order_items i join public.paystack_payments p on p.order_id=i.order_id join public.order_deliveries d on d.item_id=i.id
    where i.id=t.item_id and i.fulfillment_status='received' and i.released_at is not null and p.state='paid' and d.held_at is null and d.approved_at is not null)
    or exists(select 1 from public.paystack_refunds r join public.order_items i on i.order_id=r.order_id where i.id=t.item_id and (r.item_id is null or r.item_id=i.id)) then
    update public.paystack_transfers set state='blocked',updated_at=now() where id=t.id;return false;
  end if;
  update public.paystack_transfers set state='submitting',updated_at=now() where id=t.id;return true;
end $$;
revoke all on function public.cm_claim_paystack_transfer(uuid) from public,anon,authenticated;
grant execute on function public.cm_claim_paystack_transfer(uuid) to service_role;
create or replace function public.cm_order_tracking(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to track your order.'; end if;
  select jsonb_agg(jsonb_build_object(
    'is_trial',o.is_trial,'payment_environment',o.payment_environment,'item_id',i.id,'status',i.fulfillment_status,'created_at',o.created_at,
    'expected_by',d.expected_by,'courier',d.courier,'tracking_number',d.tracking_number,
    'tracking_url',d.tracking_url,'delivery_note',d.delivery_note,'reported_at',d.reported_at,
    'review_after',d.review_after,'buyer_confirmed_at',d.buyer_confirmed_at,
    'code_verified_at',d.code_verified_at,'held_at',d.held_at,'approved_at',d.approved_at,'released_at',i.released_at,
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',e.note,'created_at',e.created_at) order by e.created_at,e.id)
      from public.order_tracking_events e where e.item_id=i.id),'[]'::jsonb))) into v_result
  from public.order_items i join public.orders o on o.id=i.order_id
    left join public.sellers s on s.id=i.seller_id left join public.order_deliveries d on d.item_id=i.id
  where o.id=p_order_id and (o.user_id=auth.uid() or s.user_id=auth.uid() or public.is_admin());
  if v_result is null then raise exception 'This order is not available.'; end if;
  return v_result;
end $$;
create or replace function public.cm_admin_delivery_queue(p_view text default 'pending',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  if p_view is null or p_view not in ('pending','held','approved') or p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid queue filter.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select i.id item_id,i.order_id,i.quantity,i.subtotal,i.fulfillment_status,i.dispute_reason,i.released_at,
      round(i.subtotal*0.05,2) commission_amount,i.subtotal-round(i.subtotal*0.05,2) payout_amount,
      p.title product_title,s.store_name,u.full_name buyer_name,u.email buyer_email,o.phone_number buyer_phone,
      (o.is_trial or o.payment_environment='test') is_trial,o.delivery_method,o.delivery_address,o.payment_status,o.payment_verified_at,o.payment_verification_ref,
      d.expected_by,d.courier,d.tracking_number,d.tracking_url,d.delivery_note,d.reported_at,d.review_after,
      d.buyer_confirmed_at,d.code_verified_at,d.held_at,d.hold_note,d.approved_at,d.approval_note,
      coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',e.note,'created_at',e.created_at,'admin_note',e.admin_note) order by e.created_at,e.id)
        from public.order_tracking_events e where e.item_id=i.id),'[]'::jsonb) events
    from public.order_items i join public.orders o on o.id=i.order_id
      join public.order_deliveries d on d.item_id=i.id left join public.sellers s on s.id=i.seller_id
      left join public.products p on p.id=i.product_id left join public.users u on u.id=o.user_id
    where case p_view when 'approved' then d.approved_at is not null
      when 'held' then i.released_at is null and i.fulfillment_status<>'refunded' and (d.held_at is not null or i.fulfillment_status='disputed')
      else i.released_at is null and d.held_at is null and i.fulfillment_status in ('delivered','received') end
    order by coalesce(d.approved_at,d.review_after,d.reported_at),i.id limit 21 offset (p_page-1)*20
  ) q;
  return v_result;
end $$;
create or replace function public.cm_admin_order_disputes(p_resolved boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select i.id item_id,i.order_id,p.title product_title,i.quantity,i.subtotal,i.dispute_reason,
      o.created_at ordered_at,u.full_name buyer_name,u.email buyer_email,o.phone_number buyer_phone,
      o.delivery_method,s.store_name,s.phone seller_phone,i.dispute_resolution resolution,
      i.dispute_resolved_at resolved_at,i.dispute_admin_note admin_note,(o.is_trial or o.payment_environment='test') is_trial
    from public.order_items i join public.orders o on o.id=i.order_id
      left join public.users u on u.id=o.user_id left join public.products p on p.id=i.product_id
      left join public.sellers s on s.id=i.seller_id
    where (o.payment_status='paid' or o.is_trial) and case when p_resolved
      then i.dispute_resolved_at is not null and i.fulfillment_status<>'disputed'
      else i.fulfillment_status='disputed' end
    order by case when p_resolved then i.dispute_resolved_at else o.created_at end desc,i.id limit 100
  ) q;
  return v_result;
end $$;
create or replace function public.cm_review_product(p_product_id uuid,p_rating integer,p_comment text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(p_comment,''))>2000 then raise exception 'Choose a rating from 1 to 5 and keep the review under 2,000 characters.'; end if;
  if not exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.product_id=p_product_id and o.user_id=auth.uid() and o.payment_status='paid' and (o.payment_environment is null or o.payment_environment='live') and i.fulfillment_status='received') then raise exception 'Only buyers who received a paid order can review this item.'; end if;
  -- Lock the product, not just the account, so concurrent reviews cannot lose aggregate updates.
  perform 1 from public.products where id=p_product_id for update;
  if exists(select 1 from public.reviews where user_id=auth.uid() and product_id=p_product_id) then
    update public.reviews set rating=p_rating,comment=nullif(btrim(p_comment),'') where user_id=auth.uid() and product_id=p_product_id;
  else
    insert into public.reviews(user_id,product_id,rating,comment) values(auth.uid(),p_product_id,p_rating,nullif(btrim(p_comment),''));
  end if;
  update public.products set avg_rating=(select avg(rating) from public.reviews where product_id=p_product_id),total_reviews=(select count(*) from public.reviews where product_id=p_product_id) where id=p_product_id;
end; $$;
revoke all on function public.cm_review_product(uuid,integer,text) from public,anon;
grant execute on function public.cm_review_product(uuid,integer,text) to authenticated;

create function public.cm_paystack_order_settled(p_order uuid) returns boolean language sql stable security definer set search_path='' as $settled$
  select exists(select 1 from public.paystack_payments p where p.order_id=p_order and
    ((p.state='expired' and p.provider_id is null) or
    (not exists(select 1 from public.paystack_refunds r where r.order_id=p.order_id and r.state<>'processed') and
      (select coalesce(sum(r.amount_kobo+r.processing_fee_retained_kobo),0) from public.paystack_refunds r where r.order_id=p.order_id)+
      case when exists(select 1 from public.paystack_refunds r where r.order_id=p.order_id and r.dedup_key='cancel:'||p.order_id) then p.retain_fee_kobo else 0 end>=p.amount_kobo)));
$settled$;
revoke all on function public.cm_paystack_order_settled(uuid) from public,anon,authenticated;
do $closure$
declare definition text;
begin
  if to_regprocedure('public.cm_admin_review_account_change(uuid,text,text)') is not null then
    select pg_get_functiondef('public.cm_admin_review_account_change(uuid,text,text)'::regprocedure) into definition;
    if strpos(definition,'i.fulfillment_status not in (''received'',''refunded'')')=0 then raise exception 'Account closure rules changed. Review payment integration before applying.';end if;
    definition:=replace(definition,'i.fulfillment_status not in (''received'',''refunded'')',
      '(i.fulfillment_status not in (''received'',''refunded'') and not (i.fulfillment_status=''cancelled'' and public.cm_paystack_order_settled(o.id)))');
    definition:=replace(definition,'if p_action=''approve_closure'' then',
      'if p_action=''approve_closure'' then
        if exists(select 1 from public.paystack_refunds f join public.orders o on o.id=f.order_id where f.state<>''processed'' and
          (o.user_id=r.user_id or exists(select 1 from public.order_items i join public.sellers s on s.id=i.seller_id where i.order_id=o.id and s.user_id=r.user_id))) or
          exists(select 1 from public.paystack_transfers t join public.sellers s on s.id=t.seller_id where s.user_id=r.user_id and t.state not in (''success'',''failed'',''reversed'',''abandoned'')) then
          raise exception ''Reconcile pending refunds and vendor transfers before closing this account.'';
        end if;');
    execute definition;
  end if;
end $closure$;
notify pgrst,'reload schema';
commit;
