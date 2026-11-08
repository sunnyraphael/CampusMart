-- Apply after 202611030002_admin_password_and_pin.sql. No end date is scheduled.
-- Existing orders retain their old rate and recorded ledger amounts.
begin;
create table public.vendor_commission_settings (
 id boolean primary key default true check(id),
 rate numeric(5,4) not null check(rate between 0 and 1),
 terms_version text not null,
 updated_at timestamptz not null default now()
);
insert into public.vendor_commission_settings(id,rate,terms_version) values(true,0,'2026-11-05-launch-v1');
alter table public.vendor_commission_settings enable row level security;
revoke all on public.vendor_commission_settings from public,anon,authenticated;
grant all on public.vendor_commission_settings to service_role;
create function public.cm_vendor_commission_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('rate',rate,'terms_version',terms_version,'ends_at',null) from public.vendor_commission_settings where id;
$$;
revoke all on function public.cm_vendor_commission_policy() from public;
grant execute on function public.cm_vendor_commission_policy() to anon,authenticated,service_role;

-- Fast defaults preserve old rows without firing their legacy UPDATE triggers.
alter table public.order_items add column vendor_commission_rate numeric(5,4) not null default 0.05,add column vendor_fee_terms_version text not null default '2026-11-01';
alter table public.order_items alter column vendor_commission_rate drop default,alter column vendor_fee_terms_version drop default;
alter table public.order_items add constraint order_items_commission_rate_check check(vendor_commission_rate between 0 and 1);
create function public.cm_snapshot_vendor_commission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  select rate,terms_version into new.vendor_commission_rate,new.vendor_fee_terms_version from public.vendor_commission_settings where id;
  if new.vendor_commission_rate is null then raise exception 'Vendor commission setup is unavailable. Please retry later.';end if;
  new.commission_amount:=round(new.subtotal*new.vendor_commission_rate,2);
  new.payout_amount:=new.subtotal-new.commission_amount;
 elsif new.vendor_commission_rate is distinct from old.vendor_commission_rate or new.vendor_fee_terms_version is distinct from old.vendor_fee_terms_version then
  raise exception 'The vendor commission recorded on an order cannot be changed.';
 end if;
 return new;
end $$;
revoke all on function public.cm_snapshot_vendor_commission() from public,anon,authenticated;
create trigger cm_snapshot_vendor_commission before insert or update on public.order_items for each row execute function public.cm_snapshot_vendor_commission();

-- Preserve the current function OIDs, grants, PIN guard, payment verification,
-- delivery evidence checks and idempotency logic; replace only the fee factor.
do $fees$
declare fn record;definition text;replacement text;patched integer:=0;
begin
 for fn in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cm_admin_approve_delivery','cm_admin_delivery_queue','cm_vendor_pending_earnings') loop
  definition:=pg_get_functiondef(fn.oid);
  if fn.proname='cm_admin_approve_delivery' and position('cm_require_transaction_pin' in definition)=0 then raise exception 'Apply the administrator password and PIN migration before the launch fee migration.';end if;
  replacement:=regexp_replace(definition,'i\.subtotal\s*\*\s*0?\.05','i.subtotal*i.vendor_commission_rate','g');
  if replacement=definition then raise exception 'Expected commission calculation missing from %; no changes applied.',fn.proname;end if;
  if fn.proname='cm_admin_delivery_queue' then
   replacement:=replace(replacement,'round(i.subtotal*i.vendor_commission_rate,2) commission_amount,i.subtotal-round(i.subtotal*i.vendor_commission_rate,2) payout_amount','coalesce(i.commission_amount,round(i.subtotal*i.vendor_commission_rate,2)) commission_amount,coalesce(i.payout_amount,i.subtotal-round(i.subtotal*i.vendor_commission_rate,2)) payout_amount');
  end if;
  execute replacement;patched:=patched+1;
 end loop;
 if patched<>3 then raise exception 'Missing delivery or earnings function; apply the preceding migrations first.';end if;
end $fees$;
commit;
