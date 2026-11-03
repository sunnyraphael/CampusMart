import {test,expect,type Page} from '@playwright/test'
import {ids,session} from '../fixture-backend.mjs'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({context,request})=>{
  await request.post(`${backend}/__reset`)
  await request.post(`${backend}/__vendor`,{data:{role:'vendor',store:true}})
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}])
})
async function photo(page:Page){
  const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1400;const ctx=canvas.getContext('2d')!;const gradient=ctx.createLinearGradient(0,0,2200,1400);gradient.addColorStop(0,'#2563eb');gradient.addColorStop(1,'#facc15');ctx.fillStyle=gradient;ctx.fillRect(0,0,2200,1400);return canvas.toDataURL('image/png').split(',')[1]})
  return {name:'campus-photo.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')}
}
async function listing(page:Page){await page.goto('/vendor/listings/new');await page.getByLabel('Title',{exact:true}).fill('Optimised campus bag');await page.getByLabel('Category',{exact:true}).selectOption('99999999-9999-4999-8999-999999999999');await page.getByLabel('Price',{exact:true}).fill('2500');await page.locator('input[type=file]').setInputFiles(await photo(page))}
test('new uploads create an optimised original and a working small thumbnail',async({page,request})=>{
  await listing(page);await page.getByRole('button',{name:'Publish listing',exact:true}).click();await expect(page).toHaveURL(/\/vendor\/listings(?:\?|$)/)
  const files=await(await request.get(`${backend}/__uploads`)).json() as {name:string;size:number}[]
  expect(files).toHaveLength(2);const full=files.find(f=>f.name.endsWith('-full.webp'))!,thumb=files.find(f=>f.name.endsWith('-thumb.webp'))!
  expect(full.size).toBeLessThanOrEqual(1048576);expect(thumb.size).toBeLessThan(full.size)
  const dimensions=await page.evaluate(async({backend,full,thumb})=>{const sizes=[];for(const file of [full,thumb]){const image=new Image();image.src=backend+'/storage/v1/object/public/product-images/'+file.name;await image.decode();sizes.push([image.naturalWidth,image.naturalHeight])}return sizes},{backend,full,thumb})
  expect(dimensions[0][0]).toBe(1600);expect(dimensions[1][0]).toBe(640)
})
test('capacity protection preserves a vendor form and sends no upload',async({page,request})=>{
  await request.post(`${backend}/__operations`,{data:{uploadAllowed:false}});await listing(page)
  await page.getByRole('button',{name:'Publish listing',exact:true}).click();await expect(page.getByText(/New photos are temporarily unavailable/)).toBeVisible();await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Optimised campus bag')
  expect(await(await request.get(`${backend}/__uploads`)).json()).toHaveLength(0)
})
test('health checks are public but maintenance requires its secret',async({request})=>{
  expect((await request.get('/api/health')).status()).toBe(200)
  expect((await request.get('/api/operations/maintenance')).status()).toBe(401)
  expect((await request.get('/api/operations/maintenance',{headers:{Authorization:'Bearer fixture-cron-secret-at-least-32-characters'}})).status()).toBe(200)
})
test('admin capacity alerts and maintenance settings protect checkout without clearing the cart',async({page,request})=>{
  await request.post(`${backend}/__admin`,{data:{enabled:true}});await page.setViewportSize({width:390,height:844});await page.goto('/admin/operations')
  await page.getByRole('button',{name:'Check capacity',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'storage is at 80%'})).toBeVisible()
  await page.getByRole('checkbox',{name:/Temporarily stop new orders/}).check();await page.getByRole('button',{name:'Save settings',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Updated.'})).toBeVisible()
  await page.goto('/products');await page.locator('.pc-add').first().click();await page.goto('/checkout')
  await expect(page.getByRole('alert').filter({hasText:'Ordering is temporarily unavailable'})).toBeVisible();await page.getByLabel('Contact phone',{exact:true}).fill('08012345678');await page.getByRole('checkbox',{name:/I have reviewed/}).check();await expect(page.getByRole('button',{name:'Place trial order',exact:true})).toBeDisabled()
  await page.goto('/cart');await expect(page.getByText('Campus headphones',{exact:true}).first()).toBeVisible()
})
test('navigation uses an account summary and inbox requests a bounded page',async({page,request})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/products');await expect(page.getByRole('button',{name:'Open account and help menu'})).toBeVisible()
  await page.goto('/messages');await expect(page.getByRole('heading',{name:'Messages',exact:true})).toBeVisible()
  const calls=await(await request.get(`${backend}/__calls`)).json() as {path:string}[]
  expect(calls.some(c=>c.path==='/rest/v1/rpc/cm_account_summary')).toBe(true);expect(calls.some(c=>c.path==='/rest/v1/rpc/cm_conversations_page')).toBe(true)
  expect(calls.some(c=>c.path==='/rest/v1/rpc/cm_conversations')).toBe(false)
})
