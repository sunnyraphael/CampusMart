-- Apply after 202611030001_security_hardening.sql. Replaces the app's MFA gate
-- with a password-unlocked admin session and per-decision transaction PIN.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.admin_unlocks(user_id uuid not null references public.users(id),session_id uuid not null,expires_at timestamptz not null,primary key(user_id,session_id));
create table public.admin_pin_credentials(user_id uuid primary key references public.users(id),pin_hash text not null,failed_attempts int not null default 0,locked_until timestamptz,changed_at timestamptz not null default now());
create table public.admin_pin_permissions(user_id uuid not null,session_id uuid not null,operation text not null,target uuid not null,transaction_id text not null,primary key(user_id,session_id,operation,target,transaction_id));
create table public.admin_security_events(id uuid primary key default gen_random_uuid(),user_id uuid not null,event text not null,created_at timestamptz not null default now());
alter table public.admin_unlocks enable row level security;
alter table public.admin_pin_credentials enable row level security;
alter table public.admin_pin_permissions enable row level security;
alter table public.admin_security_events enable row level security;
revoke all on public.admin_unlocks,public.admin_pin_credentials,public.admin_pin_permissions,public.admin_security_events from public,anon,authenticated;
grant all on public.admin_unlocks,public.admin_pin_credentials,public.admin_pin_permissions,public.admin_security_events to service_role;

create function public.cm_admin_password_recent() returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m where m->>'method'='password' and case when m->>'timestamp' ~ '^[0-9]{1,12}$' then to_timestamp((m->>'timestamp')::bigint) between now()-interval '5 minutes' and now()+interval '1 minute' else false end);
$$;
create function public.cm_unlock_admin() returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;begin
 if auth.uid() is null or public.cm_admin_membership() is not true or not public.cm_account_is_active(auth.uid()) or not public.cm_admin_password_recent() then raise exception 'Verify your existing CampusMart password before opening the workspace.';end if;
 sid:=(auth.jwt()->>'session_id')::uuid;if sid is null then raise exception 'Sign in again to start an administrator session.';end if;
 insert into public.admin_unlocks values(auth.uid(),sid,now()+interval '8 hours') on conflict(user_id,session_id) do update set expires_at=excluded.expires_at;
 delete from public.admin_unlocks where expires_at<now();
 insert into public.admin_security_events(user_id,event) values(auth.uid(),'password_unlock');
end $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.cm_admin_membership(),false) and public.cm_account_is_active(auth.uid()) and exists(select 1 from public.admin_unlocks where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id' and expires_at>now());
$$;
create function public.cm_lock_admin() returns void language plpgsql security definer set search_path='' as $$begin
 delete from public.admin_unlocks where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id';
end $$;
create function public.cm_admin_pin_status() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if public.is_admin() is not true then raise exception 'Unlock the administrator workspace first.';end if;
 return jsonb_build_object('configured',exists(select 1 from public.admin_pin_credentials where user_id=auth.uid()),'locked_until',(select locked_until from public.admin_pin_credentials where user_id=auth.uid()));
end $$;
-- Resolve the installed extension schema instead of assuming pgcrypto lives in public.
create function public.cm_pin_hash(p_pin text,p_hash text default null) returns text language plpgsql security definer set search_path='' as $$
declare ns text;v text;begin
 select n.nspname into ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 if ns is null then raise exception 'Transaction PIN hashing is unavailable.';end if;
 if p_hash is null then execute format('select %I.crypt($1,%I.gen_salt(''bf'',12))',ns,ns) into v using p_pin;
 else execute format('select %I.crypt($1,$2)',ns) into v using p_pin,p_hash;end if;
 return v;
end $$;
create function public.cm_check_admin_pin(p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.admin_pin_credentials;n int;begin
 if public.is_admin() is not true then raise exception 'Unlock the administrator workspace first.';end if;
 select * into c from public.admin_pin_credentials where user_id=auth.uid() for update;
 if not found then return jsonb_build_object('ok',false,'error','Set up your transaction PIN in Admin security first.');end if;
 if c.locked_until>now() then return jsonb_build_object('ok',false,'error','Transaction PIN is locked. Wait 30 minutes after the last lock before trying again.');end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' or public.cm_pin_hash(p_pin,c.pin_hash) is distinct from c.pin_hash then
   n:=case when c.locked_until is not null then 1 else c.failed_attempts+1 end;
   update public.admin_pin_credentials set failed_attempts=n,locked_until=case when n>=5 then now()+interval '30 minutes' end where user_id=auth.uid();
   insert into public.admin_security_events(user_id,event) values(auth.uid(),case when n>=5 then 'pin_locked' else 'pin_rejected' end);
   return jsonb_build_object('ok',false,'error',case when n>=5 then 'Too many wrong PINs. Transactions are locked for 30 minutes.' else 'Incorrect transaction PIN. '||(5-n)::text||' attempts remain.' end);
 end if;
 update public.admin_pin_credentials set failed_attempts=0,locked_until=null where user_id=auth.uid();
 return jsonb_build_object('ok',true);
end $$;
create function public.cm_set_admin_pin(p_pin text,p_old_pin text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare checked jsonb;begin
 if public.is_admin() is not true or not public.cm_admin_password_recent() then raise exception 'Re-enter your CampusMart password before setting or changing the PIN.';end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' or p_pin ~ '^([0-9])\1{5}$' or p_pin in ('123456','654321') then raise exception 'Choose six digits without a repeated or obvious sequence.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,619));
 if exists(select 1 from public.admin_pin_credentials where user_id=auth.uid()) then
   checked:=public.cm_check_admin_pin(p_old_pin);if checked->>'ok'<>'true' then return checked;end if;
 end if;
 insert into public.admin_pin_credentials(user_id,pin_hash) values(auth.uid(),public.cm_pin_hash(p_pin)) on conflict(user_id) do update set pin_hash=excluded.pin_hash,failed_attempts=0,locked_until=null,changed_at=now();
 insert into public.admin_security_events(user_id,event) values(auth.uid(),'pin_changed');
 return jsonb_build_object('ok',true);
end $$;
create function public.cm_require_transaction_pin(p_operation text,p_target uuid) returns void language plpgsql security definer set search_path='' as $$
declare consumed uuid;begin
 if public.is_admin() is not true then raise exception 'Unlock the administrator workspace first.';end if;
 delete from public.admin_pin_permissions where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id' and operation=p_operation and target=p_target and transaction_id=pg_current_xact_id()::text returning user_id into consumed;
 if consumed is null then raise exception 'Confirm this decision with your transaction PIN.';end if;
end $$;
-- Preserve the original function OIDs so direct RPC calls cannot bypass the PIN.
-- Permissions exist only within the PIN-checked database transaction, not in a
-- browser cookie or a reusable "PIN verified" flag.
do $guard$
declare r record;definition text;begin
 for r in select * from (values
 ('cm_admin_queue_transfer','transfer','p_item_id'),
 ('cm_admin_queue_refund','refund','p_order_id'),
 ('cm_admin_approve_delivery','approve_delivery','p_item_id'),
 ('cm_admin_resolve_delivery_dispute','resolve_dispute','p_item_id'),
 ('cm_admin_hold_delivery','delivery_hold','p_item_id'),
 ('cm_cancel_unsent_transfer','cancel_transfer','p_id')) x(name,operation,target)
 loop
   select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=r.name;
   if definition is null then raise exception 'Missing finance function: %',r.name;end if;
   definition:=regexp_replace(definition,'\mbegin\M',format('begin perform public.cm_require_transaction_pin(%L,%I);',r.operation,r.target),'i');
   execute definition;
 end loop;
end $guard$;
create function public.cm_admin_finance_decision(p_operation text,p_payload jsonb,p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare checked jsonb;target uuid;result jsonb;job uuid;begin
 if public.is_admin() is not true then raise exception 'Unlock the administrator workspace first.';end if;
 if p_operation not in ('transfer','refund','approve_delivery','resolve_dispute','delivery_hold','cancel_transfer','retry_refund') or p_operation is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Choose a supported financial decision.';end if;
 target:=(case when p_operation='refund' then p_payload->>'p_order_id' when p_operation in ('cancel_transfer','retry_refund') then p_payload->>'p_id' else p_payload->>'p_item_id' end)::uuid;
 if target is null then raise exception 'Choose the order or finance job being reviewed.';end if;
 checked:=public.cm_check_admin_pin(p_pin);if checked->>'ok'<>'true' then return checked;end if;
 insert into public.admin_pin_permissions values(auth.uid(),(auth.jwt()->>'session_id')::uuid,p_operation,target,pg_current_xact_id()::text);
 case p_operation
 when 'transfer' then result:=to_jsonb(public.cm_admin_queue_transfer(target,p_payload->>'p_note',(p_payload->>'p_confirmed')::boolean,(p_payload->>'p_recipient_updated_at')::timestamptz,(p_payload->>'p_expected_amount')::bigint));
 when 'refund' then result:=to_jsonb(public.cm_admin_queue_refund(target,nullif(p_payload->>'p_item_id','')::uuid,(p_payload->>'p_deduct_processing')::boolean,(p_payload->>'p_reviewed')::boolean,p_payload->>'p_note',(p_payload->>'p_expected_amount')::bigint,(p_payload->>'p_expected_fee')::bigint));
 when 'approve_delivery' then perform public.cm_admin_approve_delivery(target,p_payload->>'p_note');
 when 'resolve_dispute' then perform public.cm_admin_resolve_delivery_dispute(target,p_payload->>'p_decision',p_payload->>'p_note');
 when 'delivery_hold' then perform public.cm_admin_hold_delivery(target,p_payload->>'p_note',(p_payload->>'p_hold')::boolean);
 when 'cancel_transfer' then perform public.cm_cancel_unsent_transfer(target,p_payload->>'p_note');
 when 'retry_refund' then
   perform public.cm_require_transaction_pin(p_operation,target);
   update public.paystack_refunds set state='queued',updated_at=now() where id=target and state='rejected' and provider_id is null returning id into job;
   if job is null then raise exception 'Only a definitively rejected refund can be retried. Reconcile the existing job.';end if;
   result:=to_jsonb(job);
 end case;
 insert into public.admin_security_events(user_id,event) values(auth.uid(),'finance_'||p_operation);
 return jsonb_build_object('ok',true,'result',result);
end $$;
revoke all on function public.cm_admin_password_recent(),public.cm_unlock_admin(),public.cm_lock_admin(),public.cm_admin_pin_status(),public.cm_pin_hash(text,text),public.cm_check_admin_pin(text),public.cm_set_admin_pin(text,text),public.cm_require_transaction_pin(text,uuid),public.cm_admin_finance_decision(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.cm_unlock_admin(),public.cm_lock_admin(),public.cm_admin_pin_status(),public.cm_set_admin_pin(text,text),public.cm_admin_finance_decision(text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
