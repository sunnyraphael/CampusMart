import {test} from 'node:test'
import assert from 'node:assert/strict'
import {queueMatches,deliveryReady,buildAdminFocus} from '../src/lib/admin/queues.ts'

test('queue search matches all words across fields and pasted order references',()=>{
  assert.equal(queueMatches('  CAMPUS #abc ', 'Campus store', 'ABC123'),true)
  assert.equal(queueMatches('campus missing','Campus store','abc123'),false)
  assert.equal(queueMatches('',null,undefined),true)
})
test('approval readiness keeps real verified payments, buyer receipt, code and holds separate',()=>{
  const item={payment_status:'paid',payment_verified_at:'now',payment_verification_ref:'ref',buyer_confirmed_at:'now',code_verified_at:'now',held_at:null,fulfillment_status:'received',released_at:null}
  assert.equal(deliveryReady(item),true)
  for(const change of [{payment_verification_ref:' '},{buyer_confirmed_at:null},{code_verified_at:null},{held_at:'now'},{fulfillment_status:'disputed'},{released_at:'now'},{payment_status:'unpaid'}])assert.equal(deliveryReady({...item,...change}),false)
  assert.equal(deliveryReady({...item,is_trial:true,payment_status:'unpaid',payment_verified_at:null,payment_verification_ref:null}),true)
  assert.equal(deliveryReady({...item,is_trial:true,code_verified_at:null}),false)
})
test('review next prioritizes disputes and overdue delivery, deduplicates holds and excludes resolved support',()=>{
  const delivery=(id,date)=>({item_id:id,product_title:id,store_name:'Store',reported_at:'2026-01-01',review_after:date})
  const focus=buildAdminFocus({disputes:[{item_id:'disputed',ordered_at:'2026-01-01'}],held:[delivery('disputed',null),delivery('held',null)],deliveries:[delivery('normal',null),delivery('due','2026-01-01')],verifications:[{seller_id:'vendor',store_name:'Shop',submitted_at:'2026-01-01'}],support:[{id:'resolved',status:'resolved',subject:'Done',created_at:'2026-01-01'},{id:'open',status:'open',subject:'Help',created_at:'2026-01-01'}]},Date.parse('2026-10-31'))
  assert.deepEqual(focus.map(i=>i.key),['item:disputed','item:due','item:held','vendor:vendor','item:normal','support:open'])
  assert.equal(focus[0].href,'/admin/disputes#dispute-disputed')
})
