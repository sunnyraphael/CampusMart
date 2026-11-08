import {test,expect} from '@playwright/test'
import {ids,session} from '../fixture-backend.mjs'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({request,context})=>{await request.post(backend+'/__reset');await request.post(backend+'/__vendor',{data:{role:'vendor',store:true}});await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}])})
test('vendor launch offer has no announced end date and preserves separate buyer charges',async({page})=>{
 await page.goto('/vendor-terms');await expect(page.locator('#fees')).toContainText('0% vendor commission');await expect(page.locator('#fees')).toContainText('No end date has been announced');await expect(page.locator('#fees')).toContainText('Buyer service and delivery charges are shown separately')
 await page.goto('/');await expect(page.locator('.sh-vendor-band[aria-labelledby="hm-vendor"]')).toContainText('0% vendor commission for a limited time')
 await page.goto('/vendor/guide');await expect(page.locator('main')).toContainText('0% vendor commission for a limited time')
})
test('new listing earnings preview uses the zero commission launch offer on mobile',async({page})=>{
 await page.setViewportSize({width:320,height:850});await page.goto('/vendor/listings/new');await page.getByLabel('Price',{exact:true}).fill('10000')
 await expect(page.locator('.lf-earn')).toContainText('0% launch commission');await expect(page.locator('.lf-earn strong')).toHaveText(/10,000/);await expect(page.locator('.lf-earn')).toContainText('For a limited time');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('vendor order estimates use the order snapshot and preserve older payouts',async({page,request})=>{
 await request.post(backend+'/__vendor',{data:{commissionRate:0,payoutUnset:true}});await page.goto('/vendor/orders/'+ids.order);await expect(page.locator('.od-meta strong').first()).toHaveText(/12,000/)
 await request.post(backend+'/__vendor',{data:{commissionRate:0.05,payoutUnset:true}});await page.reload();await expect(page.locator('.od-meta strong').first()).toHaveText(/11,400/)
})
