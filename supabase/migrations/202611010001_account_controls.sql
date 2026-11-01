-- Apply after 202610310005. Self-service store closure, durable privacy requests
-- and reviewed account deactivation. This migration does not erase user data.
begin;

alter table public.sellers add column store_closed_at timestamptz;

create table public.account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null
);
alter table public.account_access enable row level security;
revoke all on public.account_access from public,anon,authenticated;

create function public.cm_account_is_active(p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
  select p_user_id is not null and not exists(select 1 from public.account_access where user_id=p_user_id and closed_at is not null);
$$;
revoke all on function public.cm_account_is_active(uuid) from public,anon,authenticated;
grant execute on function public.cm_account_is_active(uuid) to authenticated,service_role;

create table public.account_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('delete_data','close_account','close_both')),
  status text not null default 'pending' check(status in ('pending','in_review','completed','declined','cancelled')),
  note text check(length(note)<=1000),
  admin_note text check(length(admin_note)<=2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index account_change_one_open_kind on public.account_change_requests(user_id,kind) where status in ('pending','in_review');
create index account_change_review_queue on public.account_change_requests(status,created_at);
alter table public.account_change_requests enable row level security;
revoke all on public.account_change_requests from public,anon,authenticated;
grant select on public.account_change_requests to authenticated;
create policy account_change_read on public.account_change_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());

create table public.account_change_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_change_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.account_change_events enable row level security;
revoke all on public.account_change_events from public,anon,authenticated;
grant select on public.account_change_events to authenticated;
create policy account_change_event_read on public.account_change_events for select to authenticated using(exists(select 1 from public.account_change_requests r where r.id=request_id and (r.user_id=auth.uid() or public.is_admin())));

create function public.cm_account_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_store public.sellers;
begin
  if v_user is null then raise exception 'Please sign in to manage your account.'; end if;
  select * into v_store from public.sellers where user_id=v_user;
  return jsonb_build_object('active',public.cm_account_is_active(v_user),'closed_at',(select closed_at from public.account_access where user_id=v_user),
    'has_store',v_store.id is not null,'store_closed_at',v_store.store_closed_at,
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'status',r.status,'note',r.note,'admin_note',r.admin_note,'created_at',r.created_at,'reviewed_at',r.reviewed_at) order by r.created_at desc) from public.account_change_requests r where r.user_id=v_user),'[]'::jsonb));
end $$;

create function public.cm_set_store_closed(p_closed boolean) returns void language plpgsql security definer set search_path='' as $$
declare v_store uuid;
begin
  if auth.uid() is null or p_closed is null then raise exception 'Please sign in and choose a store action.'; end if;
  if not public.cm_account_is_active() then raise exception 'This account is closed. Contact support about reopening.'; end if;
  select id into v_store from public.sellers where user_id=auth.uid() for update;
  if not found then raise exception 'There is no store on this account.'; end if;
  update public.sellers set store_closed_at=case when p_closed then coalesce(store_closed_at,now()) else null end where id=v_store;
  if p_closed then update public.products set status='draft' where seller_id=v_store and status='active'; end if;
end $$;

create function public.cm_request_account_change(p_kind text,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_store public.sellers;
begin
  if auth.uid() is null then raise exception 'Please sign in to submit a request.'; end if;
  if p_kind is null or p_kind not in ('delete_data','close_account','close_both') or coalesce(length(p_note),0)>1000 then raise exception 'Choose a valid request and keep your note within 1,000 characters.'; end if;
  if not public.cm_account_is_active() and p_kind<>'delete_data' then raise exception 'This account is already closed. Contact support if you need help.'; end if;
  perform 1 from public.users where id=auth.uid() for update;
  select * into v_store from public.sellers where user_id=auth.uid();
  -- Idempotent retries return the original pending request rather than duplicating it.
  select id into v_id from public.account_change_requests where user_id=auth.uid() and status in ('pending','in_review')
    and (kind=p_kind or (p_kind in ('close_account','close_both') and kind in ('close_account','close_both'))) order by created_at limit 1;
  if found then return v_id; end if;
  if p_kind='close_account' and v_store.id is not null and v_store.store_closed_at is null then raise exception 'Close your store first, or choose account and store together.'; end if;
  if p_kind='close_both' and v_store.id is not null then perform public.cm_set_store_closed(true); end if;
  insert into public.account_change_requests(user_id,kind,note) values(auth.uid(),p_kind,nullif(btrim(p_note),'')) returning id into v_id;
  insert into public.account_change_events(request_id,actor_id,status,note) values(v_id,auth.uid(),'pending','Request submitted by the account owner.');
  return v_id;
end $$;

create function public.cm_cancel_account_change(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.account_change_requests set status='cancelled' where id=p_id and user_id=auth.uid() and status='pending';
  if not found then raise exception 'Only a pending request belonging to your account can be cancelled.'; end if;
  insert into public.account_change_events(request_id,actor_id,status,note) values(p_id,auth.uid(),'cancelled','Cancelled by the account owner. Store closure is not reversed by cancellation.');
end $$;

create function public.cm_admin_account_requests(p_view text default 'open') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access is required.'; end if;
  return coalesce((select jsonb_agg(row_to_json(q) order by q.created_at) from (
    select r.*,u.full_name,u.email,s.store_name,s.store_closed_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'note',e.note,'created_at',e.created_at) order by e.created_at) from public.account_change_events e where e.request_id=r.id),'[]'::jsonb) events
    from public.account_change_requests r left join public.users u on u.id=r.user_id left join public.sellers s on s.user_id=r.user_id
    where case when p_view='closed' then r.status not in ('pending','in_review') else r.status in ('pending','in_review') end
    order by r.created_at limit 100
  )q),'[]'::jsonb);
end $$;

create function public.cm_admin_review_account_change(p_id uuid,p_action text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.account_change_requests; v_status text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access is required.'; end if;
  if p_action is null or p_action not in ('in_review','decline','approve_closure') or coalesce(length(btrim(p_note)),0) not between 10 and 2000 then raise exception 'Choose a review action and explain the outcome in 10 to 2,000 characters.'; end if;
  select * into r from public.account_change_requests where id=p_id for update;
  if not found or r.status not in ('pending','in_review') then raise exception 'This request is no longer open.'; end if;
  if p_action='approve_closure' then
    if r.kind='delete_data' then raise exception 'Data removal is handled separately. A review action does not erase data.'; end if;
    if r.user_id=auth.uid() then raise exception 'Another administrator must review your own account closure.'; end if;
    -- Serialize closure with checkout's profile lock; never strand open orders or money.
    perform 1 from public.users where id=r.user_id for update;
    if exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id left join public.sellers s on s.id=i.seller_id
      where (o.user_id=r.user_id or s.user_id=r.user_id) and
      (i.fulfillment_status not in ('received','refunded') or (i.fulfillment_status='received' and i.released_at is null))) then
      raise exception 'Resolve open orders, delivery reviews and disputes before closing this account.';
    end if;
    if exists(select 1 from public.sellers where user_id=r.user_id and coalesce(wallet_balance,0)<>0) then raise exception 'Settle the vendor wallet before closing this account.'; end if;
    if r.kind='close_account' and exists(select 1 from public.sellers where user_id=r.user_id and store_closed_at is null) then raise exception 'The store is open. Ask the owner to close it or request both closures.'; end if;
    update public.sellers set store_closed_at=coalesce(store_closed_at,now()) where user_id=r.user_id;
    update public.products set status='draft' where seller_id in(select id from public.sellers where user_id=r.user_id) and status='active';
    insert into public.account_access(user_id,closed_at,closed_by) values(r.user_id,now(),auth.uid()) on conflict(user_id) do update set closed_at=excluded.closed_at,closed_by=excluded.closed_by;
    v_status:='completed';
  else v_status:=case when p_action='decline' then 'declined' else 'in_review' end;
  end if;
  update public.account_change_requests set status=v_status,admin_note=btrim(p_note),reviewed_at=now(),reviewed_by=auth.uid() where id=r.id;
  insert into public.account_change_events(request_id,actor_id,status,note) values(r.id,auth.uid(),v_status,btrim(p_note));
end $$;

-- State changes must go through the checked RPC, even if an old grant permits seller updates.
create function public.cm_protect_store_closure() returns trigger language plpgsql set search_path='' as $$
begin
  if new.store_closed_at is distinct from old.store_closed_at and current_user in ('anon','authenticated') then raise exception 'Use account controls to close or reopen a store.'; end if;
  return new;
end $$;
create trigger cm_protect_store_closure before update of store_closed_at on public.sellers for each row execute function public.cm_protect_store_closure();

create function public.cm_guard_active_store_listing() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sellers;
begin
  if new.status='active' then
    select * into s from public.sellers where id=new.seller_id for share;
    if s.store_closed_at is not null or not public.cm_account_is_active(s.user_id) then raise exception 'This store is closed. Reopen it before publishing a listing.'; end if;
  end if;
  return new;
end $$;
create trigger cm_guard_active_store_listing before insert or update of status,seller_id on public.products for each row execute function public.cm_guard_active_store_listing();

create function public.cm_guard_active_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.users where id=new.user_id for share;
  if not public.cm_account_is_active(new.user_id) then raise exception 'This account is closed. Contact support before placing another order.'; end if;
  return new;
end $$;
create trigger cm_guard_active_order before insert on public.orders for each row execute function public.cm_guard_active_order();

create function public.cm_guard_open_store_order_item() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sellers;
begin
  select * into s from public.sellers where id=new.seller_id for share;
  if s.store_closed_at is not null or not public.cm_account_is_active(s.user_id) then raise exception 'An item belongs to a closed store. Remove it from your cart.'; end if;
  return new;
end $$;
create trigger cm_guard_open_store_order_item before insert on public.order_items for each row execute function public.cm_guard_open_store_order_item();

create function public.cm_guard_closed_account_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not public.cm_account_is_active() then raise exception 'This account is closed. Account controls and support remain available.'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
do $$declare t text;begin
  foreach t in array array['users','sellers','products','orders','order_items','cart_items','wishlist','saved_searches','buyer_conversations','buyer_messages','reviews','notifications','order_deliveries','order_tracking_events'] loop
    if to_regclass('public.'||t) is not null then
      execute format('create trigger cm_guard_closed_account_write before insert or update or delete on public.%I for each row execute function public.cm_guard_closed_account_write()',t);
      execute format('create policy cm_closed_account_guard on public.%I as restrictive for all to authenticated using(public.cm_account_is_active()) with check(public.cm_account_is_active())',t);
    end if;
  end loop;
end $$;

revoke all on function public.cm_account_status(),public.cm_set_store_closed(boolean),public.cm_request_account_change(text,text),public.cm_cancel_account_change(uuid),public.cm_admin_account_requests(text),public.cm_admin_review_account_change(uuid,text,text) from public,anon,authenticated;
grant execute on function public.cm_account_status(),public.cm_set_store_closed(boolean),public.cm_request_account_change(text,text),public.cm_cancel_account_change(uuid),public.cm_admin_account_requests(text),public.cm_admin_review_account_change(uuid,text,text) to authenticated;
revoke all on function public.cm_protect_store_closure(),public.cm_guard_active_store_listing(),public.cm_guard_active_order(),public.cm_guard_open_store_order_item(),public.cm_guard_closed_account_write() from public,anon,authenticated;
commit;
