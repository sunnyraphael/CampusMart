import {test} from 'node:test'
import assert from 'node:assert/strict'
import {retryCatalogRead} from '../src/lib/buyer/catalog-read.ts'

test('a temporary catalog outage is retried once and recovers',async()=>{
  let calls=0;const success={error:null,status:200,data:[{id:'product'}]}
  const result=await retryCatalogRead(async()=>++calls===1?{error:{message:'Unavailable'},status:503,data:null}:success,async()=>{})
  assert.equal(result,success);assert.equal(calls,2)
})
test('persistent catalog failures stop after two requests and preserve the actual error',async()=>{
  let calls=0;const failure={error:{message:'fetch failed'},status:0,data:null}
  const result=await retryCatalogRead(async()=>{calls++;return failure},async()=>{})
  assert.equal(result,failure);assert.equal(calls,2)
})
test('successful reads and permissions or schema failures are not retried',async()=>{
  for(const status of [200,400,401,403,404]){
    let calls=0;const response={status,error:status===200?null:{message:'Permanent error'}}
    assert.equal(await retryCatalogRead(async()=>{calls++;return response},async()=>{}),response)
    assert.equal(calls,1)
  }
})
