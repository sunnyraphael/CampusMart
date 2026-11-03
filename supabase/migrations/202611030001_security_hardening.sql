-- Apply after 202611020002_reliability.sql. No production data is deleted.
begin;
-- Preserve the original membership check's body, while keeping is_admin's OID
-- so existing RLS policies and checked RPCs inherit the MFA requirement.
do $$declare definition text;begin
  definition:=pg_get_functiondef('public.is_admin()'::regprocedure);
  execute replace(definition,'FUNCTION public.is_admin()','FUNCTION public.cm_admin_membership()');
end $$;
revoke all on function public.cm_admin_membership() from public,anon;
grant execute on function public.cm_admin_membership() to authenticated,service_role;
create function public.cm_admin_mfa_current() returns boolean language sql stable set search_path='' as $$
  select coalesce(auth.jwt()->>'aal'='aal2' and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m
    where m->>'method' in ('totp','phone','webauthn') and case when m->>'timestamp' ~ '^[0-9]{1,12}$' then to_timestamp((m->>'timestamp')::bigint) between now()-interval '15 minutes' and now()+interval '1 minute' else false end),false);
$$;
revoke all on function public.cm_admin_mfa_current() from public,anon;
grant execute on function public.cm_admin_mfa_current() to authenticated,service_role;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(public.cm_admin_membership(),false) and public.cm_admin_mfa_current();
$$;

-- Keep the menu entry discoverable while the administrator needs to unlock it.
do $$declare definition text;begin
  if to_regprocedure('public.cm_account_summary()') is not null then
    definition:=pg_get_functiondef('public.cm_account_summary()'::regprocedure);
    execute replace(definition,'public.is_admin()','public.cm_admin_membership()');
  end if;
end $$;

create table public.security_settings(id boolean primary key default true check(id),storage_origin text);
insert into public.security_settings(id) values(true);
alter table public.security_settings enable row level security;
revoke all on public.security_settings from public,anon,authenticated;
grant all on public.security_settings to service_role;
create function public.cm_configure_storage_origin(p_origin text) returns void language plpgsql security definer set search_path='' as $$begin
  if p_origin !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$' then raise exception 'Use the HTTPS Supabase Storage origin without a trailing slash.';end if;
  update public.security_settings set storage_origin=p_origin where id;
end $$;
revoke all on function public.cm_configure_storage_origin(text) from public,anon,authenticated;
grant execute on function public.cm_configure_storage_origin(text) to service_role;

-- Persistent per-user and network quotas. Network identities are HMACs derived
-- on the server from a hosting-verified IP header, never raw addresses.
create table public.security_budgets(key text not null,scope text not null,window_start timestamptz not null,hits int not null,primary key(key,scope,window_start));
alter table public.security_budgets enable row level security;
revoke all on public.security_budgets from public,anon,authenticated;
grant all on public.security_budgets to service_role;
create function public.cm_security_budget(p_key text,p_scope text) returns void language plpgsql security definer set search_path='' as $$
declare used int;cap int;begin
  if p_key !~ '^[a-f0-9]{64}$' or p_scope<>'checkout_network' then raise exception 'Invalid security budget.';end if;
  cap:=60;
  insert into public.security_budgets values(p_key,p_scope,date_trunc('hour',now()),1) on conflict(key,scope,window_start) do update set hits=public.security_budgets.hits+1 returning hits into used;
  if used>cap then raise exception 'Too many checkout attempts from this network. Please wait before trying again.';end if;
  delete from public.security_budgets where window_start<now()-interval '2 days';
end $$;
revoke all on function public.cm_security_budget(text,text) from public,anon,authenticated;
grant execute on function public.cm_security_budget(text,text) to service_role;

create function public.cm_reservation_limits() returns trigger language plpgsql security definer set search_path='' as $$begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if (select count(*) from public.paystack_payments where user_id=new.user_id and state in ('created','pending') and not stock_released)>=2 then raise exception 'You already have two unpaid checkouts. Complete or cancel them in My orders first.';end if;
  if exists(select 1 from public.order_items where order_id=new.order_id and quantity>5) or (select sum(quantity) from public.order_items where order_id=new.order_id)>25 then raise exception 'A checkout can reserve up to five of one item and 25 items overall. Contact the vendor for larger orders.';end if;
  return new;
end $$;
create trigger cm_reservation_limits before insert on public.paystack_payments for each row execute function public.cm_reservation_limits();
create index cm_due_payment_expirations on public.paystack_payments(expires_at) where state in ('created','pending') and provider_id is null and not stock_released;
create function public.cm_expire_reservations(p_mode text,p_limit int default 50) returns int language plpgsql security definer set search_path='' as $$
declare r record;n int:=0;begin
  if p_mode not in ('test','live') or p_limit not between 1 and 100 then raise exception 'Invalid expiration batch.';end if;
  for r in select reference from public.paystack_payments where mode=p_mode and state in ('created','pending') and expires_at<=now() and provider_id is null and not stock_released order by expires_at limit p_limit loop
    perform public.cm_expire_paystack_payment(r.reference);n:=n+1;
  end loop;return n;
end $$;
revoke all on function public.cm_expire_reservations(text,int),public.cm_reservation_limits() from public,anon,authenticated;
grant execute on function public.cm_expire_reservations(text,int) to service_role;
create function public.cm_claim_payment_check(p_reference text) returns boolean language plpgsql security definer set search_path='' as $$begin
  update public.paystack_payments set last_checked_at=now() where reference=p_reference and (last_checked_at is null or last_checked_at<now()-interval '15 seconds');return found;
end $$;
revoke all on function public.cm_claim_payment_check(text) from public,anon,authenticated;
grant execute on function public.cm_claim_payment_check(text) to service_role;

-- These triggers run even when the browser skips server actions.
create function public.cm_limit_profile_write() returns trigger language plpgsql security definer set search_path='' as $$begin
  if auth.uid() is not null and auth.role()='authenticated' and (new.full_name is distinct from old.full_name or new.phone is distinct from old.phone) then perform public.cm_allow_action('profile');end if;return new;
end $$;
create trigger cm_limit_profile_write before update on public.users for each row execute function public.cm_limit_profile_write();
create function public.cm_limit_listing_write() returns trigger language plpgsql security definer set search_path='' as $$begin
  if auth.uid() is not null and auth.role()='authenticated' then
    -- Clearing photos during store closure is not a new publication.
    if tg_op='UPDATE' and cardinality(coalesce(new.images,'{}'))=0 and new.title is not distinct from old.title and new.description is not distinct from old.description and new.price is not distinct from old.price and new.stock_quantity is not distinct from old.stock_quantity then return new;end if;
    perform public.cm_allow_action('publish');
    if tg_op='INSERT' and (select count(*) from public.products where seller_id=new.seller_id)>=200 then raise exception 'Your store has reached its 200 listing limit. Remove unused drafts or contact support.';end if;
  end if;return new;
end $$;
-- Status-only management changes must not consume hundreds of publication hits.
create trigger cm_limit_listing_write before insert or update of title,description,price,images,stock_quantity on public.products for each row execute function public.cm_limit_listing_write();

create function public.cm_owned_image(p_url text,p_seller uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.security_settings c join storage.objects o on o.bucket_id='product-images' and p_url=c.storage_origin||'/storage/v1/object/public/product-images/'||o.name where c.id and split_part(o.name,'/',1)=p_seller::text);
$$;
create function public.cm_validate_listing_media() returns trigger language plpgsql security definer set search_path='' as $$
declare image text;previous text[]:='{}';begin
  if tg_op='UPDATE' and new.seller_id is not distinct from old.seller_id then previous:=coalesce(old.images,'{}');end if;
  if cardinality(coalesce(new.images,'{}'))>5 then raise exception 'Use at most five listing photos.';end if;
  for image in select unnest(coalesce(new.images,'{}')) except select unnest(previous) loop
    if image is null or not public.cm_owned_image(image,new.seller_id) then raise exception 'Use photos uploaded to your own store. Storage origin setup may be required.';end if;
  end loop;return new;
end $$;
create trigger cm_validate_listing_media before insert or update of images,seller_id on public.products for each row execute function public.cm_validate_listing_media();
create function public.cm_validate_logo_media() returns trigger language plpgsql security definer set search_path='' as $$begin
  if new.logo_url is not null and (tg_op='INSERT' or new.logo_url is distinct from old.logo_url) and not public.cm_owned_image(new.logo_url,new.id) then raise exception 'Use a logo uploaded to your own store. Storage origin setup may be required.';end if;return new;
end $$;
create trigger cm_validate_logo_media before insert or update of logo_url on public.sellers for each row execute function public.cm_validate_logo_media();
-- Existing foreign references also cannot pin another store's files indefinitely.
create or replace function public.cm_image_referenced(p_name text) returns boolean language sql stable security definer set search_path='' as $$
  with names as(select p_name name union select regexp_replace(p_name,'-thumb[.]webp$','-full.webp') union select regexp_replace(p_name,'-full[.]webp$','-thumb.webp'))
  select exists(select 1 from names n,public.products p,unnest(coalesce(p.images,'{}')) u(url) where split_part(n.name,'/',1)=p.seller_id::text and right(u.url,length('/storage/v1/object/public/product-images/'||n.name))='/storage/v1/object/public/product-images/'||n.name)
    or exists(select 1 from names n,public.sellers s where split_part(n.name,'/',1)=s.id::text and right(s.logo_url,length('/storage/v1/object/public/product-images/'||n.name))='/storage/v1/object/public/product-images/'||n.name);
$$;
revoke all on function public.cm_limit_profile_write(),public.cm_limit_listing_write(),public.cm_owned_image(text,uuid),public.cm_validate_listing_media(),public.cm_validate_logo_media() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
