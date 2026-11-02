-- Apply once after 202611010004. Secrets stay in the application environment.
begin;
alter table public.orders add column payment_environment text check(payment_environment in ('test','live'));
grant select(payment_environment) on public.orders to authenticated;
create table public.paystack_payments(
  order_id uuid primary key references public.orders(id),user_id uuid not null references public.users(id),
  request_id uuid not null,payload_hash text not null,reference text not null unique,payment_terms_version text not null default '2026-11-01-payments-v1',payment_terms_accepted_at timestamptz not null default now(),last_checked_at timestamptz,
  amount_kobo bigint not null check(amount_kobo>0),email text not null,mode text not null check(mode in ('test','live')),
  state text not null default 'created' check(state in ('created','pending','paid','expired','review','refunded')),
  authorization_url text,provider_id text unique,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
  stock_released boolean not null default false,retain_fee_kobo bigint not null default 0 check(retain_fee_kobo>=0),provider_fee_kobo bigint check(provider_fee_kobo>=0),
  unique(user_id,request_id)
);
create table public.paystack_refunds(
  id uuid primary key default gen_random_uuid(),order_id uuid not null references public.paystack_payments(order_id),
  item_id uuid references public.order_items(id),dedup_key text not null unique,
  amount_kobo bigint not null check(amount_kobo>0),note text not null,
  state text not null default 'queued' check(state in ('queued','submitting','pending','processing','needs-attention','failed','processed','uncertain','rejected')),
  provider_id text unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.paystack_events(id text primary key,event text not null,reference text,created_at timestamptz not null default now(),processed_at timestamptz);
alter table public.paystack_payments enable row level security;
alter table public.paystack_refunds enable row level security;
alter table public.paystack_events enable row level security;
revoke all on public.paystack_payments,public.paystack_refunds,public.paystack_events from public,anon,authenticated;
grant all on public.paystack_payments,public.paystack_refunds,public.paystack_events to service_role;
create index paystack_pending on public.paystack_payments(created_at) where state in ('created','pending','expired');
create index paystack_refunds_pending on public.paystack_refunds(created_at) where state<>'processed';

create function public.cm_protect_payment_order() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' and new.is_trial is not true then raise exception 'Place orders through checkout.'; end if;
    if tg_op='UPDATE' and (new.payment_status is distinct from old.payment_status or new.payment_ref is distinct from old.payment_ref or
      new.payment_environment is distinct from old.payment_environment or new.total_amount is distinct from old.total_amount or
      new.service_fee is distinct from old.service_fee or new.delivery_fee is distinct from old.delivery_fee) then raise exception 'Only the payment service can change order payment details.'; end if;
  end if;
  return new;
end $$;
create trigger cm_protect_payment_order before insert or update on public.orders for each row execute function public.cm_protect_payment_order();

create function public.cm_create_paystack_order(p_user_id uuid,p_request_id uuid,p_items jsonb,p_delivery_method text,p_address text,p_phone text,p_note text,p_expected_total numeric,p_mode text,p_retain_fee boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_order uuid:=gen_random_uuid();v_ref text:='cm-'||replace(gen_random_uuid()::text,'-','');v_hash text;v_items jsonb;r record;p public.products;
  v_sub numeric:=0;v_fee numeric;v_delivery numeric;v_total numeric;v_email text;existing public.paystack_payments;
begin
  if p_mode is null or p_mode not in ('test','live') or not public.cm_consent_allows_trade(p_user_id) or not exists(select 1 from public.marketplace_consents where user_id=p_user_id and age_band='adult') then raise exception 'Paid checkout requires an eligible adult account.'; end if;
  select email into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your sign-in email before paying.'; end if;
  if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Check your cart items.'; end if;
  if p_delivery_method is null or p_delivery_method not in ('pickup','delivery') or p_phone is null or btrim(p_phone)!~ '^(\+234|0)[0-9]{10}$' or coalesce(length(p_address),0)>500 or (p_delivery_method='delivery' and coalesce(length(btrim(p_address)),0)<5) or coalesce(length(p_note),0)>1000 then raise exception 'Check your contact and delivery details.'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object' or coalesce(x->>'product_id','')!~ '^[0-9a-fA-F-]{36}$' or coalesce(x->>'quantity','')!~ '^[1-9][0-9]?$') then raise exception 'Check your cart items and quantities.'; end if;
  select jsonb_agg(jsonb_build_object('product_id',(x->>'product_id')::uuid,'quantity',(x->>'quantity')::int) order by x->>'product_id') into v_items from jsonb_array_elements(p_items) x;
  if (select count(distinct x->>'product_id') from jsonb_array_elements(v_items) x)<>jsonb_array_length(v_items) then raise exception 'Combine duplicate cart items.'; end if;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('items',v_items,'method',p_delivery_method,'address',coalesce(btrim(p_address),''),'phone',btrim(p_phone),'note',coalesce(btrim(p_note),''),'total',p_expected_total,'mode',p_mode,'retain',p_retain_fee)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into existing from public.paystack_payments where user_id=p_user_id and request_id=p_request_id;
  if found then
    if existing.payload_hash<>v_hash then raise exception 'This checkout attempt changed. Start a new checkout.'; end if;
    return to_jsonb(existing);
  end if;
  if (select count(*) from public.paystack_payments where user_id=p_user_id and created_at>now()-interval '1 hour')>=10 then raise exception 'Too many payment attempts. Wait before starting another checkout.'; end if;
  perform 1 from public.users where id in (select p_user_id union select s.user_id from public.sellers s join public.products q on q.seller_id=s.id join jsonb_to_recordset(v_items) as x(product_id uuid,quantity int) on x.product_id=q.id) order by id for share;
  perform 1 from public.sellers where id in (select q.seller_id from public.products q join jsonb_to_recordset(v_items) as x(product_id uuid,quantity int) on x.product_id=q.id) order by id for share;
  for r in select * from jsonb_to_recordset(v_items) as x(product_id uuid,quantity int) order by product_id loop
    select * into p from public.products where id=r.product_id for update;
    if not found or p.status is distinct from 'active' or coalesce(p.stock_quantity,0)<r.quantity or p.price is null or p.price<=0 or p.price<>round(p.price,2) then raise exception 'An item is unavailable. Refresh your cart.'; end if;
    if not exists(select 1 from public.sellers s join public.marketplace_consents c on c.user_id=s.user_id where s.id=p.seller_id and c.age_band='adult' and public.cm_consent_allows_selling(s.user_id)) then raise exception 'A vendor is not eligible for paid orders.'; end if;
    v_sub:=v_sub+p.price*r.quantity;
  end loop;
  v_sub:=round(v_sub,2);v_fee:=case when v_sub>=20000 then 0 else round(v_sub*0.02) end;v_delivery:=case when p_delivery_method='delivery' then 500 else 0 end;v_total:=v_sub+v_fee+v_delivery;
  if v_total<=0 or v_total>1000000000 or p_expected_total is distinct from v_total then raise exception 'Prices changed. Refresh your cart and review the total.'; end if;
  insert into public.orders(id,user_id,total_amount,status,payment_status,delivery_method,delivery_address,phone_number,delivery_notes,delivery_fee,service_fee,is_trial,payment_environment)
    values(v_order,p_user_id,v_total,'pending','unpaid',p_delivery_method,case when p_delivery_method='delivery' then btrim(p_address) else null end,btrim(p_phone),nullif(btrim(p_note),''),v_delivery,v_fee,false,p_mode);
  for r in select * from jsonb_to_recordset(v_items) as x(product_id uuid,quantity int) order by product_id loop
    select * into p from public.products where id=r.product_id;
    update public.products set stock_quantity=stock_quantity-r.quantity where id=p.id;
    insert into public.order_items(id,order_id,product_id,seller_id,quantity,unit_price,subtotal,fulfillment_status) values(gen_random_uuid(),v_order,p.id,p.seller_id,r.quantity,p.price,p.price*r.quantity,'pending');
  end loop;
  insert into public.paystack_payments(order_id,user_id,request_id,payload_hash,reference,amount_kobo,email,mode,retain_fee_kobo)
    values(v_order,p_user_id,p_request_id,v_hash,v_ref,(v_total*100)::bigint,v_email,p_mode,case when p_retain_fee then (v_fee*100)::bigint else 0 end) returning * into existing;
  return to_jsonb(existing);
end $$;

create function public.cm_paystack_restore_stock(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
  -- Caller holds the payment lock. A grouped update handles multiple lines of one product.
  for r in select product_id,sum(quantity)::int quantity from public.order_items where order_id=p_order group by product_id order by product_id loop
    update public.products set stock_quantity=stock_quantity+r.quantity where id=r.product_id;
  end loop;
  update public.paystack_payments set stock_released=true where order_id=p_order;
end $$;

create function public.cm_verify_paystack_payment(p_reference text,p_provider_id text,p_amount bigint,p_email text,p_currency text,p_mode text,p_provider_fee bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.paystack_payments;r record;
begin
  select * into p from public.paystack_payments where reference=p_reference;
  if not found then raise exception 'Payment reference not found.'; end if;
  perform 1 from public.order_items where order_id=p.order_id order by id for update;
  perform 1 from public.orders where id=p.order_id for update;
  select * into p from public.paystack_payments where reference=p_reference for update;
  if p_amount is distinct from p.amount_kobo or lower(p_email) is distinct from lower(p.email) or p_currency is distinct from 'NGN' or p_mode is distinct from p.mode or nullif(p_provider_id,'') is null then raise exception 'Payment verification did not match the order.'; end if;
  if p.provider_id is not null then
    if p.provider_id<>p_provider_id then raise exception 'A different transaction is already attached.'; end if;
    return p.order_id;
  end if;
  if p.expires_at<=now() and p.state in ('created','pending') then
    perform public.cm_expire_paystack_payment(p.reference);
    select * into p from public.paystack_payments where reference=p_reference;
  end if;
  if p_provider_fee is not null and (p_provider_fee<0 or p_provider_fee>p_amount) then raise exception 'Invalid provider processing fee.'; end if;
  update public.paystack_payments set provider_id=p_provider_id,provider_fee_kobo=p_provider_fee,state=case when p.state='expired' then 'review' else 'paid' end where order_id=p.order_id;
  update public.orders set payment_status='paid',payment_ref=p.reference,payment_verified_at=now(),payment_verification_ref=p.reference where id=p.order_id;
  if p.state='expired' then
    insert into public.paystack_refunds(order_id,dedup_key,amount_kobo,note) values(p.order_id,'expired:'||p.order_id,p.amount_kobo,'Payment arrived after the stock reservation expired. Full refund.') on conflict do nothing;
    return p.order_id;
  end if;
  if p.mode='test' and not p.stock_released then perform public.cm_paystack_restore_stock(p.order_id); end if;
  for r in select id from public.order_items where order_id=p.order_id loop
    perform public.cm_delivery_event(r.id,'paid',case when p.mode='test' then 'PAYSTACK TEST payment verified. No real money was collected. Do not fulfil as a real sale.' else 'Payment verified. The vendor can prepare your order.' end);
  end loop;
  insert into public.notifications(user_id,type,message,order_id) values(p.user_id,'order_update',case when p.mode='test' then 'PAYSTACK TEST payment verified. No real charge.' else 'Your payment was verified. Track your order for delivery updates.' end,p.order_id);
  return p.order_id;
end $$;

create function public.cm_expire_paystack_payment(p_reference text) returns void language plpgsql security definer set search_path='' as $$
declare p public.paystack_payments;
begin
  select * into p from public.paystack_payments where reference=p_reference;
  if not found then return; end if;
  perform 1 from public.order_items where order_id=p.order_id order by id for update;
  perform 1 from public.orders where id=p.order_id for update;
  select * into p from public.paystack_payments where reference=p_reference for update;
  if not found or p.provider_id is not null or p.state not in ('created','pending') or p.expires_at>now() then return; end if;
  if not p.stock_released then perform public.cm_paystack_restore_stock(p.order_id); end if;
  update public.paystack_payments set state='expired' where order_id=p.order_id;
  update public.order_items set fulfillment_status='cancelled' where order_id=p.order_id;
  update public.orders set status='cancelled' where id=p.order_id;
end $$;

-- Keep trial cancellation intact while adding paid quotes and full-order cancellation.
alter function public.cm_order_cancellation_quote(uuid) rename to cm_trial_cancellation_quote;
alter function public.cm_cancel_buyer_order(uuid,text) rename to cm_cancel_trial_order;
revoke all on function public.cm_trial_cancellation_quote(uuid),public.cm_cancel_trial_order(uuid,text) from public,anon,authenticated;
create function public.cm_order_cancellation_quote(p_order_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.paystack_payments;o public.orders;v_reason text;v_refunds jsonb;
begin
  select * into o from public.orders where id=p_order_id and user_id=auth.uid();
  if not found then raise exception 'This order is not available.'; end if;
  if o.is_trial then return public.cm_trial_cancellation_quote(o.id); end if;
  select * into p from public.paystack_payments where order_id=o.id;
  if not found then return jsonb_build_object('can_cancel',false,'cancelled',false,'reason','Contact support about this legacy order.'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount_kobo/100.0,'status',state)),'[]'::jsonb) into v_refunds from public.paystack_refunds where order_id=o.id;
  if o.status='cancelled' then return jsonb_build_object('can_cancel',false,'cancelled',true,'is_trial',false,'mode',p.mode,'refunds',v_refunds,'refund_amount',(p.amount_kobo-p.retain_fee_kobo)/100.0,'retained_service_fee',p.retain_fee_kobo/100.0); end if;
  if p.state<>'paid' or o.payment_status<>'paid' then v_reason:='Payment is not verified. Check payment status first. Unpaid reservations expire after 30 minutes.';
  elsif now()>=o.created_at+interval '30 minutes' then v_reason:='The 30-minute cancellation window has ended. Contact support; your consumer rights still apply.';
  elsif exists(select 1 from public.order_items where order_id=o.id and (fulfillment_status not in ('pending','confirmed') or released_at is not null)) then v_reason:='An item has been dispatched, is ready for pickup or is under review. Contact support.';
  elsif exists(select 1 from public.paystack_refunds where order_id=o.id) then v_reason:='A refund is already under review. Contact support.';
  end if;
  return jsonb_build_object('can_cancel',v_reason is null,'cancelled',false,'is_trial',false,'mode',p.mode,'reason',v_reason,'deadline',o.created_at+interval '30 minutes','refund_amount',(p.amount_kobo-p.retain_fee_kobo)/100.0,'retained_service_fee',p.retain_fee_kobo/100.0,'refunds',v_refunds);
end $$;
create function public.cm_cancel_buyer_order(p_order_id uuid,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;p public.paystack_payments;q jsonb;r record;
begin
  if coalesce(length(btrim(p_reason)),0)>500 then raise exception 'Keep the reason under 500 characters.'; end if;
  select * into o from public.orders where id=p_order_id and user_id=auth.uid();
  if not found then raise exception 'This order is not available.'; end if;
  if o.is_trial then return public.cm_cancel_trial_order(o.id,p_reason); end if;
  perform 1 from public.order_items where order_id=o.id order by id for update;
  perform 1 from public.orders where id=o.id for update;
  select * into p from public.paystack_payments where order_id=o.id for update;
  q:=public.cm_order_cancellation_quote(o.id);
  if (q->>'cancelled')::boolean then return q; end if;
  if (q->>'can_cancel')::boolean is not true then raise exception '%',q->>'reason'; end if;
  insert into public.paystack_refunds(order_id,dedup_key,amount_kobo,note) values(o.id,'cancel:'||o.id,p.amount_kobo-p.retain_fee_kobo,'Buyer voluntary cancellation within 30 minutes.');
  if not p.stock_released then perform public.cm_paystack_restore_stock(o.id); end if;
  update public.order_items set fulfillment_status='cancelled',auto_release_at=null where order_id=o.id;
  update public.orders set status='cancelled' where id=o.id;
  for r in select id from public.order_items where order_id=o.id loop perform public.cm_delivery_event(r.id,'cancelled','Buyer cancelled the order. Do not fulfil. A refund is queued, not yet confirmed by the bank.'); end loop;
  return public.cm_order_cancellation_quote(o.id);
end $$;

create function public.cm_paystack_refund_result(p_id uuid,p_provider_id text,p_state text) returns void language plpgsql security definer set search_path='' as $$
declare r public.paystack_refunds;p public.paystack_payments;
begin
  if p_state is null or p_state not in ('pending','processing','needs-attention','failed','processed','uncertain') then raise exception 'Invalid refund state.'; end if;
  select * into r from public.paystack_refunds where id=p_id;
  if not found then raise exception 'Refund not found.'; end if;
  perform 1 from public.order_items where order_id=r.order_id order by id for update;
  perform 1 from public.orders where id=r.order_id for update;
  perform 1 from public.paystack_payments where order_id=r.order_id for update;
  select * into r from public.paystack_refunds where id=p_id for update;
  if r.provider_id is not null and p_provider_id is not null and r.provider_id<>p_provider_id then raise exception 'Refund reference mismatch.'; end if;
  if r.state='processed' then return; end if;
  update public.paystack_refunds set provider_id=coalesce(provider_id,p_provider_id),state=p_state,updated_at=now() where id=r.id;
  if p_state='processed' then
    select * into p from public.paystack_payments where order_id=r.order_id for update;
    if (select sum(amount_kobo) from public.paystack_refunds where order_id=r.order_id and state='processed')>=p.amount_kobo then
      update public.orders set payment_status='refunded' where id=r.order_id;
      update public.paystack_payments set state='refunded' where order_id=r.order_id;
    end if;
    insert into public.notifications(user_id,type,message,order_id) values(p.user_id,'order_update','Paystack marked a refund processed. Your bank may take additional time to credit it.',r.order_id);
  end if;
end $$;

-- A real disputed-item refund decision creates a durable refund job in the same transaction.
create function public.cm_queue_dispute_refund() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.paystack_payments;v_amount bigint;
begin
  if new.dispute_resolution='refund' and new.dispute_resolution is distinct from old.dispute_resolution then
    select * into p from public.paystack_payments where order_id=new.order_id for update;
    if found then
      v_amount:=round(coalesce(new.refund_amount,new.subtotal)*100)::bigint;
      if p.state<>'paid' or v_amount<=0 or v_amount+(select coalesce(sum(amount_kobo),0) from public.paystack_refunds where order_id=p.order_id)>p.amount_kobo then raise exception 'Refund amount requires payment review.'; end if;
      insert into public.paystack_refunds(order_id,item_id,dedup_key,amount_kobo,note) values(p.order_id,new.id,'dispute:'||new.id,v_amount,'Admin approved an item dispute refund.') on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
-- Dispute decisions remain review outcomes. The admin finance action confirms
-- the actual refund scope and any lawful fee deduction before creating a job.

create function public.cm_paystack_hold(p_reference text) returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.order_items where order_id=(select order_id from public.paystack_payments where reference=p_reference) order by id for update;
  perform 1 from public.orders where id=(select order_id from public.paystack_payments where reference=p_reference) for update;
  update public.paystack_payments set state='review' where reference=p_reference and state<>'refunded';
  insert into public.order_deliveries(item_id,held_at,hold_note)
    select i.id,now(),'Payment provider review. Do not release vendor funds.' from public.order_items i join public.paystack_payments p on p.order_id=i.order_id where p.reference=p_reference
    on conflict(item_id) do update set held_at=now(),hold_note='Payment provider review. Do not release vendor funds.';
end $$;

-- Revoke every new privileged entry point. Only the two owner-checked cancellation RPCs are browser callable.
do $$declare f record;begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('cm_protect_payment_order','cm_create_paystack_order','cm_paystack_restore_stock','cm_verify_paystack_payment','cm_expire_paystack_payment','cm_paystack_refund_result','cm_queue_dispute_refund','cm_paystack_hold') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
    execute format('grant execute on function %s to service_role',f.oid::regprocedure);
  end loop;
end $$;
revoke all on function public.cm_order_cancellation_quote(uuid),public.cm_cancel_buyer_order(uuid,text) from public,anon;
grant execute on function public.cm_order_cancellation_quote(uuid),public.cm_cancel_buyer_order(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
