import{test}from'node:test'
import assert from'node:assert/strict'
import{recordedVendorPayout,VENDOR_COMMISSION_RATE}from'../src/lib/vendor/commission.ts'
test('vendor estimates respect stored payouts and per-order commission rather than the current promotion',()=>{
 assert.equal(VENDOR_COMMISSION_RATE,0)
 assert.equal(recordedVendorPayout({subtotal:1234.56,vendor_commission_rate:0}),1234.56)
 assert.equal(recordedVendorPayout({subtotal:1234.56,vendor_commission_rate:0.05}),1172.83)
 assert.equal(recordedVendorPayout({subtotal:1234.56}),1172.83)
 assert.equal(recordedVendorPayout({subtotal:10000,payout_amount:9000,vendor_commission_rate:0}),9000)
 assert.equal(recordedVendorPayout({subtotal:0.10,vendor_commission_rate:0.05}),0.09)
})
