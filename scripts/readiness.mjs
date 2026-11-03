// Read-only checks. Never prints keys, passwords, cookies or provider responses.
import {access,readFile} from 'node:fs/promises'
import path from 'node:path'
const checks=[]
const add=(name,ok,detail)=>checks.push({name,status:ok?'pass':'needs setup',detail})
add('Supabase URL',!!process.env.NEXT_PUBLIC_SUPABASE_URL,'Configure the correct project URL.')
add('Public Supabase key',!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Required for browser authentication.')
add('Server Supabase key',!!process.env.SUPABASE_SERVICE_ROLE_KEY,'Required for finance and scheduled maintenance; never public.')
add('Scheduled worker authentication',(process.env.CRON_SECRET?.length??0)>=32,'Configure separate schedules for payments (every minute) and operations (every five minutes).')
let https=false;try{https=new URL(process.env.NEXT_PUBLIC_APP_URL).protocol==='https:'}catch{}
add('Public HTTPS site',https,'Required for live checkout and dependable webhooks.')
add('Backup encryption',/^[a-f0-9]{64}$/i.test(process.env.BACKUP_ENCRYPTION_KEY??''),'Keep a secure off-site copy of this key; losing it makes backups unreadable.')
add('Database backup connection',!!process.env.BACKUP_DATABASE_URL,'Use a direct/session PostgreSQL URL, not the transaction pooler.')
const root=path.resolve(process.env.BACKUP_DIR??'backups')
for(const kind of ['database','storage'])add(`${kind} snapshot exists`,await access(path.join(root,'latest-'+kind)).then(()=>true,()=>false),'Existence is not proof of successful restoration. Verify the archive and keep an off-site copy.')
let restored=false;try{const r=JSON.parse(await readFile(path.join(root,'restore-test-result.json'),'utf8'));restored=Date.now()-new Date(r.completed_at).getTime()<30*86400000}catch{}
add('Recent local database restoration test',restored,'Run an explicitly confirmed restoration into an empty localhost test database, then test the app and files.')
if(process.argv.includes('--check-auth-remote')){
  const ref=process.env.SUPABASE_PROJECT_REF,token=process.env.SUPABASE_ACCESS_TOKEN
  if(!/^[a-z0-9]{20}$/.test(ref??'')||!token)add('Custom SMTP',false,'Set local Management API credentials to inspect configuration, or check the Supabase Auth dashboard manually.')
  else try{const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error();const config=await response.json();add('Custom SMTP',!!config.smtp_host,'Only checks whether a host is configured. Send confirmation and recovery test emails to verify actual delivery.')}catch{add('Custom SMTP',false,'Could not inspect configuration. Verify it in Supabase Auth settings.')}
}else add('Custom SMTP',false,'External account setup: configure SMTP in Supabase Auth, then test sign-up and recovery. Optional --check-auth-remote inspects only configuration.')
if(process.argv.includes('--check-http'))try{const url=new URL('/api/health',process.env.NEXT_PUBLIC_APP_URL);const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000)});add('Database health endpoint',response.ok,'A successful ping does not establish payment, email or backup readiness.')}catch{add('Database health endpoint',false,'Could not reach the configured site.')}
console.log(JSON.stringify(checks,null,2));if(checks.some(c=>c.status!=='pass'))process.exitCode=1
