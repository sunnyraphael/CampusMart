import {refundPreview} from '../src/lib/paystack/amounts.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {validSignature,safeCheckoutUrl,matchesCharge,makePaystackClient} from '../src/lib/paystack/protocol.ts'
test('webhooks authenticate the exact body, reject tampering and malformed signatures',()=>{
  const secret='sk_test_fixture',body=JSON.stringify({event:'charge.success',data:{name:'Student ₦ example',amount:1020000}})
  const signature=createHmac('sha512',secret).update(body).digest('hex')
  assert.equal(validSignature(body,signature,secret),true)
  for(const value of [null,'','0'.repeat(128),'abc',signature.slice(1)])assert.equal(validSignature(body,value,secret),false)
  assert.equal(validSignature(body+' ',signature,secret),false)
  assert.equal(validSignature(body,signature,'another_secret'),false)
})
test('checkout redirects accept only Paystack HTTPS checkout URLs',()=>{
  assert.equal(safeCheckoutUrl('https://checkout.paystack.com/example'),'https://checkout.paystack.com/example')
  for(const url of ['https://checkout.paystack.com.evil.test/x','javascript:alert(1)','http://checkout.paystack.com/x','https://evil.test/x','https://user:pass@checkout.paystack.com/x','https://checkout.paystack.com:8443/x'])assert.throws(()=>safeCheckoutUrl(url))
})
test('verification matches reference, original payer, amount, currency, environment, ID and fees',()=>{
  const payment={reference:'cm-ref',email:'buyer@example.test',amount_kobo:1020000,mode:'test'}
  const charge={reference:'cm-ref',status:'success',customer:{email:'BUYER@example.test'},amount:1020000,currency:'NGN',domain:'test',id:100,fees:25000}
  assert.equal(matchesCharge(charge,payment),true)
  for(const delta of [{reference:'other'},{status:'pending'},{amount:1},{amount:1020000.5},{currency:'USD'},{domain:'live'},{id:0},{id:Number.MAX_SAFE_INTEGER+1},{customer:{email:'other@example.test'}},{fees:-1},{fees:2000000},{fees:1.5}])assert.equal(matchesCharge({...charge,...delta},payment),false,JSON.stringify(delta))
})
test('provider requests stay on the API origin, use server authorization and do not cache',async()=>{
  const calls=[]
  const api=makePaystackClient('sk_test_fixture',async(url,options)=>{calls.push({url,options});return Response.json({status:true,data:{reference:'cm-ref'}})})
  assert.deepEqual(await api('/transaction/initialize',{amount:1020000}),{reference:'cm-ref'})
  assert.equal(calls[0].url,'https://api.paystack.co/transaction/initialize')
  assert.equal(calls[0].options.headers.Authorization,'Bearer sk_test_fixture')
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.cache,'no-store')
  await assert.rejects(api('//evil.test/x'),/Invalid provider path/)
})
test('uncertain mutations are never automatically repeated or leak provider responses/secrets',async()=>{
  let calls=0
  const api=makePaystackClient('sk_test_secret',async()=>{calls++;throw new Error('network interrupted')})
  await assert.rejects(api('/refund',{transaction:'cm-ref',amount:1000000}),/network interrupted/)
  assert.equal(calls,1)
  const rejected=makePaystackClient('sk_test_secret',async()=>Response.json({status:false,message:'sk_test_secret private bank details'},{status:400}))
  await assert.rejects(rejected('/transfer',{amount:1}),error=>!error.message.includes('sk_test_secret')&&!error.message.includes('bank details'))
})
test('bank cursor metadata is retained for complete bank-list pagination',async()=>{
  const api=makePaystackClient('sk_test_fixture',async()=>Response.json({status:true,data:[{code:'001',name:'Test bank'}],meta:{next:'cursor'}}))
  assert.deepEqual(await api.page('/bank?use_cursor=true'),{status:true,data:[{code:'001',name:'Test bank'}],meta:{next:'cursor'}})
})

test('item refund previews allocate every kobo exactly and do not retain processing fees twice',()=>{
  const payment={amount_kobo:1121999,provider_fee_kobo:25000},items=[{id:'a',subtotal:10000},{id:'b',subtotal:999.99}]
  const a=refundPreview(payment,items,[],'a',true),b=refundPreview(payment,items,[],'b',true)
  assert.equal(a.amount+b.amount+a.retained+b.retained,payment.amount_kobo);assert.equal(a.retained+b.retained,25000)
  const remaining=refundPreview(payment,items,[{amount_kobo:a.amount,processing_fee_retained_kobo:a.retained}],'',true)
  assert.equal(remaining.amount,b.amount);assert.equal(remaining.retained,b.retained)
  const statutory=refundPreview(payment,items,[{amount_kobo:a.amount,processing_fee_retained_kobo:a.retained}],'',false)
  assert.equal(statutory.amount+a.amount,payment.amount_kobo);assert.equal(statutory.retained,0)
})
