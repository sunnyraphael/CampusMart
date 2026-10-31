-- Temporary, explicitly labelled trial checkout. Apply AFTER migration 003.
-- Trial orders are unpaid, do not reserve stock, and never create wallet money.
begin;
alter table public.orders add column is_trial boolean not null default false;
grant select(is_trial) on public.orders to authenticated;
create index orders_trial_buyer_date on public.orders(user_id,created_at) where is_trial;
create table public.trial_checkout_requests (
  user_id uuid not null references public.users(id),
  request_id uuid not null,
  payload_hash text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  primary key(user_id,request_id)
);
alter table public.trial_checkout_requests enable row level security;
revoke all on public.trial_checkout_requests from public,anon,authenticated;

create function public.cm_can_read_trial(p_order_id uuid,p_item_id uuid default null) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from public.orders o join public.order_items i on i.order_id=o.id
      left join public.sellers s on s.id=i.seller_id
    where o.id=p_order_id and o.is_trial and (p_item_id is null or i.id=p_item_id)
      and (o.user_id=auth.uid() or s.user_id=auth.uid() or public.is_admin()));
$$;
revoke all on function public.cm_can_read_trial(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cm_can_read_trial(uuid,uuid) to authenticated;
create policy cm_trial_orders_read on public.orders for select to authenticated using(public.cm_can_read_trial(id));
create policy cm_trial_items_read on public.order_items for select to authenticated using(public.cm_can_read_trial(order_id,id));

create function public.cm_create_trial_order(p_user_id uuid,p_request_id uuid,p_items jsonb,p_delivery_method text,
  p_address text,p_phone text,p_note text,p_expected_total numeric) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order uuid:=gen_random_uuid(); v_existing public.trial_checkout_requests; v_hash text; v_items jsonb;
  v_subtotal numeric:=0;v_fee numeric;v_delivery numeric;v_total numeric;r record;p public.products;
begin
  if p_user_id is null or not exists(select 1 from public.users where id=p_user_id) then raise exception 'Sign in with a complete buyer profile to place a trial order.'; end if;
  if p_request_id is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Add between 1 and 50 items to your cart.'; end if;
  if p_delivery_method is null or p_delivery_method not in ('pickup','delivery') then raise exception 'Choose pickup or delivery.'; end if;
  if p_phone is null or btrim(p_phone) !~ '^(\+234|0)[0-9]{10}$' then raise exception 'Enter a Nigerian contact phone number.'; end if;
  if coalesce(length(p_address),0)>500 or (p_delivery_method='delivery' and coalesce(length(btrim(p_address)),0)<5) then raise exception 'Enter a delivery address of 5 to 500 characters.'; end if;
  if coalesce(length(p_note),0)>1000 or p_expected_total is null or p_expected_total<0 or p_expected_total>1000000000 then raise exception 'Check your order details and total.'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x)<>'object' or
    coalesce(x->>'product_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or
    coalesce(x->>'quantity','') !~ '^[1-9][0-9]?$') then raise exception 'Use valid product IDs and quantities from 1 to 99.'; end if;
  if (select count(distinct (x->>'product_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Combine duplicate products before continuing.'; end if;
  select jsonb_agg(jsonb_build_object('product_id',(x->>'product_id')::uuid,'quantity',(x->>'quantity')::integer) order by x->>'product_id') into v_items from jsonb_array_elements(p_items) x;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('items',v_items,'method',p_delivery_method,'address',coalesce(btrim(p_address),''),'phone',btrim(p_phone),'note',coalesce(btrim(p_note),''),'total',p_expected_total)::text,'UTF8')),'hex');
  -- One buyer lock serializes retries and enforces the trial rate limit.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into v_existing from public.trial_checkout_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if v_existing.payload_hash<>v_hash then raise exception 'This checkout attempt changed. Refresh checkout and try again.'; end if;
    return (select jsonb_build_object('id',o.id,'total_amount',o.total_amount,'is_trial',true) from public.orders o where o.id=v_existing.order_id);
  end if;
  if (select count(*) from public.orders where user_id=p_user_id and is_trial and created_at>now()-interval '30 minutes')>=5 then raise exception 'You have created five trial orders. Wait 30 minutes before creating more.'; end if;
  for r in select * from jsonb_to_recordset(v_items) as x(product_id uuid,quantity integer) loop
    select * into p from public.products where id=r.product_id for share;
    if not found or p.status is distinct from 'active' or coalesce(p.stock_quantity,0)<r.quantity or p.seller_id is null or p.price is null or p.price<0 then raise exception 'An item is unavailable or exceeds stock. Refresh your cart.'; end if;
    v_subtotal:=v_subtotal+p.price*r.quantity;
  end loop;
  v_subtotal:=round(v_subtotal,2);
  v_fee:=case when v_subtotal>=20000 then 0 else round(v_subtotal*0.02) end;
  v_delivery:=case when p_delivery_method='delivery' then 500 else 0 end;
  v_total:=v_subtotal+v_fee+v_delivery;
  if v_total<>p_expected_total then raise exception 'Prices changed. Refresh your cart and review the new total before placing the order.'; end if;
  insert into public.orders(id,user_id,total_amount,status,payment_status,payment_ref,delivery_method,delivery_address,phone_number,delivery_notes,delivery_fee,service_fee,is_trial)
    values(v_order,p_user_id,v_total,'pending','unpaid',null,p_delivery_method,case when p_delivery_method='delivery' then btrim(p_address) else null end,btrim(p_phone),nullif(btrim(p_note),''),v_delivery,v_fee,true);
  for r in select * from jsonb_to_recordset(v_items) as x(product_id uuid,quantity integer) loop
    select * into p from public.products where id=r.product_id;
    insert into public.order_items(id,order_id,product_id,seller_id,quantity,unit_price,subtotal,fulfillment_status)
      values(gen_random_uuid(),v_order,p.id,p.seller_id,r.quantity,p.price,p.price*r.quantity,'pending');
  end loop;
  insert into public.order_tracking_events(item_id,actor_id,status,note)
    select id,p_user_id,'pending','Trial order placed. No payment was collected and no stock was reserved.' from public.order_items where order_id=v_order;
  insert into public.notifications(user_id,type,message,order_id)
    select x,'order_update','TRIAL order created for testing. No payment was collected. Do not fulfil it as a paid sale.',v_order
    from (select p_user_id x union select s.user_id from public.sellers s join public.order_items i on i.seller_id=s.id where i.order_id=v_order) recipients;
  insert into public.trial_checkout_requests(user_id,request_id,payload_hash,order_id) values(p_user_id,p_request_id,v_hash,v_order);
  return jsonb_build_object('id',v_order,'total_amount',v_total,'is_trial',true);
end $$;
-- Only the authenticated Next.js server action may invoke creation with its service key.
revoke all on function public.cm_create_trial_order(uuid,uuid,jsonb,text,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.cm_create_trial_order(uuid,uuid,jsonb,text,text,text,text,numeric) to service_role;

create function public.cm_protect_trial_order() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.is_trial is distinct from old.is_trial then raise exception 'An order cannot switch between trial and real payment.'; end if;
  if tg_op='INSERT' and new.is_trial and current_user in ('anon','authenticated') then raise exception 'Trial orders must be created through checkout.'; end if;
  if new.is_trial and (new.payment_status='paid' or new.payment_verified_at is not null or new.payment_verification_ref is not null or new.payment_ref is not null) then raise exception 'Trial orders cannot be marked paid or payment-verified.'; end if;
  return new;
end $$;
create trigger cm_protect_trial_order before insert or update on public.orders for each row execute function public.cm_protect_trial_order();
create function public.cm_no_trial_transactions() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=new.order_item_id and o.is_trial) then raise exception 'Trial orders cannot create real financial transactions.'; end if;
  return new;
end $$;
create trigger cm_no_trial_transactions before insert or update on public.transactions for each row execute function public.cm_no_trial_transactions();
revoke all on function public.cm_protect_trial_order(),public.cm_no_trial_transactions() from public,anon,authenticated;


create or replace function public.cm_delivery_event(p_item uuid,p_status text,p_note text default null,p_admin_note text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order uuid; v_buyer uuid; v_vendor uuid; v_trial boolean;
begin
  insert into public.order_tracking_events(item_id,actor_id,status,note,admin_note) values(p_item,auth.uid(),p_status,p_note,p_admin_note);
  select i.order_id,o.user_id,s.user_id,o.is_trial into v_order,v_buyer,v_vendor,v_trial from public.order_items i
    join public.orders o on o.id=i.order_id left join public.sellers s on s.id=i.seller_id where i.id=p_item;
  insert into public.notifications(user_id,type,message,order_id)
    select x,'order_update',case when v_trial then 'TRIAL: ' else '' end||coalesce(p_note,'Your order has a new tracking update.'),v_order
    from (select distinct unnest(array[v_buyer,v_vendor]) x) recipients
    where x is not null and x is distinct from auth.uid();
end $$;

create or replace function public.cm_order_tracking(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to track your order.'; end if;
  select jsonb_agg(jsonb_build_object(
    'is_trial',o.is_trial,'item_id',i.id,'status',i.fulfillment_status,'created_at',o.created_at,
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

create or replace function public.cm_vendor_update_delivery(p_item_id uuid,p_status text,p_expected_by timestamptz default null,
  p_courier text default null,p_tracking_number text default null,p_tracking_url text default null,p_note text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; o public.orders; v_old text;
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.sellers where id=i.seller_id and user_id=auth.uid()) then raise exception 'This order item is not available.'; end if;
  select * into o from public.orders where id=i.order_id for update;
  if not o.is_trial and o.payment_status is distinct from 'paid' then raise exception 'This order has not been paid.'; end if;
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

create or replace function public.cm_issue_delivery_code(p_item_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items; d public.order_deliveries; v_code text; v_salt uuid:=gen_random_uuid();
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and (payment_status='paid' or is_trial)) then raise exception 'This order item is not available.'; end if;
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

create or replace function public.cm_confirm_delivery(p_item_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and (payment_status='paid' or is_trial)) then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status='received' then return; end if;
  if i.fulfillment_status not in ('shipped','delivered') or i.released_at is not null then raise exception 'This item cannot be confirmed yet.'; end if;
  insert into public.order_deliveries(item_id) values(i.id) on conflict do nothing;
  update public.order_deliveries set buyer_confirmed_at=coalesce(buyer_confirmed_at,now()),
    reported_at=coalesce(reported_at,now()),review_after=coalesce(review_after,now()+interval '72 hours') where item_id=i.id;
  update public.order_items set fulfillment_status='received',received_at=now(),delivered_at=coalesce(delivered_at,now()),auto_release_at=null where id=i.id;
  perform public.cm_delivery_event(i.id,'received','The buyer confirmed receipt. Vendor credit is awaiting admin approval.');
end $$;

create or replace function public.cm_report_order_problem(p_item_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.order_items;
begin
  if coalesce(length(btrim(p_reason)),0) not between 5 and 1000 then raise exception 'Describe the problem in 5 to 1000 characters.'; end if;
  select * into i from public.order_items where id=p_item_id for update;
  if not found or not exists(select 1 from public.orders where id=i.order_id and user_id=auth.uid() and (payment_status='paid' or is_trial)) then raise exception 'This order item is not available.'; end if;
  if i.fulfillment_status not in ('shipped','delivered','received') or i.released_at is not null then raise exception 'Contact support for help with this item.'; end if;
  update public.order_items set fulfillment_status='disputed',dispute_reason=btrim(p_reason),auto_release_at=null where id=i.id;
  insert into public.order_deliveries(item_id,held_at,hold_note) values(i.id,now(),'Buyer reported a problem.')
    on conflict(item_id) do update set held_at=now(),hold_note='Buyer reported a problem.';
  perform public.cm_delivery_event(i.id,'disputed','The buyer reported a problem. Vendor credit is on hold during review.');
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
      o.is_trial,o.delivery_method,o.delivery_address,o.payment_status,o.payment_verified_at,o.payment_verification_ref,
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
  if o.is_trial then
    perform public.cm_delivery_event(i.id,'trial_completed','Trial approval completed. The displayed credit is simulated; no real vendor funds were created.',btrim(p_note));
    return;
  end if;
  update public.sellers set wallet_balance=coalesce(wallet_balance,0)+v_net,total_earned=coalesce(total_earned,0)+v_net where id=i.seller_id;
  if not found then raise exception 'The vendor account is not available.'; end if;
  insert into public.transactions(seller_id,order_item_id,type,gross_amount,commission_amount,amount,status,description)
    values(i.seller_id,i.id,'earning',i.subtotal,v_fee,v_net,'completed','Admin approved delivery credit');
  perform public.cm_delivery_event(i.id,'credited','Admin approved the delivery and credited the vendor wallet.',btrim(p_note));
end $$;

create or replace function public.cm_guard_delivery_credit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.released_at is not null and (tg_op='INSERT' or old.released_at is null) and not exists(
    select 1 from public.order_deliveries d join public.orders o on o.id=new.order_id
    where d.item_id=new.id and d.approved_at is not null and d.approved_by is not null
      and d.buyer_confirmed_at is not null and d.code_verified_at is not null and d.held_at is null
      and new.fulfillment_status='received' and (o.is_trial or (o.payment_status='paid' and o.payment_verified_at is not null
      and nullif(btrim(o.payment_verification_ref),'') is not null))
  ) then raise exception 'Admin approval of a verified delivery and payment is required before vendor credit.'; end if;
  return new;
end $$;

-- The legacy dispute feed can filter for paid orders; include unpaid trials explicitly.
create function public.cm_admin_order_disputes(p_resolved boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Admin access required.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select i.id item_id,i.order_id,p.title product_title,i.quantity,i.subtotal,i.dispute_reason,
      o.created_at ordered_at,u.full_name buyer_name,u.email buyer_email,o.phone_number buyer_phone,
      o.delivery_method,s.store_name,s.phone seller_phone,i.dispute_resolution resolution,
      i.dispute_resolved_at resolved_at,i.dispute_admin_note admin_note,o.is_trial
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
revoke all on function public.cm_admin_order_disputes(boolean) from public,anon,authenticated;
grant execute on function public.cm_admin_order_disputes(boolean) to authenticated;

notify pgrst,'reload schema';
commit;
