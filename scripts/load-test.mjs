// Only public GET requests. Never creates accounts, orders, charges or transfers.
import {writeFile} from 'node:fs/promises'
const base=new URL(process.env.LOAD_TEST_BASE_URL??'http://127.0.0.1:3101')
if(base.username||base.password||!['http:','https:'].includes(base.protocol))throw new Error('Invalid load-test URL.')
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&process.env.LOAD_TEST_ALLOW_STAGING!=='1')throw new Error('Use localhost or explicitly set LOAD_TEST_ALLOW_STAGING=1 for your own staging site.')
const seconds=Math.max(1,Math.min(300,Number(process.env.LOAD_TEST_SECONDS)||30)),rps=Math.max(1,Math.min(50,Number(process.env.LOAD_TEST_RPS)||5)),concurrency=Math.max(1,Math.min(50,Number(process.env.LOAD_TEST_CONCURRENCY)||5))
const includeAccount=process.env.LOAD_TEST_INCLUDE_ACCOUNT==='1'
if(includeAccount&&!process.env.LOAD_TEST_COOKIE)throw new Error('Account page testing requires a dedicated staging session in LOAD_TEST_COOKIE. Never paste it into chat.')
const urls=['/products','/categories','/deals',...(includeAccount?['/messages','/orders','/checkout']:[])],end=Date.now()+seconds*1000,samples=[],pending=new Set();let sent=0,errors=0
while(Date.now()<end){
  if(pending.size<concurrency){const started=performance.now(),url=new URL(urls[sent++%urls.length],base)
    const job=fetch(url,{redirect:'error',headers:includeAccount?{Cookie:process.env.LOAD_TEST_COOKIE}:{},signal:AbortSignal.timeout(15000)}).then(async r=>{await r.arrayBuffer();if(!r.ok)errors++},()=>{errors++}).finally(()=>{samples.push(performance.now()-started);pending.delete(job)})
    pending.add(job)
  }
  await new Promise(resolve=>setTimeout(resolve,1000/rps))
}
await Promise.all(pending);samples.sort((a,b)=>a-b)
const percentile=p=>Math.round(samples[Math.max(0,Math.ceil(samples.length*p)-1)]??0)
const result={origin:base.origin,requests:sent,errors,errorPercent:sent?Math.round(errors*10000/sent)/100:0,p50ms:percentile(.5),p95ms:percentile(.95),p99ms:percentile(.99),seconds,rps,concurrency}
await writeFile('load-test-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(errors)process.exitCode=1
