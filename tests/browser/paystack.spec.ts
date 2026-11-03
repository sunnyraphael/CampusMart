import {test,expect,type Page,type APIRequestContext} from '@playwright/test'
import {createHmac} from 'node:crypto'
import {ids,session} from '../fixture-backend.mjs'
test.skip(process.env.CAMPUSMART_PAYSTACK_FIXTURE!=='1','Uses the isolated Paystack fixture configuration')
const backend='http://127.0.0.1:54329'
test.beforeEach(async({context,request})=>{
  await request.post(`${backend}/__reset`)
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})
async function begin(page:Page,request:APIRequestContext){
  await page.route('https://checkout.paystack.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Paystack fixture checkout</h1>'}))
  await page.goto('/products');const add=page.locator('.pc-add').first();await add.click();await expect(add).toHaveAttribute('title','Added to cart')
  await page.goto('/checkout');await expect(page.getByText('Paystack TEST checkout.',{exact:false}).filter({visible:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Order summary'}).getByText(/CampusMart service fee.*retained/)).toBeVisible()
  await page.getByLabel('Contact phone',{exact:true}).fill('08012345678')
  await page.getByRole('checkbox',{name:/I have reviewed/}).check()
  await page.getByRole('button',{name:'Paystack test payment',exact:true}).click()
  await expect(page).toHaveURL(/^https:\/\/checkout\.paystack\.com\//)
  return (await(await request.post(`${backend}/__payment`,{data:{}})).json()).payment
}
async function paid(page:Page,request:APIRequestContext){const payment=await begin(page,request);await request.post(`${backend}/__payment`,{data:{status:'success'}});await page.goto('/payments/callback?reference='+payment.reference);await expect(page).toHaveURL(new RegExp('/orders/'+ids.order));await expect(page.getByRole('region',{name:'Payment and refund status'})).toContainText('Verified');return payment}
test('hosted checkout verifies the exact payment and clears only the purchased cart items',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});await paid(page,request)
  await expect(page.getByText('PAYSTACK TEST · No real charge',{exact:false})).toBeVisible()
  await page.goto('/cart');await expect(page.getByRole('heading',{name:'Your cart is empty'})).toBeVisible()
  const calls=await(await request.get(`${backend}/__calls`)).json()
  expect(calls.filter((call:{path:string;method:string})=>call.path==='/__paystack/transaction/initialize'&&call.method==='POST')).toHaveLength(1)
})
test('a callback cannot mark a mismatched charge paid',async({page,request})=>{
  const payment=await begin(page,request)
  await request.post(`${backend}/__payment`,{data:{status:'success',amountDelta:1}})
  await page.goto('/payments/callback?reference='+payment.reference)
  await expect(page.getByRole('region',{name:'Payment and refund status'})).toContainText('Under review')
  await expect(page.getByRole('region',{name:'Payment and refund status'})).not.toContainText('Verified')
  const state=await(await request.post(`${backend}/__payment`,{data:{}})).json()
  expect(state.payment.provider_id).toBeNull();expect(state.payment.state).toBe('review')
})
test('signed webhook replay is harmless and a forged webhook is rejected',async({page,request})=>{
  const payment=await begin(page,request)
  const body=JSON.stringify({event:'charge.success',data:{reference:payment.reference,id:11}})
  const signature=createHmac('sha512','sk_test_fixture').update(body).digest('hex')
  expect((await request.post('/api/paystack/webhook',{data:body,headers:{'content-type':'application/json','x-paystack-signature':'0'.repeat(128)}})).status()).toBe(401)
  await request.post(`${backend}/__payment`,{data:{status:'success'}})
  for(let i=0;i<2;i++)expect((await request.post('/api/paystack/webhook',{data:body,headers:{'content-type':'application/json','x-paystack-signature':signature}})).status()).toBe(200)
  const state=await(await request.post(`${backend}/__payment`,{data:{}})).json()
  expect(state.events).toHaveLength(1);expect(state.payment.state).toBe('paid')
})
test('voluntary cancellation retains only CampusMart’s fee and reconciles a lost refund response without resending',async({page,request})=>{
  await paid(page,request)
  await request.post(`${backend}/__payment`,{data:{refundInterrupted:true}})
  await page.getByRole('button',{name:'Cancellation options',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Cancel this order?'})
  await expect(dialog).toContainText('Refund: ₦12,000. CampusMart service fee retained: ₦240.')
  await page.getByRole('button',{name:'Confirm cancellation',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Order cancelled'})).toBeVisible()
  let state=await(await request.post(`${backend}/__payment`,{data:{}})).json()
  expect(state.refunds[0].state).toBe('uncertain');expect(state.providerRefunds).toHaveLength(1)
  await request.post(`${backend}/__admin`,{data:{enabled:true}})
  await page.getByRole('button',{name:'Close cancellation options'}).click();await page.goto('/admin/payments')
  await expect(page.getByRole('tab',{name:/Recent payments/})).toHaveAttribute('aria-selected','true')
  await page.getByRole('tab',{name:/Refund jobs/}).click()
  await page.getByRole('button',{name:/Successful/}).click()
  await expect(page.getByRole('button',{name:'Reconcile refund',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:/Pending/}).click()
  await page.getByRole('button',{name:'Reconcile refund',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Request recorded'})).toBeVisible()
  state=await(await request.post(`${backend}/__payment`,{data:{}})).json()
  expect(state.refunds[0].state).toBe('pending');expect(state.providerRefunds).toHaveLength(1)
  const calls=await(await request.get(`${backend}/__calls`)).json()
  expect(calls.filter((call:{path:string;method:string})=>call.path==='/__paystack/refund'&&call.method==='POST')).toHaveLength(1)
})
test('payout setup resolves the provider name and stores only the recipient and masked account',async({page,request})=>{
  await request.post(`${backend}/__vendor`,{data:{role:'vendor',store:true}})
  await page.setViewportSize({width:390,height:844});await page.goto('/vendor/payout-account')
  await page.getByRole('combobox',{name:'Bank',exact:true}).selectOption('058')
  await page.getByLabel('Account number',{exact:true}).fill('0123456789')
  await page.getByRole('checkbox',{name:/I am authorized/}).check()
  await page.getByRole('button',{name:'Resolve and save payout account',exact:true}).click()
  await expect(page.getByText('Paystack resolved and saved the account for Test Vendor.')).toBeVisible()
  await expect(page.getByText('Current beneficiary:',{exact:false})).toContainText('6789')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})


test('administrator unlocks using the existing password and makes a fresh navigation',async({page,request})=>{
 await request.post(backend+'/__admin',{data:{enabled:true,unlocked:false}})
 await page.goto('/admin/payments');await expect(page).toHaveURL(/\/admin-security$/)
 await page.getByLabel('CampusMart password',{exact:true}).fill('WrongPassword')
 await page.getByRole('button',{name:'Unlock admin workspace',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'password could not be verified'})).toBeVisible()
 await page.getByLabel('CampusMart password',{exact:true}).fill('FixtureExistingPassword123!')
 const navigation=page.waitForRequest(r=>r.isNavigationRequest()&&new URL(r.url()).pathname==='/admin')
 await page.getByRole('button',{name:'Unlock admin workspace',exact:true}).click();await navigation
 await expect(page).toHaveURL(/\/admin$/)
})

test('vendor credit requires a separate PIN after the delivery review',async({page,request})=>{
 await request.post(backend+'/__admin',{data:{enabled:true}})
 await request.post(backend+'/__delivery',{data:{credited:false,verifiedPayment:true,tracking:{buyer_confirmed_at:new Date().toISOString(),code_verified_at:new Date().toISOString()}}})
 await page.goto('/admin/deliveries')
 await page.getByRole('button',{name:'Approve vendor credit',exact:true}).click()
 await page.getByLabel('Your review note',{exact:true}).fill('Reviewed payment, code and receipt evidence.')
 await page.getByRole('button',{name:'Confirm vendor credit',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Approve vendor credit',exact:true});await expect(dialog).toBeVisible()
 await dialog.getByLabel('Transaction PIN',{exact:true}).fill('999999');await dialog.getByRole('button',{name:'Confirm with PIN'}).click()
 await expect(dialog.getByRole('alert')).toContainText('Incorrect transaction PIN')
 await dialog.getByLabel('Transaction PIN',{exact:true}).fill('246810');await dialog.getByRole('button',{name:'Confirm with PIN'}).click()
 await expect(dialog).toHaveCount(0);await expect(page.getByText('Vendor wallet credited. No bank transfer was initiated.',{exact:true})).toBeVisible()
})

test('browser security headers block framing on public and login pages',async({request})=>{
  for(const route of ['/','/login']){
    const response=await request.get(route)
    expect(response.headers()['x-frame-options']).toBe('DENY')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  }
})


test('first administrator password unlock leads to transaction PIN setup',async({page,request})=>{
 await request.post(backend+'/__admin',{data:{enabled:true,unlocked:false,pinConfigured:false}})
 await page.goto('/admin-security');await page.getByLabel('CampusMart password',{exact:true}).fill('FixtureExistingPassword123!')
 await page.getByRole('button',{name:'Unlock admin workspace',exact:true}).click()
 await page.getByLabel('New transaction PIN',{exact:true}).fill('246810');await page.getByLabel('Confirm transaction PIN',{exact:true}).fill('246810')
 await page.getByRole('button',{name:'Save PIN and open workspace',exact:true}).click();await expect(page).toHaveURL(/\/admin$/)
})


test('password unlock renders content in every admin sidebar tab',async({page,request})=>{
 await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='.ad-body{display:none!important}';document.head.appendChild(style)},{once:true})})
 await request.post(backend+'/__admin',{data:{enabled:true,unlocked:false,pinConfigured:true}})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/admin-security')
 await page.getByLabel('CampusMart password',{exact:true}).fill('FixtureExistingPassword123!')
 await page.getByRole('button',{name:'Unlock admin workspace',exact:true}).click()
 await expect(page.locator('#admin-content h1').first()).toHaveText('Your admin overview')
 for(const [label,title]of [['System health','System health'],['Vendor stores','Vendor stores'],['Deliveries','Delivery approvals'],['Payments & refunds','Payments & refunds'],['Verifications','Verifications'],['Disputes','Disputes'],['Support','Support requests'],['Account requests','Privacy and account requests'],['Guardian permissions','Guardian permissions'],['Overview','Your admin overview']]){
  await page.getByRole('navigation',{name:'Admin sections'}).getByRole('link',{name:label,exact:true}).click()
  await expect(page.locator('#admin-content h1').first()).toHaveText(title,{timeout:20000})
  await expect(page.locator('#admin-content')).toBeVisible()
 }
 expect(errors).toEqual([])
})


test('admin data requests time out visibly and can be recovered',async({page,request})=>{
 await request.post(backend+'/__admin',{data:{enabled:true}})
 await request.post(backend+'/__delay',{data:{table:'cm_admin_delivery_queue',ms:14000}})
 await page.goto('/admin/deliveries')
 await expect(page.getByRole('heading',{name:'We could not load this information.',exact:true})).toBeVisible({timeout:18000})
 await request.post(backend+'/__delay',{data:{table:'cm_admin_delivery_queue',ms:0}})
 await page.getByRole('button',{name:'Try again',exact:true}).click()
 await expect(page.locator('#admin-content h1')).toHaveText('Delivery approvals')
})


test('admin content remains visible with the EasyList ad-body cosmetic rule enabled',async({page,request})=>{
 await request.post(backend+'/__admin',{data:{enabled:true}})
 await page.goto('/admin')
 await expect(page.locator('#admin-content h1').first()).toHaveText('Your admin overview')
 // EasyList's generic ##.ad-body rule hid the whole admin main element.
 await page.addStyleTag({content:'.ad-body{display:none!important}'})
 await expect(page.getByRole('navigation',{name:'Admin sections'})).toBeVisible()
 await expect(page.locator('#admin-content')).toBeVisible()
})
