-- Apply after 202611010003. Current checkout is trial-only.
-- Real paid cancellations deliberately fail closed until payment/refund and inventory integration exists.
begin;
alter table public.order_items drop constraint if exists order_items_fulfillment_status_check;
alter table public.order_items add constraint order_items_fulfillment_status_check
  check(fulfillment_status in ('pending','confirmed','shipped','delivered','received','disputed','refunded','cancelled'));

create table public.order_cancellations (
  order_id uuid primary key references public.orders(id),
  buyer_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  reason text,
  is_trial boolean not null,
  refund_amount numeric not null check(refund_amount>=0),
  retained_service_fee numeric not null check(retained_service_fee>=0),
  refund_status text not null check(refund_status in ('not_charged'))
);
alter table public.order_cancellations enable row level security;
revoke all on public.order_cancellations from public,anon,authenticated;

-- Older installations may grant buyers UPDATE on their orders. A browser must not
-- move the deadline, transfer ownership, or forge/reverse a cancellation directly.
create function public.cm_protect_order_cancellation() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') and (
    new.created_at is distinct from old.created_at or new.user_id is distinct from old.user_id or
    (new.status is distinct from old.status and (new.status='cancelled' or old.status='cancelled'))
  ) then raise exception 'Use the order cancellation action. The order owner and placement time cannot be changed.'; end if;
  return new;
end $$;
create trigger cm_protect_order_cancellation before update on public.orders for each row execute function public.cm_protect_order_cancellation();
revoke all on function public.cm_protect_order_cancellation() from public,anon,authenticated;

create function public.cm_order_cancellation_quote(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders; c public.order_cancellations; v_reason text;
begin
  select * into o from public.orders where id=p_order_id and user_id=auth.uid();
  if not found then raise exception 'This order is not available.'; end if;
  select * into c from public.order_cancellations where order_id=o.id;
  if found then return jsonb_build_object('cancelled',true,'can_cancel',false,'refund_status',c.refund_status,'refund_amount',c.refund_amount,'retained_service_fee',c.retained_service_fee); end if;
  if o.is_trial is not true then v_reason:='Online cancellation of real orders is not enabled until payment and refund integration is connected. Contact support.';
  elsif o.status is null or o.status not in ('pending','confirmed','processing') then v_reason:='This order can no longer be cancelled here. Contact support for help.';
  elsif o.created_at is null or now()>=o.created_at+interval '30 minutes' then v_reason:='The 30-minute cancellation window has ended. Contact support for cancellation or return help.';
  elsif not exists(select 1 from public.order_items where order_id=o.id) or exists(select 1 from public.order_items where order_id=o.id and (fulfillment_status is null or fulfillment_status not in ('pending','confirmed') or released_at is not null)) then
    v_reason:='An item is already dispatched, ready for pickup or under review. Contact support for help.';
  end if;
  return jsonb_build_object('cancelled',false,'can_cancel',v_reason is null,'reason',v_reason,
    'deadline',o.created_at+interval '30 minutes','is_trial',o.is_trial,'refund_amount',0,'retained_service_fee',0);
end $$;

create function public.cm_cancel_buyer_order(p_order_id uuid,p_reason text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; v_quote jsonb; r record;
begin
  if auth.uid() is null then raise exception 'Sign in to cancel your order.'; end if;
  if coalesce(length(btrim(p_reason)),0)>500 then raise exception 'Keep the cancellation reason under 500 characters.'; end if;
  -- Match delivery RPC lock order: item(s), then parent order. Serialize multi-item requests by ID.
  perform 1 from public.order_items i join public.orders x on x.id=i.order_id
    where x.id=p_order_id and x.user_id=auth.uid() order by i.id for update of i;
  select * into o from public.orders where id=p_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'This order is not available.'; end if;
  v_quote:=public.cm_order_cancellation_quote(o.id);
  if (v_quote->>'cancelled')::boolean then return v_quote; end if;
  if (v_quote->>'can_cancel')::boolean is not true then raise exception '%',v_quote->>'reason'; end if;
  -- No stock was reserved or money collected for a trial: never add inventory or fabricate refunds.
  insert into public.order_cancellations(order_id,buyer_id,reason,is_trial,refund_amount,retained_service_fee,refund_status)
    values(o.id,auth.uid(),nullif(btrim(p_reason),''),true,0,0,'not_charged');
  update public.order_items set fulfillment_status='cancelled',auto_release_at=null where order_id=o.id;
  update public.orders set status='cancelled' where id=o.id;
  for r in select id from public.order_items where order_id=o.id order by id loop
    perform public.cm_delivery_event(r.id,'cancelled','The buyer cancelled this trial order within 30 minutes. Do not fulfil it. No payment was collected or refunded.');
  end loop;
  return public.cm_order_cancellation_quote(o.id);
end $$;
revoke all on function public.cm_order_cancellation_quote(uuid),public.cm_cancel_buyer_order(uuid,text) from public,anon,authenticated;
grant execute on function public.cm_order_cancellation_quote(uuid),public.cm_cancel_buyer_order(uuid,text) to authenticated;
-- Cancelled trials have no remaining financial obligation. Keep other closure safeguards intact.
do $$
declare definition text;
begin
  if to_regprocedure('public.cm_admin_review_account_change(uuid,text,text)') is not null then
    select pg_get_functiondef('public.cm_admin_review_account_change(uuid,text,text)'::regprocedure) into definition;
    if strpos(definition,'i.fulfillment_status not in (''received'',''refunded'')')=0 then
      raise exception 'Account closure rules changed. Review the cancellation integration before applying this migration.';
    end if;
    definition:=replace(definition,'i.fulfillment_status not in (''received'',''refunded'')',
      '(i.fulfillment_status not in (''received'',''refunded'') and not (i.fulfillment_status=''cancelled'' and o.is_trial and exists(select 1 from public.order_cancellations c where c.order_id=o.id and c.refund_status=''not_charged'')))');
    execute definition;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
