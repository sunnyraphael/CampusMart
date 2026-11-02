// Run with node --env-file=.env.local scripts/reconcile-payments.mjs.
const secret=process.env.CRON_SECRET
const origin=new URL(process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000')
if(!secret||secret.length<32)throw new Error('Configure a server-only CRON_SECRET of at least 32 characters.')
if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw new Error('Invalid application origin.')
if(origin.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new Error('Use HTTPS outside local development.')
const response=await fetch(new URL('/api/payments/reconcile',origin),{headers:{authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(65000)})
if(!response.ok)throw new Error(`Reconciliation failed (HTTP ${response.status}). Check server configuration and logs.`)
const result=await response.json()
console.log(`Reconciled ${Number(result.checked)||0} jobs; ${Number(result.failed)||0} need another check.`)
