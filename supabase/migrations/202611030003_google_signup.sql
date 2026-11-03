-- Google creates the identity only after the same age/guardian intake as email.
-- Terms must still be confirmed by the signed-in Google account before trading.
begin;
create table public.google_signup_intents(id uuid primary key default gen_random_uuid(),email_hash text not null,age_band text not null check(age_band in ('adult','under_18')),guardian_request_id uuid,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',consumed_at timestamptz);
create index google_signup_email on public.google_signup_intents(email_hash,created_at);
alter table public.google_signup_intents enable row level security;
revoke all on public.google_signup_intents from public,anon,authenticated;
grant all on public.google_signup_intents to service_role;
create function public.cm_prepare_google_signup(p_email text,p_age_band text,p_accepted boolean,p_guardian_request_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare hashed text;intent uuid;begin
 if p_email is null or length(p_email)>254 or btrim(p_email)!~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_age_band is null or p_age_band not in ('adult','under_18') or p_accepted is not true then raise exception 'Enter the email you will use with Google, choose your age band and accept the terms.';end if;
 if p_age_band='under_18' and not public.cm_permission_matches(p_guardian_request_id,p_email) then raise exception 'A reviewed guardian permission matching your Google email is required before registration.';end if;
 hashed:=encode(sha256(convert_to(lower(btrim(p_email)),'UTF8')),'hex');
 perform pg_advisory_xact_lock(871253);
 select id into intent from public.google_signup_intents where email_hash=hashed and age_band=p_age_band and guardian_request_id is not distinct from (case when p_age_band='under_18' then p_guardian_request_id end) and consumed_at is null and expires_at>now() order by created_at desc limit 1;
 if found then return intent;end if;
 if (select count(*) from public.google_signup_intents where created_at>now()-interval '1 hour')>=200 or (select count(*) from public.google_signup_intents where email_hash=hashed and created_at>now()-interval '1 hour')>=3 then raise exception 'Too many Google signup attempts. Please wait before retrying.';end if;
 insert into public.google_signup_intents(email_hash,age_band,guardian_request_id) values(hashed,p_age_band,case when p_age_band='under_18' then p_guardian_request_id end) returning id into intent;
 delete from public.google_signup_intents where created_at<now()-interval '1 day';
 return intent;
end $$;
create or replace function public.cm_signup_consent() returns trigger language plpgsql security definer set search_path='' as $$
declare band text;permission uuid;intent public.google_signup_intents;begin
 if new.raw_app_meta_data->>'provider'='google' then
   select * into intent from public.google_signup_intents where email_hash=encode(sha256(convert_to(lower(btrim(new.email)),'UTF8')),'hex') and expires_at>now() and consumed_at is null order by created_at desc limit 1 for update;
   if not found then raise exception 'Start Google signup on CampusMart Register and use the same email address.';end if;
   if intent.age_band='under_18' and not public.cm_permission_matches(intent.guardian_request_id,new.email) then raise exception 'Guardian permission is no longer approved for this Google email.';end if;
   update public.google_signup_intents set consumed_at=now() where id=intent.id;
   insert into public.marketplace_consents(user_id,age_band,terms_version,guardian_request_id) values(new.id,intent.age_band,'pending-google',intent.guardian_request_id);
   return new;
 end if;
 band:=new.raw_user_meta_data->>'age_band';
 if band is null or band not in ('adult','under_18') or new.raw_user_meta_data->>'terms_accepted' is distinct from 'true' then raise exception 'Create your account with the CampusMart registration form and review the age and terms options first.';end if;
 if band='under_18' then
   begin permission:=(new.raw_user_meta_data->>'guardian_request_id')::uuid;exception when invalid_text_representation then raise exception 'Use a valid guardian permission reference.';end;
   if not public.cm_permission_matches(permission,new.email) then raise exception 'Guardian permission must be approved before student registration.';end if;
 end if;
 insert into public.marketplace_consents(user_id,age_band,terms_version,guardian_request_id) values(new.id,band,'2026-11-01',case when band='under_18' then permission end);
 insert into public.marketplace_consent_events(user_id,purpose,version) values(new.id,'buyer_terms','2026-11-01');
 return new;
end $$;
revoke all on function public.cm_prepare_google_signup(text,text,boolean,uuid) from public;
grant execute on function public.cm_prepare_google_signup(text,text,boolean,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
