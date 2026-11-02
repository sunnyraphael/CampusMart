-- Apply after 202611010006. Private management; existing orders remain intact.
begin;
alter table public.sellers add column owner_paused boolean not null default false,
  add column admin_paused boolean not null default false,
  add column admin_closed boolean not null default false;
grant select(owner_paused,admin_paused,admin_closed,store_closed_at) on public.sellers to authenticated;
create table public.store_visibility_restore(product_id uuid primary key references public.products(id) on delete cascade,seller_id uuid not null references public.sellers(id));
alter table public.store_visibility_restore enable row level security;
revoke all on public.store_visibility_restore from public,anon,authenticated;
create table public.store_management_events(id uuid primary key default gen_random_uuid(),seller_id uuid not null references public.sellers(id),actor_id uuid not null references public.users(id),action text not null,note text not null,created_at timestamptz not null default now());
alter table public.store_management_events enable row level security;
revoke all on public.store_management_events from public,anon,authenticated;
grant all on public.store_management_events,public.store_visibility_restore to service_role;

create function public.cm_store_visibility_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sellers;
begin
  select * into s from public.sellers where id=new.seller_id for share;
  if new.status='active' and (s.owner_paused or s.admin_paused or s.admin_closed or s.store_closed_at is not null) then raise exception 'This store is paused or closed. Resume it before publishing listings.';end if;
  return new;
end $$;
create trigger cm_store_visibility_guard before insert or update of status,seller_id on public.products for each row execute function public.cm_store_visibility_guard();
create function public.cm_store_flags_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and (new.owner_paused is distinct from old.owner_paused or new.admin_paused is distinct from old.admin_paused or new.admin_closed is distinct from old.admin_closed) then raise exception 'Use store management controls.';end if;
  if old.admin_closed and new.store_closed_at is null then raise exception 'Only an administrator can reopen this store.';end if;
  return new;
end $$;
create trigger cm_store_flags_guard before update on public.sellers for each row execute function public.cm_store_flags_guard();

create function public.cm_manage_store(p_seller uuid,p_action text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare s public.sellers;v_admin boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first.';end if;
  v_admin:=public.is_admin() is true;
  select * into s from public.sellers where id=p_seller for update;
  if not found or (not v_admin and s.user_id<>auth.uid()) then raise exception 'Store unavailable.';end if;
  if length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Record a reason of 5 to 1000 characters.';end if;
  if p_action not in ('pause','resume','close','reopen','purge_images') then raise exception 'Invalid store action.';end if;
  -- Lock items before products, consistent with checkout/refund routines.
  perform 1 from public.order_items where seller_id=s.id order by id for update;
  perform 1 from public.products where seller_id=s.id order by id for update;
  if p_action='pause' then
    insert into public.store_visibility_restore select id,seller_id from public.products where seller_id=s.id and status='active' on conflict do nothing;
    if v_admin then update public.sellers set admin_paused=true where id=s.id;else update public.sellers set owner_paused=true where id=s.id;end if;
    update public.products set status='draft' where seller_id=s.id and status='active';
  elsif p_action='resume' then
    if v_admin then update public.sellers set admin_paused=false where id=s.id;else update public.sellers set owner_paused=false where id=s.id;end if;
    select * into s from public.sellers where id=s.id;
    if not s.owner_paused and not s.admin_paused and not s.admin_closed and s.store_closed_at is null then
      update public.products set status='active' where seller_id=s.id and id in(select product_id from public.store_visibility_restore where seller_id=s.id) and status='draft';
      delete from public.store_visibility_restore where seller_id=s.id;
    end if;
  elsif p_action='close' then
    update public.sellers set store_closed_at=coalesce(store_closed_at,now()),admin_closed=admin_closed or v_admin where id=s.id;
    update public.products set status='draft' where seller_id=s.id and status='active';
    delete from public.store_visibility_restore where seller_id=s.id;
  elsif p_action='reopen' then
    if s.admin_closed and not v_admin then raise exception 'An administrator closed this store. Contact support.';end if;
    if v_admin then update public.sellers set admin_closed=false where id=s.id;end if;
    update public.sellers set store_closed_at=null where id=s.id;
  else
    if s.store_closed_at is null then raise exception 'Close the store before permanently removing its public images.';end if;
    if exists(select 1 from public.order_items where seller_id=s.id and (fulfillment_status not in ('received','refunded','cancelled') or (fulfillment_status='received' and released_at is null))) or
      coalesce(s.wallet_balance,0)<>0 or exists(select 1 from public.paystack_transfers where seller_id=s.id and state not in ('success','failed','reversed','abandoned')) or
      exists(select 1 from public.paystack_refunds r join public.order_items i on i.order_id=r.order_id where i.seller_id=s.id and r.state<>'processed') then raise exception 'Resolve orders, disputes, wallet balances, refunds and transfers before deleting store images.';end if;
    insert into public.listing_image_cleanup(vendor_id,image_url) select s.id,s.logo_url where s.logo_url is not null and strpos(s.logo_url,'/storage/v1/object/public/product-images/'||s.id::text||'/')>0 on conflict(image_url) do nothing;
    update public.products set images='{}',status='draft' where seller_id=s.id;
    update public.sellers set logo_url=null where id=s.id;
  end if;
  insert into public.store_management_events(seller_id,actor_id,action,note) values(s.id,auth.uid(),p_action,btrim(p_note));
end $$;

-- Prevent checkout through a stale cart, even if someone bypasses the UI.
create function public.cm_store_order_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sellers;
begin
  select * into s from public.sellers where id=new.seller_id for share;
  if s.owner_paused or s.admin_paused or s.admin_closed then raise exception 'This store is temporarily unavailable.';end if;
  return new;
end $$;
create trigger cm_store_order_guard before insert on public.order_items for each row execute function public.cm_store_order_guard();

create function public.cm_store_overview(p_seller uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.sellers;v_result jsonb;
begin
  select * into s from public.sellers where id=p_seller;
  if auth.uid() is null or not found or (s.user_id<>auth.uid() and public.is_admin() is not true) then raise exception 'Store unavailable.';end if;
  select jsonb_build_object('owner_paused',s.owner_paused,'admin_paused',s.admin_paused,'admin_closed',s.admin_closed,'closed',s.store_closed_at is not null,
    'listings',(select count(*) from public.products where seller_id=s.id),'published',(select count(*) from public.products where seller_id=s.id and status='active'),
    'orders',count(*),'completed',count(*) filter(where done),'unsuccessful',count(*) filter(where unsuccessful),
    'ongoing',count(*) filter(where not done and not unsuccessful),'disputes',coalesce(sum(disputes),0),
    'cleanup_pending',(select count(*) from public.listing_image_cleanup where vendor_id=s.id and status in ('pending','deleting'))) into v_result
  from (select i.order_id,bool_and(i.fulfillment_status='received' and i.released_at is not null) done,
    bool_and(i.fulfillment_status in ('cancelled','refunded')) unsuccessful,count(*) filter(where nullif(i.dispute_reason,'') is not null) disputes
    from public.order_items i join public.orders o on o.id=i.order_id where i.seller_id=s.id and not coalesce(o.is_trial,false) and o.payment_environment is distinct from 'test' and o.payment_status in ('paid','refunded') group by i.order_id) q;
  return v_result;
end $$;
revoke all on function public.cm_store_visibility_guard(),public.cm_store_flags_guard(),public.cm_store_order_guard(),public.cm_manage_store(uuid,text,text),public.cm_store_overview(uuid) from public,anon,authenticated;
grant execute on function public.cm_manage_store(uuid,text,text),public.cm_store_overview(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
