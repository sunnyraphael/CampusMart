import {test,expect} from '@playwright/test'
import {ids,session} from '../fixture-backend.mjs'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({request,context})=>{await request.post(backend+'/__reset');await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}])})
test('confirming receipt opens the correct item review and saving updates the public rating',async({page,request})=>{
 await request.post(backend+'/__vendor',{data:{itemStatus:'delivered'}});await request.post(backend+'/__delivery',{data:{credited:false,tracking:{code_verified_at:new Date().toISOString()}}})
 await page.goto('/orders/'+ids.order);await page.getByRole('button',{name:'I received this',exact:true}).click();await page.getByRole('button',{name:'Confirm receipt',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Campus headphones',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('radio',{name:'4 stars',exact:true}).check();await dialog.getByLabel('Your review (optional)',{exact:true}).fill('Comfortable and useful for lectures.')
 await dialog.getByRole('button',{name:'Save review',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('saved for this item')
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.goto('/products/'+ids.product)
 await expect(page.locator('#reviews')).toContainText('Comfortable and useful for lectures.');await expect(page.locator('.sh-product-rating')).toContainText('4.0');await expect(page.locator('.sh-review-total')).toHaveText('1 review')
 await page.getByRole('radio',{name:'2 stars',exact:true}).check();await page.getByRole('button',{name:'Update review',exact:true}).click();await expect(page.locator('.sh-product-rating')).toContainText('2.0');await expect(page.locator('.sh-review-total')).toHaveText('1 review')
})
test('buyers can skip the prompt and return later without forcing a review',async({page,request})=>{
 await request.post(backend+'/__vendor',{data:{itemStatus:'delivered'}});await request.post(backend+'/__delivery',{data:{credited:false}})
 await page.goto('/orders/'+ids.order);await page.getByRole('button',{name:'I received this',exact:true}).click();await page.getByRole('button',{name:'Confirm receipt',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Not now',exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Rate this item',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Rate this item',exact:true}).click();await page.getByRole('dialog').getByRole('radio',{name:'5 stars',exact:true}).check();await page.getByRole('dialog').getByRole('button',{name:'Save review',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('saved for this item')
})
test('public reviews are item-specific and paginated; an older own review still loads for editing',async({page,request})=>{
 const rows:Array<{rating:number;comment:string;user_id:string;product_id?:string}>=Array.from({length:21},(_,i)=>({rating:i===0?5:3,comment:'Item feedback '+i,user_id:i===20?ids.user:crypto.randomUUID()}));rows.push({product_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:crypto.randomUUID(),rating:1,comment:'Unrelated product feedback'})
 await request.post(backend+'/__reviews',{data:{rows}});await page.goto('/products/'+ids.product)
 await expect(page.locator('#reviews article')).toHaveCount(20);await expect(page.locator('#reviews')).not.toContainText('Unrelated product feedback');await expect(page.getByLabel('Your review (optional)',{exact:true})).toHaveValue('Item feedback 20');await expect(page.getByRole('radio',{name:'3 stars',exact:true})).toBeChecked()
 await page.getByRole('link',{name:'More reviews',exact:true}).click();await expect(page.locator('#reviews article')).toHaveCount(1);await expect(page.locator('#reviews article')).toContainText('Item feedback 20');await expect(page.locator('.sh-review-total')).toHaveText('21 reviews')
 await page.context().clearCookies();await page.reload();await expect(page.locator('#reviews article')).toContainText('Item feedback 20');await expect(page.getByRole('radiogroup',{name:'Rating',exact:true})).toHaveCount(0)
})
test('reviews stay unavailable before receipt and on Paystack test purchases',async({page,request})=>{
 await request.post(backend+'/__vendor',{data:{itemStatus:'shipped'}});await page.goto('/products/'+ids.product);await expect(page.getByRole('radiogroup',{name:'Rating',exact:true})).toHaveCount(0)
 await request.post(backend+'/__vendor',{data:{itemStatus:'received',paymentEnvironment:'test'}})
 await page.goto('/orders/'+ids.order);await expect(page.getByRole('button',{name:'Rate this item',exact:true})).toHaveCount(0);await page.goto('/products/'+ids.product);await expect(page.getByRole('radiogroup',{name:'Rating',exact:true})).toHaveCount(0)
})
test('review dialog fits a 320px screen in dark mode and a failed save preserves the draft',async({page,request})=>{
 await page.setViewportSize({width:320,height:760});await page.addInitScript(()=>localStorage.setItem('campusmart-theme','dark'));await page.goto('/orders/'+ids.order);await page.getByRole('button',{name:'Rate this item',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('radio',{name:'1 star',exact:true}).check();await dialog.getByLabel('Your review (optional)',{exact:true}).fill('The item did not work.')
 await request.post(backend+'/__fail',{data:{table:'cm_review_product'}});await dialog.getByRole('button',{name:'Save review',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByLabel('Your review (optional)',{exact:true})).toHaveValue('The item did not work.');expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true)
 await request.post(backend+'/__recover',{data:{table:'cm_review_product'}});await dialog.getByRole('button',{name:'Save review',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('saved for this item')
})
