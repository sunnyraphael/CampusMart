import {test,expect} from '@playwright/test'
import {session,ids} from '../fixture-backend.mjs'

test.beforeEach(async({context,request})=>{
  await request.post('http://127.0.0.1:54329/__reset')
  await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true}})
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})

const paths=['/vendor/dashboard','/vendor/listings','/vendor/listings/new',`/vendor/listings/${ids.product}/edit`,'/vendor/orders',`/vendor/orders/${ids.order}`,`/vendor/orders/${ids.order}/slip`,'/vendor/earnings','/vendor/settings','/vendor/verify','/vendor/guide','/vendor/messages',`/vendor/messages/${ids.chat}`]
for(const theme of ['light','dark']) for(const width of [320,390,900,1440]) {
  test(`vendor pages fit ${width}px in ${theme} mode`,async({page})=>{
    test.setTimeout(150000)
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
    await page.addInitScript(value=>localStorage.setItem('campusmart-theme',value),theme)
    await page.setViewportSize({width,height:950})
    for(const path of paths){
      const response=await page.goto(path)
      expect(response?.status(),path).toBe(200)
      await expect(page.locator('h1').first(),path).toBeVisible()
      await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toHaveCount(0)
      await expect(page.locator('html')).toHaveClass(new RegExp(theme))
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${theme} ${width} ${path}`).toBe(true)
      if((width===390||width===1440)&&['/vendor/dashboard','/vendor/listings','/vendor/settings','/vendor/listings/new'].includes(path))await page.screenshot({path:`test-results/previews/vendor-${path.split('/').at(-1)}-${theme}-${width}.png`,fullPage:true,caret:'initial'})
    }
    expect(errors).toEqual([])
  })
}

test('listing search and stock filters work, including dashboard links',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{products:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',seller_id:ids.vendor,title:'Low stock notebook',price:2000,status:'active',stock_quantity:1,images:[],created_at:new Date().toISOString(),availability:'on_campus'}]}})
  await page.goto('/vendor/dashboard');await page.getByRole('link',{name:/listings to restock/}).click()
  await expect(page.getByLabel('Stock filter')).toHaveValue('low')
  await expect(page.getByRole('heading',{name:'Low stock notebook',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Campus headphones',exact:true})).toHaveCount(0)
  await page.getByLabel('Stock filter').selectOption('all');await page.getByRole('searchbox',{name:'Search your listings'}).fill('nothing matches')
  await expect(page.getByRole('heading',{name:'No listings match these filters'})).toBeVisible()
  await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('.vx-listing')).toHaveCount(2)
})

test('mobile menu traps focus, closes on Escape and follows navigation',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/vendor/dashboard')
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Vendor workspace'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Close menu',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Log out',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.locator('.vs-logo')).toBeFocused()
  await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Log out',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Close menu',exact:true}).click();await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Open menu',exact:true}).click()
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeFocused()
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('navigation',{name:'Vendor navigation'}).getByRole('link',{name:'Vendor guide',exact:true}).click()
  await expect(page).toHaveURL(/\/vendor\/guide$/);await expect(page.getByRole('button',{name:'Open menu',exact:true})).toHaveAttribute('aria-expanded','false')
})

test('vendor chat sends through the existing in-app conversation',async({page})=>{
  await page.goto('/vendor/messages');await page.locator('.vx-conversation').first().click()
  await expect(page).toHaveURL(new RegExp(`/vendor/messages/${ids.chat}$`))
  await page.getByRole('textbox',{name:'Message',exact:true}).fill('Yes, this item is available for pickup.')
  await page.getByRole('button',{name:'Send message',exact:true}).click()
  await expect(page.getByRole('log',{name:'Conversation'})).toContainText('Yes, this item is available for pickup.')
})

test('failed order update stays actionable and never claims success',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{itemStatus:'pending'}})
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'vendor_update_item_status'}})
  await page.goto('/vendor/orders');await page.getByRole('button',{name:'Confirm order',exact:true}).click()
  await expect(page.locator('.vo-error')).toBeVisible();await expect(page.getByRole('button',{name:'Confirm order',exact:true})).toBeEnabled()
})

test('order advancement reloads the server status',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{itemStatus:'pending'}})
  await page.goto('/vendor/orders');await page.getByRole('button',{name:'Confirm order',exact:true}).click()
  await expect(page.getByRole('button',{name:'Mark as shipped',exact:true})).toBeEnabled({timeout:15000})
})

test('transaction export downloads the displayed records',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{transactions:[{id:'tx-1',type:'earning',amount:11400,status:'completed',description:'Headphones earnings',created_at:new Date().toISOString()}]}})
  await page.goto('/vendor/earnings');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export transactions'}).click()
  expect((await download).suggestedFilename()).toBe('campusmart-transactions.csv')
})

test('store data failures show retry rather than an empty catalog',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products'}})
  await page.goto('/vendor/listings');await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled()
  await expect(page.getByRole('heading',{name:'Your first listing starts here'})).toHaveCount(0)
})

test('store sharing copies the correct public storefront URL',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.goto('/vendor/dashboard');await page.getByRole('button',{name:'Share store',exact:true}).click()
  await expect(page.getByRole('button',{name:'Link copied',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(`http://127.0.0.1:3101/vendors/${ids.vendor}`)
})

test('onboarding steps fit a narrow phone and agreement checkboxes work by keyboard',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{store:false}})
  await page.setViewportSize({width:320,height:850});await page.goto('/vendor/onboarding')
  await page.getByRole('button',{name:/Continue/}).click();await expect(page.locator('.ob-error')).toContainText('Store name is required')
  await page.getByLabel('Store name').fill('Campus Shop');await page.getByLabel('Store description').fill('Useful things for students on campus.');await page.getByLabel('Main category').selectOption('Electronics & Gadgets')
  await page.getByRole('button',{name:/Continue/}).click();await page.getByLabel('Phone number').fill('08012345678');await page.getByLabel('State').selectOption('Lagos');await page.getByLabel('Campus / Area').fill('Campus')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByRole('button',{name:/Continue/}).click();await page.getByLabel('Bank name').selectOption('Access Bank');await page.getByLabel('Account number').fill('0123456789');await page.getByLabel('Account name').fill('Test Vendor')
  await page.getByRole('button',{name:/Continue/}).click();const checkbox=page.getByRole('checkbox').first();await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked()
  await expect(page.getByLabel('Digital signature')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
