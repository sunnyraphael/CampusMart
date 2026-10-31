import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildOverview} from '../src/lib/vendor/overview.ts'
import {transactionsCsv,csvCell} from '../src/lib/vendor/export.ts'

const products=[{id:'p',title:'Notes',images:[],status:'active',stock_quantity:2},{id:'pre',title:'Pre-order',status:'active',stock_quantity:0,availability:'pre_order'},{id:'draft',title:'Draft',status:'draft',stock_quantity:0}]
const item=(id,order,status,subtotal=1000)=>({id,order_id:order,product_id:'p',quantity:1,subtotal,fulfillment_status:status})

test('overview excludes unpaid orders and refunds from sales, chart and bestsellers',()=>{
  const data=buildOverview(products,[item('i','paid','received'),item('j','refund','refunded',2000),item('k','unpaid','pending',9000)],[{id:'paid',created_at:'2026-10-30T23:30:00Z'},{id:'refund',created_at:'2026-10-31T01:00:00Z'}],new Date('2026-10-31T12:00:00Z'))
  assert.equal(data.stats.totalSales,1000);assert.equal(data.stats.unitsSold,1);assert.equal(data.stats.totalOrders,2)
  assert.equal(data.topProducts[0].revenue,1000);assert.equal(data.chartData.at(-1).sales,1000)
  assert.equal(data.attention.lowStock,1);assert.equal(data.attention.drafts,1);assert.equal(data.attention.orders,0)
})
test('attention counts orders once and order status reflects the least advanced item',()=>{
  const data=buildOverview(products,[item('a','o','pending'),item('b','o','shipped')],[{id:'o',created_at:'2026-10-31T10:00:00Z'}],new Date('2026-10-31T12:00:00Z'))
  assert.equal(data.attention.orders,1);assert.equal(data.recentOrders[0].status,'pending');assert.equal(data.recentOrders[0].itemCount,2)
  const disputed=buildOverview([], [item('a','o','disputed'),item('b','o','pending')],[{id:'o',created_at:'2026-10-31T10:00:00Z'}])
  assert.equal(disputed.recentOrders[0].status,'disputed')
})
test('CSV export quotes fields, preserves records and neutralizes spreadsheet formulas',()=>{
  const csv=transactionsCsv([{id:'tx',description:'=HYPERLINK("evil")',amount:12000,status:'completed'}])
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));assert.ok(csv.includes('"12000"'))
  assert.equal(csvCell('a,b\nc'),'"a,b\nc"');assert.equal(csvCell('\t=1'),'"\'\t=1"')
  assert.equal(csvCell(-1500),'"-1500"')
})
