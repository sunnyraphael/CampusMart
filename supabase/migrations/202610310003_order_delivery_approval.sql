-- Delivery tracking and manual approval. Apply after the first two migrations.
-- No payments are collected and no bank transfers are initiated here.
begin;

alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists payment_verification_ref text;

create table public.order_deliveries (
  item_id uuid primary key references public.order_items(id) on delete cascade,
  expected_by timestamptz,
  courier text,
  tracking_number text,
  tracking_url text,
  delivery_note text,
  reported_at timestamptz,
  review_after timestamptz,
  buyer_confirmed_at timestamptz,
  code_salt uuid,
  code_hash text,
  code_issued_at timestamptz,
  code_expires_at timestamptz,
  code_attempts integer not null default 0,
  code_verified_at timestamptz,
  held_at timestamptz,
  hold_note text,
  approved_at timestamptz,
  approved_by uuid references public.users(id),
  approval_note text,
  last_reminder_at timestamptz,
  check (code_attempts between 0 and 5)
);
create table public.order_tracking_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.order_items(id) on delete cascade,
  actor_id uuid references public.users(id),
  status text not null,
  note text,
  admin_note text,
  created_at timestamptz not null default now()
);
create index order_tracking_events_item_date on public.order_tracking_events(item_id,created_at,id);
create index order_deliveries_review on public.order_deliveries(review_after) where approved_at is null;
alter table public.order_deliveries enable row level security;
alter table public.order_tracking_events enable row level security;
-- Codes, approval records and the audit trail are only accessible via checked RPCs.
revoke all on public.order_deliveries,public.order_tracking_events from public,anon,authenticated;

-- Import only existing facts; never fabricate earlier tracking timestamps or credit again.
insert into public.order_deliveries(item_id,reported_at,review_after,buyer_confirmed_at)
select id,delivered_at,coalesce(delivered_at,now())+interval '72 hours',received_at
from public.order_items where fulfillment_status in ('delivered','received','disputed') and released_at is null;
update public.order_items set auto_release_at=null where auto_release_at is not null and released_at is null;

-- Retire every old mutation/release entry point, preserving signatures and dependencies.
-- The old cron can continue to call release_due_payouts(), but it is now a no-op.
do $retire$
declare f record; body text;
begin
  for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,
    pg_get_function_result(p.oid) result,p.proretset,p.prorettype
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('release_item_payout','release_due_payouts','vendor_update_item_status','confirm_item_received','dispute_item','admin_resolve_dispute')
  loop
    if f.proname='release_due_payouts' then
      body:=case when f.proretset or f.prorettype='void'::regtype then 'begin return; end;'
        else 'begin return null; end;' end;
    else
      body:='begin raise exception ''This action has moved to the order tracking and delivery approval flow. Refresh the page.''; end;';
    end if;
    execute format('create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path=public,pg_temp as %L',f.proname,f.args,f.result,body);
    execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
  end loop;
end $retire$;

-- Direct writes must not bypass the new functions, including old column grants.
revoke update on public.order_items from anon,authenticated;
do $grants$
declare c record;
begin
  for c in select column_name from information_schema.columns where table_schema='public' and table_name='order_items' loop
    execute format('revoke update(%I) on public.order_items from anon,authenticated',c.column_name);
  end loop;
end $grants$;

create function public.cm_protect_payment_verification() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if current_user in ('anon','authenticated') and
     ((tg_op='INSERT' and (new.payment_verified_at is not null or new.payment_verification_ref is not null)) or
      (tg_op='UPDATE' and (new.payment_verified_at is distinct from old.payment_verified_at or new.payment_verification_ref is distinct from old.payment_verification_ref))) then
    raise exception 'Only the payment verification service can verify a payment.';
  end if;
  return new;
end $$;
create trigger cm_protect_payment_verification before insert or update on public.orders
for each row execute function public.cm_protect_payment_verification();

create function public.cm_delivery_event(p_item uuid,p_status text,p_note text default null,p_admin_note text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order uuid; v_buyer uuid; v_vendor uuid;
begin
  insert into public.order_tracking_events(item_id,actor_id,status,note,admin_note) values(p_item,auth.uid(),p_status,p_note,p_admin_note);
  select i.order_id,o.user_id,s.user_id into v_order,v_buyer,v_vendor from public.order_items i
    join public.orders o on o.id=i.order_id left join public.sellers s on s.id=i.seller_id where i.id=p_item;
  insert into public.notifications(user_id,type,message,order_id)
    select x,'order_update',coalesce(p_note,'Your order has a new tracking update.'),v_order
    from (select distinct unnest(array[v_buyer,v_vendor]) x) recipients
    where x is not null and x is distinct from auth.uid();
end $$;
revoke all on function public.cm_delivery_event(uuid,text,text,text) from public,anon,authenticated;

create function public.cm_order_tracking(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to track your order.'; end if;
  select jsonb_agg(jsonb_build_object(
    'item_id',i.id,'status',i.fulfillment_status,'created_at',o.created_at,
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

create function public.cm_vendor_delivery_holds() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to view your earnings.'; end if;
  select coalesce(jsonb_agg(i.id),'[]'::jsonb) into v_result from public.order_items i
    join public.sellers s on s.id=i.seller_id join public.order_deliveries d on d.item_id=i.id
    where s.user_id=auth.uid() and i.released_at is null and i.fulfillment_status<>'refunded' and d.held_at is not null;
  return v_result;
end $$;

create function public.cm_vendor_update_delivery(p_item_id uuid,p_status text,p_expected_by timestamptz default null,
  p_courier text default null,p_tracking_number text default null,p_tracking_url text default null,p_note text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; o public.orders; v_old text;
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.sellers where id=i.seller_id and user_id=auth.uid()) then raise exception 'This order item is not available.'; end if;
  select * into o from public.orders where id=i.order_id for update;
  if o.payment_status is distinct from 'paid' then raise exception 'This order has not been paid.'; end if;
  if i.released_at is not null or i.fulfillment_status in ('received','disputed','refunded','cancelled') then raise exception 'This item is locked for delivery updates.'; end if;
  if p_status is null or not (p_status=i.fulfillment_status or
    (i.fulfillment_status='pending' and p_status='confirmed') or
    (i.fulfillment_status='confirmed' and p_status='shipped') or
    (i.fulfillment_status='shipped' and p_status='delivered')) then raise exception 'Update the order one step at a time.'; end if;
  if coalesce(length(p_courier),0)>100 or coalesce(length(p_tracking_number),0)>120 or coalesce(length(p_tracking_url),0)>500 or coalesce(length(p_note),0)>1000 then raise exception 'The delivery details are too long.'; end if;
  if nullif(btrim(p_tracking_url),'') is not null and p_tracking_url !~ '^https?://[^[:space:]]+$' then raise exception 'Use a valid http or https tracking link.'; end if;
  if p_expected_by is not null and p_expected_by<now() then raise exception 'Choose an estimated delivery time in the future.'; end if;
  v_old:=i.fulfillment_status;
  insert into public.order_deliveries(item_id) values(i.id) on conflict do nothing;
  update public.order_deliveries set expected_by=coalesce(p_expected_by,expected_by),courier=case when p_courier is null then courier else nullif(btrim(p_courier),'') end,
    tracking_number=case when p_tracking_number is null then tracking_number else nullif(btrim(p_tracking_number),'') end,
    tracking_url=case when p_tracking_url is null then tracking_url else nullif(btrim(p_tracking_url),'') end,
    delivery_note=case when p_note is null then delivery_note else nullif(btrim(p_note),'') end,
    reported_at=case when p_status='delivered' then coalesce(reported_at,now()) else reported_at end,
    review_after=case when p_status='delivered' then coalesce(review_after,now()+interval '72 hours') else review_after end where item_id=i.id;
  update public.order_items set fulfillment_status=p_status,auto_release_at=null,
    delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else delivered_at end where id=i.id;
  perform public.cm_delivery_event(i.id,case when p_status=v_old then 'delivery_details' else p_status end,
    case when p_status=v_old then 'The vendor updated the delivery details.' when p_status='confirmed' then 'The vendor accepted your order and is preparing it.'
      when p_status='shipped' then case when o.delivery_method='pickup' then 'Your item is ready for pickup.' else 'Your item is on the way.' end
      else 'The vendor reported delivery. Please check your item and confirm receipt.' end);
end $$;

create function public.cm_issue_delivery_code(p_item_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; d public.order_deliveries; v_code text; v_salt uuid:=gen_random_uuid();
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and payment_status='paid') then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status not in ('shipped','delivered','received') or i.released_at is not null then raise exception 'The code is available when your item is on the way or ready for pickup.'; end if;
  insert into public.order_deliveries(item_id) values(i.id) on conflict do nothing;
  select * into d from public.order_deliveries where item_id=i.id;
  if d.code_verified_at is not null then raise exception 'The delivery code has already been verified.'; end if;
  if d.code_issued_at>now()-interval '1 minute' then raise exception 'Wait one minute before generating a replacement code.'; end if;
  v_code:=lpad((((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32))::bigint)%1000000)::text,6,'0');
  update public.order_deliveries set code_salt=v_salt,code_hash=encode(sha256(convert_to(i.id::text||v_salt::text||v_code,'UTF8')),'hex'),
    code_issued_at=now(),code_expires_at=now()+interval '30 minutes',code_attempts=0 where item_id=i.id;
  return jsonb_build_object('code',v_code,'expires_at',now()+interval '30 minutes');
end $$;

create function public.cm_verify_delivery_code(p_item_id uuid,p_code text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; d public.order_deliveries;
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.sellers where id=i.seller_id and user_id=auth.uid()) then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status not in ('shipped','delivered','received') or i.released_at is not null then raise exception 'This item cannot accept a delivery code.'; end if;
  select * into d from public.order_deliveries where item_id=i.id;
  if not found then return jsonb_build_object('ok',false,'message','Ask the buyer to generate a delivery code first.'); end if;
  if d.code_verified_at is not null then return jsonb_build_object('ok',true); end if;
  if d.code_hash is null or d.code_expires_at<now() then return jsonb_build_object('ok',false,'message','Ask the buyer to generate a fresh delivery code.'); end if;
  if d.code_attempts>=5 then return jsonb_build_object('ok',false,'message','Too many attempts. The buyer must generate a replacement code.'); end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' or encode(sha256(convert_to(i.id::text||d.code_salt::text||p_code,'UTF8')),'hex') is distinct from d.code_hash then
    update public.order_deliveries set code_attempts=code_attempts+1 where item_id=i.id;
    -- Return failure rather than raising, so the failed-attempt counter commits.
    return jsonb_build_object('ok',false,'message','That code does not match. Check with the buyer before trying again.');
  end if;
  update public.order_deliveries set code_verified_at=now(),code_hash=null,code_salt=null,
    reported_at=coalesce(reported_at,now()),review_after=coalesce(review_after,now()+interval '72 hours') where item_id=i.id;
  update public.order_items set fulfillment_status=case when fulfillment_status='shipped' then 'delivered' else fulfillment_status end,
    delivered_at=coalesce(delivered_at,now()),auto_release_at=null where id=i.id;
  perform public.cm_delivery_event(i.id,'code_verified','The delivery handover code was verified. Admin approval is still required.');
  return jsonb_build_object('ok',true);
end $$;

create function public.cm_confirm_delivery(p_item_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and payment_status='paid') then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status='received' then return; end if;
  if i.fulfillment_status not in ('shipped','delivered') or i.released_at is not null then raise exception 'This item cannot be confirmed yet.'; end if;
  insert into public.order_deliveries(item_id) values(i.id) on conflict do nothing;
  update public.order_deliveries set buyer_confirmed_at=coalesce(buyer_confirmed_at,now()),
    reported_at=coalesce(reported_at,now()),review_after=coalesce(review_after,now()+interval '72 hours') where item_id=i.id;
  update public.order_items set fulfillment_status='received',received_at=now(),delivered_at=coalesce(delivered_at,now()),auto_release_at=null where id=i.id;
  perform public.cm_delivery_event(i.id,'received','The buyer confirmed receipt. Vendor credit is awaiting admin approval.');
end $$;

create function public.cm_report_order_problem(p_item_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  if coalesce(length(btrim(p_reason)),0) not between 5 and 1000 then raise exception 'Describe the problem in 5 to 1000 characters.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and payment_status='paid') then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status not in ('shipped','delivered','received') or i.released_at is not null then raise exception 'Contact support for help with this item.'; end if;
  update public.order_items set fulfillment_status='disputed',dispute_reason=btrim(p_reason),auto_release_at=null where id=i.id;
  insert into public.order_deliveries(item_id,held_at,hold_note) values(i.id,now(),'Buyer reported a problem.')
    on conflict(item_id) do update set held_at=now(),hold_note='Buyer reported a problem.';
  perform public.cm_delivery_event(i.id,'disputed','The buyer reported a problem. Vendor credit is on hold during review.');
end $$;

create function public.cm_admin_delivery_queue(p_view text default 'pending',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  if p_view is null or p_view not in ('pending','held','approved') or p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid queue filter.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select i.id item_id,i.order_id,i.quantity,i.subtotal,i.fulfillment_status,i.dispute_reason,i.released_at,
      round(i.subtotal*0.05,2) commission_amount,i.subtotal-round(i.subtotal*0.05,2) payout_amount,
      p.title product_title,s.store_name,u.full_name buyer_name,u.email buyer_email,o.phone_number buyer_phone,
      o.delivery_method,o.delivery_address,o.payment_status,o.payment_verified_at,o.payment_verification_ref,
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

create function public.cm_admin_hold_delivery(p_item_id uuid,p_note text,p_hold boolean default true) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  if coalesce(length(btrim(p_note)),0) not between 5 and 1000 or p_hold is null then raise exception 'Add a review note of 5 to 1000 characters.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  if not found or i.released_at is not null or i.fulfillment_status not in ('delivered','received') then raise exception 'Resolve any dispute first or choose an uncredited delivery.'; end if;
  update public.order_deliveries set held_at=case when p_hold then now() else null end,
    hold_note=case when p_hold then btrim(p_note) else null end where item_id=i.id;
  if not found then raise exception 'Delivery information is not available.'; end if;
  perform public.cm_delivery_event(i.id,case when p_hold then 'held' else 'review_resumed' end,
    case when p_hold then 'Admin placed vendor credit on hold for review.' else 'Admin resumed the delivery review.' end,btrim(p_note));
end $$;

create function public.cm_admin_approve_delivery(p_item_id uuid,p_note text) returns void
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
  if o.payment_status is distinct from 'paid' or o.payment_verified_at is null or nullif(btrim(o.payment_verification_ref),'') is null then raise exception 'A server-verified payment is required. Payment integration is not connected yet.'; end if;
  if i.seller_id is null or i.subtotal is null or i.subtotal<0 then raise exception 'Invalid vendor or item amount.'; end if;
  v_fee:=round(i.subtotal*0.05,2); v_net:=i.subtotal-v_fee;
  update public.order_deliveries set approved_at=now(),approved_by=auth.uid(),approval_note=btrim(p_note) where item_id=i.id;
  update public.order_items set commission_amount=v_fee,payout_amount=v_net,released_at=now(),auto_release_at=null where id=i.id;
  update public.sellers set wallet_balance=coalesce(wallet_balance,0)+v_net,total_earned=coalesce(total_earned,0)+v_net where id=i.seller_id;
  if not found then raise exception 'The vendor account is not available.'; end if;
  insert into public.transactions(seller_id,order_item_id,type,gross_amount,commission_amount,amount,status,description)
    values(i.seller_id,i.id,'earning',i.subtotal,v_fee,v_net,'completed','Admin approved delivery credit');
  perform public.cm_delivery_event(i.id,'credited','Admin approved the delivery and credited the vendor wallet.',btrim(p_note));
end $$;

-- Extra guard for any legacy trigger or background function trying to release an item.
create function public.cm_guard_delivery_credit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.released_at is not null and (tg_op='INSERT' or old.released_at is null) and not exists(
    select 1 from public.order_deliveries d join public.orders o on o.id=new.order_id
    where d.item_id=new.id and d.approved_at is not null and d.approved_by is not null
      and d.buyer_confirmed_at is not null and d.code_verified_at is not null and d.held_at is null
      and new.fulfillment_status='received' and o.payment_status='paid' and o.payment_verified_at is not null
      and nullif(btrim(o.payment_verification_ref),'') is not null
  ) then raise exception 'Admin approval of a verified delivery and payment is required before vendor credit.'; end if;
  return new;
end $$;
create trigger cm_guard_delivery_credit before insert or update on public.order_items for each row execute function public.cm_guard_delivery_credit();

create function public.cm_admin_resolve_delivery_dispute(p_item_id uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  if coalesce(length(btrim(p_note)),0) not between 5 and 1000 or p_decision is null or p_decision not in ('release','refund') then raise exception 'Choose a decision and add a review note.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  if not found or i.fulfillment_status<>'disputed' or i.released_at is not null then raise exception 'This dispute is no longer open.'; end if;
  update public.order_items set fulfillment_status=case when p_decision='refund' then 'refunded' else 'delivered' end,
    dispute_resolution=p_decision,dispute_resolved_at=now(),dispute_resolved_by=auth.uid(),dispute_admin_note=btrim(p_note),
    refund_amount=case when p_decision='refund' then subtotal else null end,auto_release_at=null where id=i.id;
  insert into public.order_deliveries(item_id) values(i.id) on conflict do nothing;
  update public.order_deliveries set held_at=null,hold_note=null,
    -- A fresh buyer confirmation is required after a dispute is resolved.
    buyer_confirmed_at=null,reported_at=coalesce(reported_at,now()),review_after=now()+interval '72 hours' where item_id=i.id;
  perform public.cm_delivery_event(i.id,case when p_decision='refund' then 'refunded' else 'dispute_resolved' end,
    case when p_decision='refund' then 'Admin approved a refund. The refund transfer is handled separately; the vendor receives no credit.'
      else 'Admin resolved the dispute. Buyer confirmation and a separate delivery approval are still required.' end,btrim(p_note));
end $$;

-- Deny-by-default for new RPCs; explicit authenticated grants, internal helpers stay private.
revoke all on function public.cm_order_tracking(uuid),public.cm_vendor_delivery_holds(),public.cm_vendor_update_delivery(uuid,text,timestamptz,text,text,text,text),
  public.cm_issue_delivery_code(uuid),public.cm_verify_delivery_code(uuid,text),public.cm_confirm_delivery(uuid),
  public.cm_report_order_problem(uuid,text),public.cm_admin_delivery_queue(text,integer),public.cm_admin_hold_delivery(uuid,text,boolean),
  public.cm_admin_approve_delivery(uuid,text),public.cm_admin_resolve_delivery_dispute(uuid,text,text),
  public.cm_guard_delivery_credit(),public.cm_protect_payment_verification() from public,anon,authenticated;
grant execute on function public.cm_order_tracking(uuid),public.cm_vendor_delivery_holds(),public.cm_vendor_update_delivery(uuid,text,timestamptz,text,text,text,text),
  public.cm_issue_delivery_code(uuid),public.cm_verify_delivery_code(uuid,text),public.cm_confirm_delivery(uuid),
  public.cm_report_order_problem(uuid,text),public.cm_admin_delivery_queue(text,integer),public.cm_admin_hold_delivery(uuid,text,boolean),
  public.cm_admin_approve_delivery(uuid,text),public.cm_admin_resolve_delivery_dispute(uuid,text,text) to authenticated;

-- In-app reminders only. A missed confirmation flags review; it never releases money.
create function public.cm_delivery_reminders() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; v_count integer:=0;
begin
  for r in select i.id,o.id order_id,o.user_id,d.buyer_confirmed_at,d.code_verified_at
    from public.order_items i join public.orders o on o.id=i.order_id join public.order_deliveries d on d.item_id=i.id
    where o.payment_status='paid' and i.released_at is null and i.fulfillment_status in ('delivered','received')
      and d.held_at is null and d.reported_at<now()-interval '24 hours'
      and (d.buyer_confirmed_at is null or d.code_verified_at is null)
      and (d.last_reminder_at is null or d.last_reminder_at<now()-interval '24 hours')
    for update of i skip locked
  loop
    insert into public.notifications(user_id,type,message,order_id) values(r.user_id,'order_update',
      case when r.buyer_confirmed_at is null then 'Delivery follow-up: please check your item and confirm receipt, or report a problem. Vendor credit remains held.'
        else 'Delivery follow-up: the handover code is still unverified. Contact the vendor or support to complete delivery verification.' end,r.order_id);
    update public.order_deliveries set last_reminder_at=now() where item_id=r.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function public.cm_delivery_reminders() from public,anon,authenticated;
-- Supabase normally has pg_cron. If unavailable, the documented manual job is safe to run.
do $schedule$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('campusmart-delivery-reminders','17 * * * *','select public.cm_delivery_reminders()');
  end if;
end $schedule$;

notify pgrst,'reload schema';
commit;
