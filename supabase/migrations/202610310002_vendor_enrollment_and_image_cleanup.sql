-- Apply AFTER 202610310001_buyer_features.sql. No changes to payments or admin roles.
begin;

create function public.cm_enroll_vendor() returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_role text;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  select role into v_profile_role from public.users where id=auth.uid() for update;
  if not found then raise exception 'Your profile is unavailable. Contact support.'; end if;
  if v_profile_role='vendor' then return; end if;
  if v_profile_role not in ('buyer','student') or v_profile_role is null then raise exception 'This account cannot enroll as a vendor.'; end if;
  update public.users set role='vendor' where id=auth.uid();
end; $$;

-- A durable queue keeps Storage API failures retryable after the product row is gone.
-- Deleted entries remain as tombstones: stale URLs cannot be attached to new listings.
create table public.listing_image_cleanup (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.sellers(id) on delete cascade,
  image_url text not null unique,
  status text not null default 'pending' check(status in ('pending','deleting','deleted','ignored')),
  lease_token uuid,
  leased_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.listing_image_cleanup enable row level security;
revoke all on public.listing_image_cleanup from public,anon,authenticated;
create index listing_image_cleanup_vendor_status on public.listing_image_cleanup(vendor_id,status,created_at);

-- These advisory locks also serialize duplicate/edit requests with cleanup claims.
create function public.cm_lock_listing_images() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_images text[] := '{}'; new_images text[] := '{}'; image text;
begin
  if tg_op<>'INSERT' then old_images:=coalesce(old.images,'{}'); end if;
  if tg_op<>'DELETE' then new_images:=coalesce(new.images,'{}'); end if;
  for image in select distinct u.url from unnest(old_images||new_images) as u(url) where u.url is not null order by u.url loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(image,3));
  end loop;
  if exists(select 1 from public.listing_image_cleanup q where q.image_url=any(new_images) and q.status in ('pending','deleting','deleted')) then
    raise exception 'A photo is being removed or is no longer available. Please upload it again.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger cm_lock_listing_images before insert or update of images,seller_id or delete on public.products for each row execute function public.cm_lock_listing_images();

create function public.cm_queue_unused_listing_images() returns trigger language plpgsql security definer set search_path = '' as $$
declare image text; remaining_images text[] := '{}';
begin
  if tg_op='UPDATE' then remaining_images:=coalesce(new.images,'{}'); end if;
  for image in select distinct u.url from unnest(coalesce(old.images,'{}')) as u(url) where u.url is not null loop
    if not(image=any(remaining_images))
      and strpos(image,'/storage/v1/object/public/product-images/'||old.seller_id::text||'/')>0
      and not exists(select 1 from public.products p where p.images @> array[image]) then
      insert into public.listing_image_cleanup(vendor_id,image_url) values(old.seller_id,image)
        on conflict(image_url) do update set status='pending',lease_token=null,leased_at=null
        where public.listing_image_cleanup.status='ignored';
    end if;
  end loop;
  return null;
end; $$;
create trigger cm_queue_unused_listing_images after update of images or delete on public.products for each row execute function public.cm_queue_unused_listing_images();

create function public.cm_delete_listing(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  delete from public.products p using public.sellers s where p.id=p_id and p.seller_id=s.id and s.user_id=auth.uid();
  if not found then raise exception 'Listing not available or you do not own it.'; end if;
end; $$;

create function public.cm_claim_listing_image_cleanup() returns table(id uuid,image_url text,vendor_id uuid,lease_token uuid)
language plpgsql security definer set search_path = '' as $$
declare candidate record; token uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  for candidate in
    select q.id,q.image_url from public.listing_image_cleanup q join public.sellers s on s.id=q.vendor_id
    where s.user_id=auth.uid() and (q.status='pending' or (q.status='deleting' and q.leased_at<now()-interval '5 minutes'))
      and not exists(select 1 from public.products p where p.images @> array[q.image_url])
    order by q.created_at,q.id limit 20
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate.image_url,3));
    token:=gen_random_uuid();
    return query update public.listing_image_cleanup q set status='deleting',lease_token=token,leased_at=now()
      where q.id=candidate.id and (q.status='pending' or (q.status='deleting' and q.leased_at<now()-interval '5 minutes'))
        and not exists(select 1 from public.products p where p.images @> array[q.image_url])
      returning q.id,q.image_url,q.vendor_id,q.lease_token;
  end loop;
end; $$;

create function public.cm_finish_listing_image_cleanup(p_id uuid,p_token uuid,p_result text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if p_result not in ('deleted','pending','ignored') or p_result is null then raise exception 'Invalid cleanup result.'; end if;
  update public.listing_image_cleanup q set status=p_result,lease_token=null,leased_at=null
    from public.sellers s where q.id=p_id and q.vendor_id=s.id and s.user_id=auth.uid() and q.lease_token=p_token and q.status='deleting';
  if not found then raise exception 'Cleanup claim not available.'; end if;
end; $$;

-- Storage APIs need SELECT as well as DELETE. Grant access only to the owner's
-- claimed queue entries that still have no listing references anywhere.
create function public.cm_can_remove_listing_image(p_bucket text,p_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select p_bucket='product-images' and exists(
    select 1 from public.listing_image_cleanup q join public.sellers s on s.id=q.vendor_id
    where s.user_id=auth.uid() and q.status='deleting'
      and p_name like s.id::text||'/%'
      and right(q.image_url,char_length('/storage/v1/object/public/product-images/'||p_name))='/storage/v1/object/public/product-images/'||p_name
      and not exists(select 1 from public.products p where p.images @> array[q.image_url])
  );
$$;
create policy cm_listing_cleanup_read on storage.objects for select to authenticated using(public.cm_can_remove_listing_image(bucket_id,name));
create policy cm_listing_cleanup_delete on storage.objects for delete to authenticated using(public.cm_can_remove_listing_image(bucket_id,name));

revoke all on function public.cm_can_remove_listing_image(text,text) from public,anon,authenticated;
grant execute on function public.cm_can_remove_listing_image(text,text) to authenticated;
revoke all on function public.cm_enroll_vendor(),public.cm_lock_listing_images(),public.cm_queue_unused_listing_images(),public.cm_delete_listing(uuid),public.cm_claim_listing_image_cleanup(),public.cm_finish_listing_image_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cm_enroll_vendor(),public.cm_delete_listing(uuid),public.cm_claim_listing_image_cleanup(),public.cm_finish_listing_image_cleanup(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
