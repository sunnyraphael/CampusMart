-- Apply after store management. No customer, order or payment records are deleted.
begin;
create table public.operations_settings(id boolean primary key default true check(id),settings jsonb not null default '{"database_limit":500000000,"storage_limit":1000000000,"egress_limit":5000000000,"cached_egress_limit":5000000000,"maintenance":false}'::jsonb,updated_at timestamptz not null default now());
insert into public.operations_settings(id) values(true);
create table public.operations_samples(id uuid primary key default gen_random_uuid(),observed_at timestamptz not null default now(),database_bytes bigint not null,storage_bytes bigint not null,objects bigint not null,cleanup_pending bigint not null,refunds_pending bigint not null,transfers_pending bigint not null);
create table public.operations_alerts(metric text primary key,severity text not null check(severity in ('warning','critical')),percent numeric not null,opened_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.action_limits(user_id uuid not null references public.users(id) on delete cascade,scope text not null,window_start timestamptz not null,hits int not null,primary key(user_id,scope,window_start));
alter table public.operations_settings enable row level security;alter table public.operations_samples enable row level security;alter table public.operations_alerts enable row level security;alter table public.action_limits enable row level security;
revoke all on public.operations_settings,public.operations_samples,public.operations_alerts,public.action_limits from public,anon,authenticated;
grant all on public.operations_settings,public.operations_samples,public.operations_alerts,public.action_limits to service_role;
create index if not exists products_seller_status_created on public.products(seller_id,status,created_at desc,id);
create index if not exists orders_buyer_created on public.orders(user_id,created_at desc,id);
create index if not exists order_items_seller_order on public.order_items(seller_id,order_id);
create index if not exists conversations_buyer_recent on public.buyer_conversations(buyer_id,updated_at desc,id);
create index if not exists conversations_vendor_recent on public.buyer_conversations(vendor_id,updated_at desc,id);
create index if not exists notifications_user_unread on public.notifications(user_id,is_read,created_at desc);
create index if not exists paystack_poll_fair on public.paystack_payments(mode,last_checked_at) where state in ('created','pending','expired');
create index if not exists paystack_refund_poll on public.paystack_refunds(updated_at) where state not in ('processed','rejected');

create function public.cm_health_ping() returns boolean language sql stable set search_path='' as $$select current_setting('default_transaction_read_only')='off'$$;
create function public.cm_checkout_available() returns boolean language sql stable security definer set search_path='' as $$select not coalesce((select (settings->>'maintenance')::boolean from public.operations_settings where id),false)$$;
create function public.cm_order_maintenance_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
  if not public.cm_checkout_available() then raise exception 'Ordering is temporarily unavailable. Your cart is saved; please try again later.';end if;return new;
end $$;
create trigger cm_order_maintenance_guard before insert on public.orders for each row execute function public.cm_order_maintenance_guard();

create function public.cm_allow_action(p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare v_limit int;v_window timestamptz;v_hits int;
begin
  if auth.uid() is null then raise exception 'Sign in first.';end if;
  v_limit:=case p_scope when 'support' then 5 when 'conversation' then 20 when 'saved_search' then 30 when 'profile' then 20 when 'publish' then 30 else null end;
  if v_limit is null then raise exception 'Invalid request type.';end if;
  v_window:=date_trunc('hour',now());
  insert into public.action_limits(user_id,scope,window_start,hits) values(auth.uid(),p_scope,v_window,1)
    on conflict(user_id,scope,window_start) do update set hits=public.action_limits.hits+1 returning hits into v_hits;
  if v_hits>v_limit then raise exception 'Too many requests. Please wait before trying again.';end if;
end $$;

create function public.cm_image_referenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  with names as(select p_name name union select regexp_replace(p_name,'-thumb[.]webp$','-full.webp') union select regexp_replace(p_name,'-full[.]webp$','-thumb.webp'))
  select exists(select 1 from names n,public.products p,unnest(coalesce(p.images,'{}')) u(url) where right(u.url,length('/storage/v1/object/public/product-images/'||n.name))='/storage/v1/object/public/product-images/'||n.name)
    or exists(select 1 from names n,public.sellers s where right(s.logo_url,length('/storage/v1/object/public/product-images/'||n.name))='/storage/v1/object/public/product-images/'||n.name);
$$;
-- Both siblings are protected by the original upload URL's advisory lock.
create or replace function public.cm_lock_listing_images() returns trigger language plpgsql security definer set search_path='' as $$
declare old_images text[]:='{}';new_images text[]:='{}';image text;related text;
begin
  if tg_op<>'INSERT' then old_images:=coalesce(old.images,'{}');end if;
  if tg_op<>'DELETE' then new_images:=coalesce(new.images,'{}');end if;
  for image in select distinct u.url from unnest(old_images||new_images) u(url) where u.url is not null order by u.url loop
    for related in select image union select regexp_replace(image,'-thumb[.]webp$','-full.webp') union select regexp_replace(image,'-full[.]webp$','-thumb.webp') order by 1 loop
      perform pg_advisory_xact_lock(hashtextextended(related,3));
    end loop;
  end loop;
  if exists(select 1 from public.listing_image_cleanup q,unnest(new_images) u(url) where q.status in ('pending','deleting','deleted') and q.image_url in(u.url,regexp_replace(u.url,'-full[.]webp$','-thumb.webp'),regexp_replace(u.url,'-thumb[.]webp$','-full.webp'))) then raise exception 'A photo is being removed. Upload a new copy.';end if;
  if tg_op='DELETE' then return old;end if;return new;
end $$;
create or replace function public.cm_queue_unused_listing_images() returns trigger language plpgsql security definer set search_path='' as $$
declare image text;related text;remaining text[]:='{}';
begin
  if tg_op='UPDATE' then remaining:=coalesce(new.images,'{}');end if;
  for image in select distinct u.url from unnest(coalesce(old.images,'{}')) u(url) where u.url is not null loop
    if not(image=any(remaining)) and strpos(image,'/storage/v1/object/public/product-images/'||old.seller_id::text||'/')>0 and not exists(select 1 from public.products where images @> array[image]) then
      for related in select image union select regexp_replace(image,'-full[.]webp$','-thumb.webp') loop
        insert into public.listing_image_cleanup(vendor_id,image_url) values(old.seller_id,related) on conflict(image_url) do nothing;
      end loop;
    end if;
  end loop;return null;
end $$;

create function public.cm_upload_budget() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end) from storage.objects),0)<
    coalesce((select (settings->>'storage_limit')::bigint from public.operations_settings where id),1000000000)*0.9;
$$;
create function public.cm_storage_upload_allowed(p_bucket text,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare s public.sellers;
begin
  if auth.uid() is null or not public.cm_account_is_active(auth.uid()) or not public.cm_upload_budget() then return false;end if;
  if p_bucket not in ('product-images','kyc-documents') then return false;end if;
  if p_bucket='kyc-documents' and split_part(p_name,'/',1)<>auth.uid()::text then return false;end if;
  if p_bucket='product-images' then
    select * into s from public.sellers where user_id=auth.uid();
    if not found or s.store_closed_at is not null or s.admin_closed or split_part(p_name,'/',1)<>s.id::text then return false;end if;
  end if;
  return (select count(*) from storage.objects where bucket_id=p_bucket and split_part(name,'/',1)=split_part(p_name,'/',1) and created_at>now()-interval '1 hour')<120;
end $$;
create policy cm_public_upload_budget on storage.objects as restrictive for insert to authenticated with check(bucket_id not in ('product-images','kyc-documents') or public.cm_storage_upload_allowed(bucket_id,name));
create policy cm_immutable_public_photos on storage.objects as restrictive for update to authenticated using(bucket_id<>'product-images') with check(bucket_id<>'product-images');
update storage.buckets set file_size_limit=1048576,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='product-images';

create function public.cm_queue_orphan_images(p_origin text) returns int language plpgsql security definer set search_path='' as $$
declare r record;related text;v_count int:=0;v_url text;
begin
  if p_origin !~ '^https?://[^/]+$' then raise exception 'Invalid storage origin.';end if;
  for r in select o.name,s.id seller_id from storage.objects o join public.sellers s on split_part(o.name,'/',1)=s.id::text where o.bucket_id='product-images' and o.created_at<now()-interval '48 hours' and not public.cm_image_referenced(o.name)
    and not exists(select 1 from public.listing_image_cleanup q where q.image_url=p_origin||'/storage/v1/object/public/product-images/'||o.name) order by o.created_at limit 50 loop
    v_url:=p_origin||'/storage/v1/object/public/product-images/'||r.name;
    for related in select v_url union select regexp_replace(v_url,'-thumb[.]webp$','-full.webp') union select regexp_replace(v_url,'-full[.]webp$','-thumb.webp') order by 1 loop perform pg_advisory_xact_lock(hashtextextended(related,3));end loop;
    if not public.cm_image_referenced(r.name) then insert into public.listing_image_cleanup(vendor_id,image_url) values(r.seller_id,v_url) on conflict(image_url) do nothing;v_count:=v_count+1;end if;
  end loop;return v_count;
end $$;
create function public.cm_operations_sample() returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.operations_samples;r record;lim bigint;pct numeric;cfg jsonb;
begin
  select settings into cfg from public.operations_settings where id;
  insert into public.operations_samples(database_bytes,storage_bytes,objects,cleanup_pending,refunds_pending,transfers_pending)
    select pg_database_size(current_database()),coalesce((select sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end) from storage.objects),0),(select count(*) from storage.objects),
      (select count(*) from public.listing_image_cleanup where status in ('pending','deleting')),(select count(*) from public.paystack_refunds where state<>'processed'),(select count(*) from public.paystack_transfers where state not in ('success','failed','reversed','abandoned')) returning * into v;
  for r in select 'database' metric,v.database_bytes used union all select 'storage',v.storage_bytes union all select 'egress',coalesce((cfg->>'egress_used')::bigint,0) union all select 'cached_egress',coalesce((cfg->>'cached_egress_used')::bigint,0) loop
    lim:=nullif((cfg->>(r.metric||'_limit'))::bigint,0);pct:=round(r.used*100.0/lim,1);
    if pct>=70 then insert into public.operations_alerts(metric,severity,percent) values(r.metric,case when pct>=85 then 'critical' else 'warning' end,pct) on conflict(metric) do update set severity=excluded.severity,percent=excluded.percent,updated_at=now();
    else delete from public.operations_alerts where metric=r.metric;end if;
  end loop;
  -- Only operational telemetry expires. Never delete messages, orders or finance records here.
  delete from public.operations_samples where observed_at<now()-interval '14 days';
  delete from public.action_limits where window_start<now()-interval '2 days';
  return to_jsonb(v)||jsonb_build_object('critical_alerts',(select count(*) from public.operations_alerts where severity='critical'));
end $$;
create function public.cm_admin_operations(p_settings jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;
begin
  if auth.uid() is null or public.is_admin() is not true then raise exception 'Administrator access required.';end if;
  if p_settings is not null then
    for k in select jsonb_object_keys(p_settings) loop
      if k not in ('database_limit','storage_limit','egress_limit','cached_egress_limit','egress_used','cached_egress_used','usage_as_of','maintenance') then raise exception 'Invalid setting.';end if;
      if k not in ('usage_as_of','maintenance') and ((p_settings->>k) !~ '^[0-9]{1,14}$' or (k like '%limit' and (p_settings->>k)::bigint<1000000)) then raise exception 'Enter valid byte amounts.';end if;
    end loop;
    if p_settings ? 'maintenance' and jsonb_typeof(p_settings->'maintenance')<>'boolean' then raise exception 'Invalid maintenance setting.';end if;
    if p_settings ? 'usage_as_of' then perform (p_settings->>'usage_as_of')::timestamptz;end if;
    update public.operations_settings set settings=settings||p_settings,updated_at=now() where id;
  end if;
  return jsonb_build_object('settings',(select settings from public.operations_settings where id),'sample',(select to_jsonb(s) from public.operations_samples s order by observed_at desc limit 1),'alerts',coalesce((select jsonb_agg(a) from public.operations_alerts a),'[]'::jsonb));
end $$;

-- Replace bulky inbox downloads in navigation with one scalar count.
create function public.cm_unread_message_count() returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from public.buyer_messages m join public.buyer_conversations c on c.id=m.conversation_id join public.sellers s on s.id=c.vendor_id
  where m.sender_id<>auth.uid() and ((c.buyer_id=auth.uid() and m.created_at>coalesce(c.buyer_read_at,'epoch')) or (s.user_id=auth.uid() and m.created_at>coalesce(c.vendor_read_at,'epoch')));
$$;
create function public.cm_conversations_page(p_offset int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid inbox page.';end if;
  return coalesce((select jsonb_agg(q) from(
    select c.id,case when c.buyer_id=auth.uid() then s.store_name else coalesce(nullif(u.full_name,''),'CampusMart buyer') end other_name,c.product_id,c.updated_at,
      (select m.body from public.buyer_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) last_message,
      (select count(*) from public.buyer_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid() and m.created_at>case when c.buyer_id=auth.uid() then c.buyer_read_at else c.vendor_read_at end) unread_count
    from(select c.* from public.buyer_conversations c join public.sellers s on s.id=c.vendor_id where c.buyer_id=auth.uid() or s.user_id=auth.uid() order by c.updated_at desc,c.id desc limit 21 offset p_offset)c
    join public.sellers s on s.id=c.vendor_id left join public.users u on u.id=c.buyer_id order by c.updated_at desc,c.id desc)q),'[]'::jsonb);
end $$;
revoke all on function public.cm_health_ping(),public.cm_checkout_available(),public.cm_order_maintenance_guard(),public.cm_allow_action(text),public.cm_image_referenced(text),public.cm_upload_budget(),public.cm_storage_upload_allowed(text,text),public.cm_queue_orphan_images(text),public.cm_operations_sample(),public.cm_admin_operations(jsonb),public.cm_unread_message_count(),public.cm_conversations_page(int) from public,anon,authenticated;
grant execute on function public.cm_health_ping(),public.cm_checkout_available() to anon,authenticated,service_role;
grant execute on function public.cm_allow_action(text),public.cm_upload_budget(),public.cm_storage_upload_allowed(text,text),public.cm_admin_operations(jsonb),public.cm_unread_message_count(),public.cm_conversations_page(int) to authenticated;
grant execute on function public.cm_queue_orphan_images(text),public.cm_operations_sample(),public.cm_image_referenced(text) to service_role;
create or replace function public.cm_store_logo_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare related text;
begin
  if new.logo_url is not null and new.logo_url is distinct from old.logo_url then
    for related in select new.logo_url union select regexp_replace(new.logo_url,'-thumb[.]webp$','-full.webp') union select regexp_replace(new.logo_url,'-full[.]webp$','-thumb.webp') order by 1 loop perform pg_advisory_xact_lock(hashtextextended(related,3));end loop;
    if exists(select 1 from public.listing_image_cleanup where status in ('pending','deleting','deleted') and image_url in(new.logo_url,regexp_replace(new.logo_url,'-full[.]webp$','-thumb.webp'),regexp_replace(new.logo_url,'-thumb[.]webp$','-full.webp'))) then raise exception 'This photo was removed or is queued for removal. Upload a new logo.';end if;
    if new.store_closed_at is not null then raise exception 'Reopen the store before uploading a new logo.';end if;
  end if;return new;
end $$;
create or replace function public.cm_can_remove_listing_image(p_bucket text,p_name text) returns boolean language sql stable security definer set search_path='' as $$
  select p_bucket='product-images' and not public.cm_image_referenced(p_name) and exists(select 1 from public.listing_image_cleanup q join public.sellers s on s.id=q.vendor_id where s.user_id=auth.uid() and q.status='deleting' and p_name like s.id::text||'/%' and right(q.image_url,length('/storage/v1/object/public/product-images/'||p_name))='/storage/v1/object/public/product-images/'||p_name);
$$;
create function public.cm_claim_operations_cleanup() returns table(id uuid,image_url text,vendor_id uuid,lease_token uuid) language plpgsql security definer set search_path='' as $$
declare r record;token uuid;
begin
  for r in select q.id,q.image_url from public.listing_image_cleanup q where (q.status='pending' or(q.status='deleting' and q.leased_at<now()-interval '5 minutes')) and not public.cm_image_referenced(split_part(q.image_url,'/storage/v1/object/public/product-images/',2)) order by q.created_at limit 5 for update skip locked loop
    token:=gen_random_uuid();
    return query update public.listing_image_cleanup q set status='deleting',lease_token=token,leased_at=now() where q.id=r.id returning q.id,q.image_url,q.vendor_id,q.lease_token;
  end loop;
end $$;
create function public.cm_finish_operations_cleanup(p_id uuid,p_token uuid,p_success boolean) returns void language plpgsql security definer set search_path='' as $$begin
  update public.listing_image_cleanup set status=case when p_success then 'deleted' else 'pending' end,lease_token=null,leased_at=null where id=p_id and lease_token=p_token and status='deleting';
end $$;
create function public.cm_limit_insert() returns trigger language plpgsql security definer set search_path='' as $$begin
  if auth.uid() is not null then perform public.cm_allow_action(case tg_table_name when 'support_requests' then 'support' when 'buyer_conversations' then 'conversation' else 'saved_search' end);end if;return new;
end $$;
create trigger cm_support_limit before insert on public.support_requests for each row execute function public.cm_limit_insert();
create trigger cm_conversation_limit before insert on public.buyer_conversations for each row execute function public.cm_limit_insert();
create trigger cm_saved_limit before insert on public.saved_searches for each row execute function public.cm_limit_insert();
create function public.cm_account_summary() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
  if auth.uid() is null then raise exception 'Sign in first.';end if;
  return jsonb_build_object('role',(select role from public.users where id=auth.uid()),'full_name',(select full_name from public.users where id=auth.uid()),'seller_id',(select id from public.sellers where user_id=auth.uid()),'is_admin',public.is_admin(),
    'favorites',coalesce((select jsonb_agg(product_id) from public.wishlist where user_id=auth.uid()),'[]'::jsonb),'notifications',(select count(*) from public.notifications where user_id=auth.uid() and not is_read),'messages',public.cm_unread_message_count());
end $$;
revoke all on function public.cm_claim_operations_cleanup(),public.cm_finish_operations_cleanup(uuid,uuid,boolean),public.cm_limit_insert(),public.cm_account_summary() from public,anon,authenticated;
grant execute on function public.cm_claim_operations_cleanup(),public.cm_finish_operations_cleanup(uuid,uuid,boolean) to service_role;
grant execute on function public.cm_account_summary() to authenticated;
create function public.cm_vendor_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare seller uuid;result jsonb;
begin
  select id into seller from public.sellers where user_id=auth.uid();
  if auth.uid() is null or seller is null then raise exception 'Vendor access required.';end if;
  with items as(select i.*,o.created_at,p.title,p.images from public.order_items i join public.orders o on o.id=i.order_id left join public.products p on p.id=i.product_id
    where i.seller_id=seller and o.payment_status='paid' and not coalesce(o.is_trial,false) and o.payment_environment is distinct from 'test'),
  sales as(select * from items where fulfillment_status not in ('refunded','cancelled')),
  groups as(select order_id id,max(created_at) created_at,sum(coalesce(subtotal,0)) amount,count(*) "itemCount",(array_agg(title order by id))[1] "productName",(array_agg(images[1] order by id))[1] image,
    case when bool_or(fulfillment_status='disputed') then 'disputed' when bool_and(fulfillment_status in ('refunded','cancelled')) then 'refunded'
      else (array['pending','confirmed','shipped','delivered','received'])[min(case fulfillment_status when 'pending' then 1 when 'confirmed' then 2 when 'shipped' then 3 when 'delivered' then 4 when 'received' then 5 else 6 end)] end status from items group by order_id),
  days as(select (now() at time zone 'Africa/Lagos')::date-n as day from generate_series(6,0,-1) n)
  select jsonb_build_object('stats',jsonb_build_object('totalSales',coalesce((select sum(subtotal) from sales),0),'totalOrders',(select count(*) from groups),'unitsSold',coalesce((select sum(quantity) from sales),0),'activeListings',(select count(*) from public.products where seller_id=seller and status='active')),
    'attention',jsonb_build_object('orders',(select count(distinct order_id) from items where fulfillment_status in ('pending','confirmed','shipped')),'lowStock',(select count(*) from public.products where seller_id=seller and status='active' and availability is distinct from 'pre_order' and stock_quantity<=3),'drafts',(select count(*) from public.products where seller_id=seller and status='draft')),
    'chartData',(select jsonb_agg(jsonb_build_object('date',to_char(day,'FMDD Mon'),'sales',coalesce((select sum(subtotal) from sales where (created_at at time zone 'Africa/Lagos')::date=day),0)) order by day) from days),
    'recentOrders',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'productName',coalesce(g."productName",'Unavailable listing'),'image',g.image,'status',g.status,'itemCount',g."itemCount",'amount',g.amount,'createdAt',g.created_at)) from(select * from groups order by created_at desc,id limit 5)g),'[]'::jsonb),
    'topProducts',coalesce((select jsonb_agg(t) from(select coalesce(product_id::text,'deleted') id,coalesce(title,'Unavailable listing') name,images[1] image,sum(quantity) sold,sum(subtotal) revenue from sales group by product_id,title,images[1] order by sum(subtotal) desc limit 4)t),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.cm_vendor_overview() from public,anon,authenticated;
grant execute on function public.cm_vendor_overview() to authenticated;
create function public.cm_vendor_listing_counts() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('all',count(*),'active',count(*) filter(where p.status='active'),'draft',count(*) filter(where p.status='draft'),'low',count(*) filter(where p.status='active' and p.availability is distinct from 'pre_order' and p.stock_quantity<=3)) from public.products p join public.sellers s on s.id=p.seller_id where s.user_id=auth.uid();
$$;
create function public.cm_vendor_pending_earnings() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare seller uuid;result jsonb;
begin
  select id into seller from public.sellers where user_id=auth.uid();if auth.uid() is null or seller is null then raise exception 'Vendor access required.';end if;
  with items as(select i.id,i.order_id,i.fulfillment_status status,o.created_at,coalesce(i.payout_amount,i.subtotal-round(i.subtotal*.05,2)) amount,(i.fulfillment_status='disputed' or d.held_at is not null) held
    from public.order_items i join public.orders o on o.id=i.order_id left join public.order_deliveries d on d.item_id=i.id where i.seller_id=seller and i.released_at is null and o.payment_status='paid' and not coalesce(o.is_trial,false) and o.payment_environment is distinct from 'test' and i.fulfillment_status not in ('cancelled','refunded'))
  select jsonb_build_object('inProgress',coalesce(sum(amount) filter(where not held and status in ('pending','confirmed','shipped')),0),'awaitingBuyer',coalesce(sum(amount) filter(where not held and status in ('delivered','received')),0),'onHold',coalesce(sum(amount) filter(where held),0),
    'releasing',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amount',r.amount,'status',r.status,'orderId',r.order_id)) from(select * from items where not held and status in ('delivered','received') order by created_at desc,id limit 50)r),'[]'::jsonb)) into result from items;return result;
end $$;
revoke all on function public.cm_vendor_listing_counts(),public.cm_vendor_pending_earnings() from public,anon,authenticated;
grant execute on function public.cm_vendor_listing_counts(),public.cm_vendor_pending_earnings() to authenticated;
create function public.cm_conversation_header(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',c.id,'other_name',case when c.buyer_id=auth.uid() then s.store_name else coalesce(nullif(u.full_name,''),'CampusMart buyer') end,'product_id',c.product_id)
  from public.buyer_conversations c join public.sellers s on s.id=c.vendor_id left join public.users u on u.id=c.buyer_id where c.id=p_id and auth.uid() is not null and (c.buyer_id=auth.uid() or s.user_id=auth.uid());
$$;
revoke all on function public.cm_conversation_header(uuid) from public,anon,authenticated;
grant execute on function public.cm_conversation_header(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
