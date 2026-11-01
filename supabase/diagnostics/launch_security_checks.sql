-- Read-only metadata checks. No customer data, storage objects, tokens or environment values.
-- A metadata snapshot needs contextual review; permissive privileges alone do not establish exploitability.
select c.relname as table_name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
order by table_name,grantee,privilege_type;

select grantee,table_name,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
and table_name in ('users','sellers','orders','order_items','transactions','admins')
and privilege_type in ('INSERT','UPDATE')
order by table_name,column_name,grantee;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,p.proconfig as function_settings,p.proacl as execution_grants
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and
  (p.proname like 'cm_%' or p.proname in ('is_admin','submit_kyc','admin_kyc_queue','admin_review_kyc'))
order by p.proname;

select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id in ('kyc-documents','product-images');
