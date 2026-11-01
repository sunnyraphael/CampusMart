-- Apply after 202611010001_account_controls.sql. No existing consent is inferred.
-- Guardian requests are initiated by an authenticated adult before a student registers.
begin;

create table public.guardian_permissions (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id),
  student_email_hash text not null check(length(student_email_hash)=64),
  relationship text not null check(relationship in ('parent','legal_guardian')),
  allows_selling boolean not null default false,
  state text not null default 'pending' check(state in ('pending','approved','rejected','withdrawn')),
  policy_version text not null default '2026-11-01',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id), review_note text
);
create unique index guardian_permission_live on public.guardian_permissions(guardian_id,student_email_hash) where state in ('pending','approved');
create index guardian_permission_review on public.guardian_permissions(state,created_at);

create table public.marketplace_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age_band text not null check(age_band in ('adult','under_18')),
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  guardian_request_id uuid references public.guardian_permissions(id),
  check((age_band='adult' and guardian_request_id is null) or (age_band='under_18' and guardian_request_id is not null))
);
create table public.marketplace_consent_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  purpose text not null check(purpose in ('buyer_terms','vendor_terms')),
  version text not null, accepted_at timestamptz not null default now()
);
create table public.vendor_terms_acceptances (
  user_id uuid primary key references auth.users(id), version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.orders add column terms_version text,add column terms_accepted_at timestamptz;

alter table public.guardian_permissions enable row level security;
alter table public.marketplace_consents enable row level security;
alter table public.marketplace_consent_events enable row level security;
alter table public.vendor_terms_acceptances enable row level security;
revoke all on public.guardian_permissions,public.marketplace_consents,public.marketplace_consent_events,public.vendor_terms_acceptances from anon,authenticated;
grant select on public.guardian_permissions,public.marketplace_consents,public.marketplace_consent_events,public.vendor_terms_acceptances to authenticated;
create policy own_guardian_permissions on public.guardian_permissions for select to authenticated using(guardian_id=auth.uid());
create policy own_marketplace_consent on public.marketplace_consents for select to authenticated using(user_id=auth.uid());
create policy own_marketplace_consent_events on public.marketplace_consent_events for select to authenticated using(user_id=auth.uid());
create policy own_vendor_terms on public.vendor_terms_acceptances for select to authenticated using(user_id=auth.uid());

create function public.cm_permission_matches(p_request uuid,p_email text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.guardian_permissions g where g.id=p_request and g.state='approved'
    and g.student_email_hash=encode(sha256(convert_to(lower(btrim(p_email)),'UTF8')),'hex')
    and public.cm_account_is_active(g.guardian_id));
$$;
revoke all on function public.cm_permission_matches(uuid,text) from public,anon,authenticated;

create function public.cm_consent_allows_trade(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select public.cm_account_is_active(p_user) and exists(
    select 1 from public.marketplace_consents c join auth.users u on u.id=c.user_id
    where c.user_id=p_user and c.terms_version='2026-11-01' and u.email_confirmed_at is not null
    and (c.age_band='adult' or public.cm_permission_matches(c.guardian_request_id,u.email)));
$$;
revoke all on function public.cm_consent_allows_trade(uuid) from public,anon,authenticated;

create function public.cm_consent_allows_selling(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
  select public.cm_consent_allows_trade(p_user) and exists(select 1 from public.marketplace_consents c
    where c.user_id=p_user and (c.age_band='adult' or exists(select 1 from public.guardian_permissions g
      join public.vendor_terms_acceptances v on v.user_id=g.guardian_id and v.version='2026-11-01'
      where g.id=c.guardian_request_id and g.state='approved' and g.allows_selling)));
$$;
revoke all on function public.cm_consent_allows_selling(uuid) from public,anon,authenticated;

create function public.cm_consent_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.marketplace_consents%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to review your account permissions.'; end if;
  select * into c from public.marketplace_consents where user_id=auth.uid();
  return jsonb_build_object('accepted',coalesce(c.terms_version='2026-11-01',false),'eligible',public.cm_consent_allows_trade(auth.uid()),
    'selling_eligible',public.cm_consent_allows_selling(auth.uid()),'age_band',c.age_band,'accepted_at',c.accepted_at,'guardian_request_id',c.guardian_request_id,
    'vendor_terms',exists(select 1 from public.vendor_terms_acceptances v where v.user_id=auth.uid() and v.version='2026-11-01'));
end;
$$;

create function public.cm_accept_marketplace_terms(p_age_band text,p_accepted boolean,p_guardian_request_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare old_age text; user_email text;
begin
  if auth.uid() is null or not public.cm_account_is_active(auth.uid()) then raise exception 'An active signed-in account is required.'; end if;
  if p_accepted is distinct from true or p_age_band not in ('adult','under_18') or p_age_band is null then raise exception 'Choose an age band and accept the terms to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7101));
  select age_band into old_age from public.marketplace_consents where user_id=auth.uid();
  if old_age is not null and old_age<>p_age_band then raise exception 'Contact support to correct your recorded age band.'; end if;
  select email into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if user_email is null then raise exception 'Confirm your sign-in email before continuing.'; end if;
  if p_age_band='under_18' and not public.cm_permission_matches(p_guardian_request_id,user_email) then raise exception 'A reviewed guardian permission matching your sign-in email is required.'; end if;
  insert into public.marketplace_consents(user_id,age_band,terms_version,guardian_request_id)
    values(auth.uid(),p_age_band,'2026-11-01',case when p_age_band='under_18' then p_guardian_request_id end)
    on conflict(user_id) do update set terms_version=excluded.terms_version,accepted_at=now(),guardian_request_id=excluded.guardian_request_id;
  insert into public.marketplace_consent_events(user_id,purpose,version) values(auth.uid(),'buyer_terms','2026-11-01');
end;
$$;

create function public.cm_accept_vendor_terms(p_accepted boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_accepted is distinct from true or not public.cm_consent_allows_trade(auth.uid()) then raise exception 'Complete your account permissions and accept the vendor terms first.'; end if;
  if not public.cm_consent_allows_selling(auth.uid()) then raise exception 'Ask your guardian to authorize selling and have that permission reviewed before opening a store.'; end if;
  insert into public.vendor_terms_acceptances(user_id,version) values(auth.uid(),'2026-11-01')
    on conflict(user_id) do update set version=excluded.version,accepted_at=now();
  insert into public.marketplace_consent_events(user_id,purpose,version) values(auth.uid(),'vendor_terms','2026-11-01');
end;
$$;

create function public.cm_request_guardian_permission(p_student_email text,p_relationship text,p_accepted boolean,p_allow_selling boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; guardian_email text; student_hash text;
begin
  if not public.cm_consent_allows_trade(auth.uid()) or not exists(select 1 from public.marketplace_consents where user_id=auth.uid() and age_band='adult') then raise exception 'A confirmed adult account is required to request guardian permission.'; end if;
  if p_accepted is distinct from true or p_relationship not in ('parent','legal_guardian') or p_relationship is null then raise exception 'Parent or legal guardian permission is required.'; end if;
  if p_allow_selling and not exists(select 1 from public.vendor_terms_acceptances where user_id=auth.uid() and version='2026-11-01') then raise exception 'Accept the vendor terms before authorizing a student store.'; end if;
  if p_student_email is null or length(p_student_email)>254 or p_student_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter the student sign-in email.'; end if;
  select email into guardian_email from auth.users where id=auth.uid();
  if lower(btrim(p_student_email))=lower(btrim(guardian_email)) then raise exception 'The student must use a separate sign-in email.'; end if;
  student_hash:=encode(sha256(convert_to(lower(btrim(p_student_email)),'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7102));
  select id into v_id from public.guardian_permissions where guardian_id=auth.uid() and student_email_hash=student_hash and state in ('pending','approved');
  if v_id is not null then
    if p_allow_selling and not exists(select 1 from public.guardian_permissions where id=v_id and allows_selling) then raise exception 'Withdraw the existing permission before requesting selling access. Additional permission needs a new review.'; end if;
    return v_id;
  end if;
  if (select count(*) from public.guardian_permissions where guardian_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Please wait before submitting another guardian request.'; end if;
  insert into public.guardian_permissions(guardian_id,student_email_hash,relationship,allows_selling) values(auth.uid(),student_hash,p_relationship,coalesce(p_allow_selling,false)) returning id into v_id;
  return v_id;
end;
$$;

create function public.cm_withdraw_guardian_permission(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.guardian_permissions set state='withdrawn' where id=p_id and guardian_id=auth.uid() and state in ('pending','approved');
  if not found then raise exception 'Permission is not available for withdrawal.'; end if;
  update public.products p set status='draft' from public.sellers s,public.marketplace_consents c
    where p.seller_id=s.id and s.user_id=c.user_id and c.guardian_request_id=p_id and p.status='active';
end;
$$;

create function public.cm_admin_guardian_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access is required.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q)) from(select g.id,g.relationship,g.allows_selling,g.state,g.created_at,g.reviewed_at,g.review_note,
    u.email guardian_email,u.full_name guardian_name from public.guardian_permissions g left join public.users u on u.id=g.guardian_id
    where g.state='pending' order by g.created_at limit 100)q),'[]'::jsonb);
end;
$$;
create function public.cm_admin_review_guardian(p_id uuid,p_approved boolean,p_verified boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare guardian uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access is required.'; end if;
  if p_approved is null or p_note is null or length(btrim(p_note)) not between 10 and 1000 then raise exception 'Record your verification and decision in 10 to 1,000 characters.'; end if;
  if p_approved and p_verified is distinct from true then raise exception 'Check guardian identity, authority and permission before approving.'; end if;
  select guardian_id into guardian from public.guardian_permissions where id=p_id and state='pending' for update;
  if not found then raise exception 'This request has already been reviewed or withdrawn.'; end if;
  if p_approved and guardian=auth.uid() then raise exception 'Another administrator must review your own guardian request.'; end if;
  if p_approved and not public.cm_consent_allows_trade(guardian) then raise exception 'The guardian needs an active, confirmed account before approval.'; end if;
  update public.guardian_permissions set state=case when p_approved then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=auth.uid(),review_note=btrim(p_note) where id=p_id and state='pending';
  if not found then raise exception 'This request has already been reviewed or withdrawn.'; end if;
end;
$$;

-- Persist declarations independently of user-editable auth metadata. New accounts
-- must use the email registration age/terms flow; existing OAuth sign-ins are unaffected.
create function public.cm_signup_consent() returns trigger language plpgsql security definer set search_path='' as $$
declare band text; permission uuid;
begin
  band:=new.raw_user_meta_data->>'age_band';
  if band is null or band not in ('adult','under_18') or new.raw_user_meta_data->>'terms_accepted' is distinct from 'true' then
    raise exception 'Create your account with the CampusMart email registration form and review the age and terms options first.';
  end if;
  if band='under_18' then
    begin permission:=(new.raw_user_meta_data->>'guardian_request_id')::uuid; exception when invalid_text_representation then raise exception 'Use a valid guardian permission reference.'; end;
    if not public.cm_permission_matches(permission,new.email) then raise exception 'Guardian permission must be approved before student registration.'; end if;
  end if;
  if band in ('adult','under_18') and new.raw_user_meta_data->>'terms_accepted'='true' then
    insert into public.marketplace_consents(user_id,age_band,terms_version,guardian_request_id) values(new.id,band,'2026-11-01',case when band='under_18' then permission end);
    insert into public.marketplace_consent_events(user_id,purpose,version) values(new.id,'buyer_terms','2026-11-01');
  end if;
  return new;
end;
$$;
create trigger cm_record_signup_consent after insert on auth.users for each row execute function public.cm_signup_consent();

create function public.cm_guard_trade_consent() returns trigger language plpgsql security definer set search_path='' as $$
declare who uuid;
begin
  if tg_table_name='orders' then who:=new.user_id;
  elsif tg_table_name='buyer_conversations' then who:=new.buyer_id;
  elsif tg_table_name='buyer_messages' then who:=new.sender_id;
  elsif tg_table_name='sellers' then who:=new.user_id;
  elsif tg_table_name='order_items' then select user_id into who from public.sellers where id=new.seller_id;
  else
    if new.status<>'active' then return new; end if;
    select user_id into who from public.sellers where id=new.seller_id;
  end if;
  if not public.cm_consent_allows_trade(who) then raise exception 'Review your account permissions before placing orders, publishing listings or using messages.'; end if;
  if tg_table_name='orders' then new.terms_version:='2026-11-01';new.terms_accepted_at:=now(); end if;
  if tg_table_name in ('sellers','products','order_items') and not exists(select 1 from public.vendor_terms_acceptances where user_id=who and version='2026-11-01') then raise exception 'The vendor needs current terms before accepting new orders.'; end if;
  if tg_table_name in ('sellers','products','order_items') and not public.cm_consent_allows_selling(who) then raise exception 'The vendor needs reviewed permission before accepting new orders.'; end if;
  return new;
end;
$$;
create trigger cm_consent_new_order before insert on public.orders for each row execute function public.cm_guard_trade_consent();
create trigger cm_consent_new_conversation before insert on public.buyer_conversations for each row execute function public.cm_guard_trade_consent();
create trigger cm_consent_new_message before insert on public.buyer_messages for each row execute function public.cm_guard_trade_consent();
create trigger cm_consent_new_store before insert on public.sellers for each row execute function public.cm_guard_trade_consent();
create trigger cm_consent_seller_new_item before insert on public.order_items for each row execute function public.cm_guard_trade_consent();
create trigger cm_consent_publish before insert or update of status on public.products for each row execute function public.cm_guard_trade_consent();

create function public.cm_unpublish_guardian_dependents() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.closed_at is not null then
    update public.products p set status='draft' from public.sellers s,public.marketplace_consents c,public.guardian_permissions g
      where p.seller_id=s.id and s.user_id=c.user_id and c.guardian_request_id=g.id and g.guardian_id=new.user_id and p.status='active';
  end if;
  return new;
end;
$$;
create trigger cm_guardian_account_closed after insert or update of closed_at on public.account_access for each row execute function public.cm_unpublish_guardian_dependents();

revoke all on function public.cm_signup_consent(),public.cm_guard_trade_consent(),public.cm_unpublish_guardian_dependents() from public,anon,authenticated;
revoke all on function public.cm_consent_status(),public.cm_accept_marketplace_terms(text,boolean,uuid),public.cm_accept_vendor_terms(boolean),public.cm_request_guardian_permission(text,text,boolean,boolean),public.cm_withdraw_guardian_permission(uuid),public.cm_admin_guardian_queue(),public.cm_admin_review_guardian(uuid,boolean,boolean,text) from public,anon;
grant execute on function public.cm_consent_status(),public.cm_accept_marketplace_terms(text,boolean,uuid),public.cm_accept_vendor_terms(boolean),public.cm_request_guardian_permission(text,text,boolean,boolean),public.cm_withdraw_guardian_permission(uuid),public.cm_admin_guardian_queue(),public.cm_admin_review_guardian(uuid,boolean,boolean,text) to authenticated;
commit;
