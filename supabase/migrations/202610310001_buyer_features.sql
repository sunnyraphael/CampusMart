-- Additive buyer features. Apply to the existing CampusMart database, not an empty database.
-- Requires the existing users/sellers/products/orders/wishlist/notifications tables and is_admin().
begin;

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  query text not null default '' check (char_length(query) <= 80),
  category text not null default '' check (char_length(category) <= 100),
  sort text not null default 'newest' check (sort in ('newest','price_asc','price_desc','top')),
  created_at timestamptz not null default now(),
  unique(user_id, query, category, sort)
);
alter table public.saved_searches enable row level security;
create policy saved_search_owner on public.saved_searches for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.saved_searches from anon, authenticated;
grant select, delete on public.saved_searches to authenticated;
grant insert(user_id,name,query,category,sort) on public.saved_searches to authenticated;

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (char_length(btrim(subject)) between 5 and 120),
  body text not null check (char_length(btrim(body)) between 20 and 4000),
  status text not null default 'open' check (status in ('open','in_review','resolved')),
  admin_reply text,
  created_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
create policy support_read on public.support_requests for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy support_admin_update on public.support_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
grant update(status,admin_reply) on public.support_requests to authenticated;
create index support_user_time on public.support_requests(user_id, created_at desc);

-- Ownership guards also constrain any permissive policy already present on these existing tables.
alter table public.wishlist enable row level security;
create policy cm_wishlist_guard on public.wishlist as restrictive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cm_wishlist_owner on public.wishlist for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, delete on public.wishlist to authenticated;
grant insert(user_id,product_id) on public.wishlist to authenticated;

alter table public.notifications enable row level security;
create policy cm_notification_guard on public.notifications as restrictive for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cm_notification_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;

create table public.buyer_conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.sellers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  buyer_read_at timestamptz not null default 'epoch',
  vendor_read_at timestamptz not null default 'epoch',
  updated_at timestamptz not null default now(),
  unique(buyer_id,vendor_id)
);
create table public.buyer_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.buyer_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index buyer_messages_conversation_time on public.buyer_messages(conversation_id, created_at desc, id desc);
create index buyer_messages_sender_time on public.buyer_messages(sender_id, created_at desc);
create index buyer_conversations_vendor on public.buyer_conversations(vendor_id);
alter table public.buyer_conversations enable row level security;
alter table public.buyer_messages enable row level security;
revoke all on public.buyer_conversations, public.buyer_messages from anon, authenticated;

-- Definer functions deliberately expose narrow operations. Each authenticates the caller,
-- scopes every row to them and fixes search_path. No direct writes to chat tables are granted.
create function public.cm_chat_member(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.buyer_conversations c join public.sellers s on s.id=c.vendor_id
    where c.id=p_id and (c.buyer_id=auth.uid() or s.user_id=auth.uid()));
$$;
create policy chat_conversation_read on public.buyer_conversations for select to authenticated using (public.cm_chat_member(id));
create policy chat_message_read on public.buyer_messages for select to authenticated using (public.cm_chat_member(conversation_id));
grant select on public.buyer_conversations, public.buyer_messages to authenticated;

create function public.cm_start_conversation(p_vendor_id uuid, p_product_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  select user_id into v_owner from public.sellers where id=p_vendor_id;
  if v_owner is null then raise exception 'This vendor is unavailable.'; end if;
  if v_owner=auth.uid() then raise exception 'You cannot message your own store.'; end if;
  if p_product_id is not null and not exists(select 1 from public.products where id=p_product_id and seller_id=p_vendor_id and status='active') then raise exception 'This listing is unavailable.'; end if;
  insert into public.buyer_conversations(buyer_id,vendor_id,product_id) values(auth.uid(),p_vendor_id,p_product_id)
    on conflict(buyer_id,vendor_id) do update set product_id=coalesce(excluded.product_id,public.buyer_conversations.product_id)
    returning id into v_id;
  return v_id;
end; $$;

create function public.cm_send_message(p_conversation_id uuid, p_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.cm_chat_member(p_conversation_id) then raise exception 'Conversation not available.'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Write a message of up to 2,000 characters.'; end if;
  -- Serializes concurrent sends from one account before applying the rate limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  if (select count(*) from public.buyer_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute') >= 20 then raise exception 'Please wait a moment before sending more messages.'; end if;
  insert into public.buyer_messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),btrim(p_body)) returning id into v_id;
  update public.buyer_conversations set updated_at=now() where id=p_conversation_id;
  return v_id;
end; $$;

create function public.cm_read_conversation(p_conversation_id uuid, p_read_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.cm_chat_member(p_conversation_id) then raise exception 'Conversation not available.'; end if;
  update public.buyer_conversations set
    buyer_read_at=case when buyer_id=auth.uid() then greatest(buyer_read_at,least(p_read_at,now())) else buyer_read_at end,
    vendor_read_at=case when buyer_id<>auth.uid() then greatest(vendor_read_at,least(p_read_at,now())) else vendor_read_at end
    where id=p_conversation_id;
end; $$;

create function public.cm_conversations() returns table(id uuid, other_name text, product_id uuid, updated_at timestamptz, last_message text, unread_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, case when c.buyer_id=auth.uid() then s.store_name else coalesce(nullif(u.full_name,''),'CampusMart buyer') end,
    c.product_id, c.updated_at,
    (select m.body from public.buyer_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),
    (select count(*) from public.buyer_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
      and m.created_at>case when c.buyer_id=auth.uid() then c.buyer_read_at else c.vendor_read_at end)
  from public.buyer_conversations c join public.sellers s on s.id=c.vendor_id left join public.users u on u.id=c.buyer_id
  where auth.uid() is not null and (c.buyer_id=auth.uid() or s.user_id=auth.uid()) order by c.updated_at desc,c.id desc;
$$;

create function public.cm_read_notifications(p_id uuid default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  update public.notifications set is_read=true where user_id=auth.uid() and (p_id is null or id=p_id);
end; $$;

create function public.cm_update_profile(p_full_name text, p_phone text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100 then raise exception 'Enter your full name.'; end if;
  if p_phone is not null and p_phone<>'' and p_phone !~ '^(\+234|0)[0-9]{10}$' then raise exception 'Enter a valid Nigerian phone number.'; end if;
  update public.users set full_name=btrim(p_full_name),phone=nullif(btrim(p_phone),'') where id=auth.uid();
  if not found then raise exception 'Your profile could not be found. Contact support.'; end if;
end; $$;

create function public.cm_support_request(p_subject text,p_body text,p_order_id uuid default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if p_order_id is not null and not exists(select 1 from public.orders where id=p_order_id and user_id=auth.uid()) then raise exception 'Choose one of your own orders.'; end if;
  if p_subject is null or char_length(btrim(p_subject)) not between 5 and 120 or p_body is null or char_length(btrim(p_body)) not between 20 and 4000 then raise exception 'Check the subject and message length.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,1));
  if (select count(*) from public.support_requests where user_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'You have sent several requests. Please wait before sending another.'; end if;
  insert into public.support_requests(user_id,subject,body,order_id) values(auth.uid(),btrim(p_subject),btrim(p_body),p_order_id) returning id into v_id;
  return v_id;
end; $$;

create function public.cm_set_favorite(p_product_id uuid, p_saved boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || p_product_id::text,2));
  if p_saved then
    if not exists(select 1 from public.products where id=p_product_id and status='active') then raise exception 'This listing is unavailable.'; end if;
    if not exists(select 1 from public.wishlist where user_id=auth.uid() and product_id=p_product_id) then
      insert into public.wishlist(user_id,product_id) values(auth.uid(),p_product_id);
    end if;
  else
    delete from public.wishlist where user_id=auth.uid() and product_id=p_product_id;
  end if;
end; $$;
revoke all on function public.cm_set_favorite(uuid,boolean) from public, anon, authenticated;
grant execute on function public.cm_set_favorite(uuid,boolean) to authenticated;

-- Reviews are accepted only after a paid purchase has been received.
create function public.cm_review_product(p_product_id uuid,p_rating integer,p_comment text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(p_comment,''))>2000 then raise exception 'Choose a rating from 1 to 5 and keep the review under 2,000 characters.'; end if;
  if not exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.product_id=p_product_id and o.user_id=auth.uid() and o.payment_status='paid' and i.fulfillment_status='received') then raise exception 'Only buyers who received a paid order can review this item.'; end if;
  -- Lock the product, not just the account, so concurrent reviews cannot lose aggregate updates.
  perform 1 from public.products where id=p_product_id for update;
  if exists(select 1 from public.reviews where user_id=auth.uid() and product_id=p_product_id) then
    update public.reviews set rating=p_rating,comment=nullif(btrim(p_comment),'') where user_id=auth.uid() and product_id=p_product_id;
  else
    insert into public.reviews(user_id,product_id,rating,comment) values(auth.uid(),p_product_id,p_rating,nullif(btrim(p_comment),''));
  end if;
  update public.products set avg_rating=(select avg(rating) from public.reviews where product_id=p_product_id),total_reviews=(select count(*) from public.reviews where product_id=p_product_id) where id=p_product_id;
end; $$;
revoke all on function public.cm_review_product(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.cm_review_product(uuid,integer,text) to authenticated;
-- The RPC is the only buyer review write path; existing public review reads remain intact.
revoke insert,update,delete on public.reviews from anon,authenticated;
do $$
declare columns text;
begin
  select string_agg(quote_ident(attname),',') into columns from pg_catalog.pg_attribute where attrelid='public.reviews'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s), update (%s) on public.reviews from anon, authenticated',columns,columns);
end; $$;
revoke all on public.wishlist,public.notifications from anon;

revoke all on function public.cm_chat_member(uuid),public.cm_start_conversation(uuid,uuid),public.cm_send_message(uuid,text),public.cm_read_conversation(uuid,timestamptz),public.cm_conversations(),public.cm_read_notifications(uuid),public.cm_update_profile(text,text),public.cm_support_request(text,text,uuid) from public, anon, authenticated;
grant execute on function public.cm_chat_member(uuid),public.cm_start_conversation(uuid,uuid),public.cm_send_message(uuid,text),public.cm_read_conversation(uuid,timestamptz),public.cm_conversations(),public.cm_read_notifications(uuid),public.cm_update_profile(text,text),public.cm_support_request(text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
