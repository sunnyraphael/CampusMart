import {test,expect} from '@playwright/test'
import {ids,session} from '../fixture-backend.mjs'

const backend='http://127.0.0.1:54329'
test.beforeEach(async({context,request})=>{
  await request.post(`${backend}/__reset`)
  await request.post(`${backend}/__vendor`,{data:{role:'vendor',store:true,itemStatus:'shipped'}})
  await request.post(`${backend}/__delivery`,{data:{credited:false}})
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})

test('reporting delivery opens code entry on the order list, keeps the order visible, and focuses the field',async({page})=>{
  await page.goto(`/orders/${ids.order}`)
  await page.getByRole('button',{name:'Generate delivery code',exact:true}).click()
  const code=await page.getByLabel('Your delivery code',{exact:true}).textContent()
  await page.goto('/vendor/orders')
  await page.getByRole('button',{name:'Report delivery',exact:true}).click()
  await expect(page).toHaveURL(/\/vendor\/orders$/)
  await expect(page.getByRole('tab',{name:/Delivery review/})).toHaveAttribute('aria-selected','true')
  await expect(page.getByText('Delivery reported. Enter the buyer’s code here to verify the handover.',{exact:true})).toBeVisible()
  const input=page.getByLabel('Buyer’s delivery code',{exact:true})
  await expect(input).toBeFocused()
  await input.fill('000000');await page.getByRole('button',{name:'Verify code',exact:true}).click()
  await expect(page.locator('.ot-error')).toContainText('does not match')
  await input.fill(code!);await page.getByRole('button',{name:'Verify code',exact:true}).click()
  await expect(page.getByText('Delivery code verified. Admin approval is still required.',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Verify code',exact:true})).toHaveCount(0)
})

test('delivered items expose code entry without opening Details and retry failed verification loads',async({page,request})=>{
  await request.post(`${backend}/__vendor`,{data:{itemStatus:'delivered'}})
  await page.goto('/vendor/orders')
  await page.getByRole('tab',{name:/Delivery review/}).click()
  await request.post(`${backend}/__fail`,{data:{table:'cm_order_tracking'}})
  await page.getByRole('button',{name:'Delivery code',exact:true}).click()
  await expect(page.locator('.ot-error')).toContainText('could not load')
  await request.post(`${backend}/__recover`,{data:{table:'cm_order_tracking'}})
  await page.getByRole('button',{name:'Try again',exact:true}).click()
  await expect(page.getByLabel('Buyer’s delivery code',{exact:true})).toBeFocused()
  expect(await page.evaluate(()=>location.pathname)).toBe('/vendor/orders')
})

test('an already verified handover shows confirmation without asking for the code again',async({page,request})=>{
  await request.post(`${backend}/__vendor`,{data:{itemStatus:'delivered'}})
  await request.post(`${backend}/__delivery`,{data:{tracking:{code_verified_at:new Date().toISOString()}}})
  await page.goto('/vendor/orders');await page.getByRole('tab',{name:/Delivery review/}).click()
  await page.getByRole('button',{name:'Delivery code',exact:true}).click()
  await expect(page.getByText('Delivery code verified. Admin approval is still required.',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Buyer’s delivery code',{exact:true})).toHaveCount(0)
})

test('notification links distinguish a vendor purchase from a sale in the same feed',async({page,request})=>{
  const purchase='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const stranger='99999999-9999-4999-8999-999999999999'
  await request.post(`${backend}/__notification_context`,{data:{buyerId:stranger,orders:[{id:purchase,user_id:ids.user}],notifications:[
    {id:'sale-notification',message:'Someone bought from your store',is_read:false,created_at:new Date().toISOString(),order_id:ids.order},
    {id:'purchase-notification',message:'Your purchase is ready',is_read:false,created_at:new Date().toISOString(),order_id:purchase},
  ]}})
  await page.goto('/notifications')
  const sale=page.locator('article').filter({hasText:'Someone bought from your store'}).getByRole('link',{name:'View order',exact:true})
  const bought=page.locator('article').filter({hasText:'Your purchase is ready'}).getByRole('link',{name:'View order',exact:true})
  await expect(sale).toHaveAttribute('href',`/vendor/orders/${ids.order}`)
  await expect(bought).toHaveAttribute('href',`/orders/${purchase}`)
  await sale.click();await expect(page).toHaveURL(new RegExp(`/vendor/orders/${ids.order}$`))
  await page.goto('/notifications')
  await page.locator('article').filter({hasText:'Your purchase is ready'}).getByRole('link',{name:'View order',exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${purchase}$`))
})

test('notification lookup failures are retryable and never fall back to the wrong order view',async({page,request})=>{
  await request.post(`${backend}/__fail`,{data:{table:'orders'}})
  await page.goto('/notifications')
  await expect(page.getByRole('heading',{name:'We could not load this information.',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'View order',exact:true})).toHaveCount(0)
  await request.post(`${backend}/__recover`,{data:{table:'orders'}})
  await page.getByRole('button',{name:'Try again',exact:true}).click()
  await expect(page.getByRole('link',{name:'View order',exact:true})).toHaveAttribute('href',`/orders/${ids.order}`)
})

for(const theme of ['light','dark'])for(const width of [320,1280])test(`delivery code prompt fits ${width}px in ${theme}`,async({page})=>{
  await page.addInitScript(theme=>localStorage.setItem('campusmart-theme',theme),theme)
  await page.setViewportSize({width,height:900})
  await page.goto('/vendor/orders')
  await page.getByRole('button',{name:'Report delivery',exact:true}).click()
  await expect(page.getByLabel('Buyer’s delivery code',{exact:true})).toBeFocused()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  if(width===320)await page.screenshot({path:`test-results/previews/handover-${theme}.png`,fullPage:true})
})
