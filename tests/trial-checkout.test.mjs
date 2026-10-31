import {test} from 'node:test'
import assert from 'node:assert/strict'
import {trialCheckoutEnabled,trialOrderSchema} from '../src/lib/orders/trial.ts'

test('trial checkout defaults to local development and has an explicit production switch',()=>{
  assert.equal(trialCheckoutEnabled({NODE_ENV:'development'}),true)
  assert.equal(trialCheckoutEnabled({NODE_ENV:'production'}),false)
  assert.equal(trialCheckoutEnabled({NODE_ENV:'production',CAMPUSMART_TRIAL_CHECKOUT:'1'}),true)
  assert.equal(trialCheckoutEnabled({NODE_ENV:'development',CAMPUSMART_TRIAL_CHECKOUT:'0'}),false)
})
test('trial checkout validates contact, delivery address, cart identity and integer quantities',()=>{
  const valid={requestId:'11111111-1111-4111-8111-111111111111',items:[{product_id:'22222222-2222-4222-8222-222222222222',quantity:1}],deliveryMethod:'pickup',address:'',phone:'08012345678',note:'',expectedTotal:1020}
  assert.equal(trialOrderSchema.safeParse(valid).success,true)
  for(const bad of [{phone:'123'},{deliveryMethod:'delivery',address:''},{items:[...valid.items,...valid.items]},{items:[{...valid.items[0],quantity:1.5}]},{expectedTotal:-1}])assert.equal(trialOrderSchema.safeParse({...valid,...bad}).success,false)
})
