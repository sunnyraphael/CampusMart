import {test} from 'node:test'
import assert from 'node:assert/strict'
import {notificationOrderLinks} from '../src/lib/orders/notification-links.ts'

test('a vendor receives buyer links for purchases and vendor links for sales in the same feed',()=>{
  const links=notificationOrderLinks('vendor-user',[{id:'purchase',user_id:'vendor-user'},{id:'sale',user_id:'other-buyer'}],['sale'])
  assert.equal(links.purchase,'/orders/purchase')
  assert.equal(links.sale,'/vendor/orders/sale')
})
test('self-purchases use the buyer view and unrelated or missing orders get no link',()=>{
  const links=notificationOrderLinks('user',[{id:'self',user_id:'user'},{id:'unrelated',user_id:'stranger'}],['self','missing-order'])
  assert.deepEqual(links,{self:'/orders/self'})
  assert.deepEqual(notificationOrderLinks('',[{id:'self',user_id:'user'}],['self']),{})
})
