-- Apply after the buyer feature migration. Aggregate ratings are derived data,
-- even where existing vendor grants permit updating the product row directly.
-- This migration does not label, create, remove or rewrite any review record.
begin;

-- Even a self-purchase must not let a vendor rate their own listing.
create function public.cm_guard_review_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.products p join public.sellers s on s.id=p.seller_id
    where p.id=new.product_id and s.user_id=new.user_id) then
    raise exception 'Vendors cannot review their own listings.';
  end if;
  return new;
end;
$$;
revoke all on function public.cm_guard_review_author() from public,anon,authenticated;
create trigger cm_guard_review_author before insert or update on public.reviews
for each row execute function public.cm_guard_review_author();

create function public.cm_derive_product_review_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select avg(r.rating),count(*)::integer
    into new.avg_rating,new.total_reviews
    from public.reviews r where r.product_id=new.id;
  return new;
end;
$$;

revoke all on function public.cm_derive_product_review_totals() from public,anon,authenticated;

create trigger cm_derive_product_review_totals
before insert or update of avg_rating,total_reviews on public.products
for each row execute function public.cm_derive_product_review_totals();

-- Keep summaries accurate after legitimate review edits or administrative removal,
-- including a data-removal request fulfilled outside the buyer review RPC.
create function public.cm_refresh_review_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.products set avg_rating=null,total_reviews=0 where id=old.product_id;
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and new.product_id is distinct from old.product_id) then
    update public.products set avg_rating=null,total_reviews=0 where id=new.product_id;
  end if;
  return null;
end;
$$;
revoke all on function public.cm_refresh_review_totals() from public,anon,authenticated;
create trigger cm_refresh_review_totals after insert or update or delete on public.reviews
for each row execute function public.cm_refresh_review_totals();

-- Preserve all source reviews and repair only product summary columns.
-- The trigger also derives totals for the existing paid-purchase review RPC,
-- whose aggregate update happens after it inserts or edits the actual review.
update public.products p
set avg_rating=summary.avg_rating,total_reviews=summary.total_reviews
from (
  select product.id,avg(review.rating) as avg_rating,count(review.id)::integer as total_reviews
  from public.products product
  left join public.reviews review on review.product_id=product.id
  group by product.id
) summary
where p.id=summary.id
  and (p.avg_rating is distinct from summary.avg_rating or p.total_reviews is distinct from summary.total_reviews);

commit;
