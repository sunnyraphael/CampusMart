import {test,expect} from '@playwright/test'
import {ids,session} from '../fixture-backend.mjs'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({context,request})=>{
  await request.post(`${backend}/__reset`)
  await request.post(`${backend}/__vendor`,{data:{role:'vendor',store:true,sellerFields:{logo_url:'/brand/campusmart-symbol.png',whatsapp:'08012345678'}}})
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})
for(const width of [390,1440])test(`admin stores and vendor settings fit ${width}px with branding`,async({page,request})=>{
  await request.post(`${backend}/__admin`,{data:{enabled:true}})
  await page.setViewportSize({width,height:950})
  for(const path of ['/admin/stores',`/admin/stores/${ids.vendor}`,'/vendor/settings','/vendor/listings','/login','/products']){
    await page.goto(path)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toHaveCount(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path).toBe(true)
    if(path==='/admin/stores')await expect(page.getByRole('link',{name:/Campus Store/})).toBeVisible()
    if(path===`/admin/stores/${ids.vendor}`){await expect(page.getByText('Store & owner',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'WhatsApp vendor'})).toHaveAttribute('href','https://wa.me/2348012345678')}
    if(path==='/vendor/listings'){
      await expect(page.locator('.vs-avatar img')).toHaveAttribute('src','/brand/campusmart-symbol.png')
      if(width===1440)expect((await page.locator('.vx-listing').first().boundingBox())!.width).toBeLessThanOrEqual(251)
    }
    if(path==='/products')await expect(page.locator('header img[src="/brand/campusmart-symbol.png"]').first()).toBeVisible()
    if(path==='/admin/stores'||path==='/vendor/listings')await page.screenshot({path:`test-results/previews/store-${path.split('/').at(-1)}-${width}.png`,fullPage:true})
  }
})
test('owner can pause, resume, close and confirm permanent photo removal',async({page})=>{
  await page.goto('/vendor/settings')
  await expect(page.getByRole('button',{name:'Pause listings',exact:true})).toBeHidden()
  await page.getByRole('tab',{name:'Store controls',exact:true}).click()
  await page.getByRole('button',{name:'Pause listings',exact:true}).click()
  let dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Away from campus this week.');await dialog.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('button',{name:'Resume listings',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Resume listings',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Returned and ready to sell.');await dialog.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('button',{name:'Pause listings',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Close store',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Closing my store for this term.');await dialog.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('button',{name:'Reopen store',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Remove public photos permanently',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Remove my public store photos.');await expect(dialog.getByRole('button',{name:'Confirm',exact:true})).toBeDisabled();await dialog.getByLabel('Type DELETE PHOTOS to confirm').fill('DELETE PHOTOS');await dialog.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Store updated successfully.'})).toBeVisible()
})
test('non-admin users cannot view the private store directory',async({page})=>{
  await page.goto('/admin/stores');await expect(page.getByRole('heading',{name:'Vendor stores',exact:true})).toHaveCount(0)
})
test('dismissing the general fee notice persists across pages and reloads',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Dismiss fee notice everywhere'}).first().click()
  await expect(page.locator('.sh-fee-note')).toHaveCount(0)
  for(const path of ['/products','/deals','/wishlist',`/vendors/${ids.vendor}`]){await page.goto(path);await expect(page.locator('.sh-fee-note')).toHaveCount(0)}
  await page.reload();await expect(page.locator('.sh-fee-note')).toHaveCount(0)
})
test('checkout introduction is brief, expandable and shown only on the first visit',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/products');await page.locator('.pc-add').first().click();await page.goto('/checkout')
  const intro=page.getByRole('complementary',{name:'First checkout introduction'})
  await expect(intro).toBeVisible();await expect(intro.getByText(/The summary shows/)).toBeHidden()
  await intro.getByText('Read more',{exact:true}).click();await expect(intro.getByText(/The summary shows/)).toBeVisible()
  await page.reload();await expect(page.locator('.checkout-intro')).toHaveCount(0)
  await expect(page.getByText('Service fee',{exact:true})).toBeVisible();await expect(page.getByText('Estimated total',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
