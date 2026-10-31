import {test,expect,type Page} from '@playwright/test'
import {session,ids} from '../fixture-backend.mjs'

test.beforeEach(async({context,request})=>{
  await request.post('http://127.0.0.1:54329/__reset')
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})
async function workerReady(page:Page){await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))})}

test('offline screen preserves an open form and restores it when online',async({page,context,request})=>{
  await page.goto('/contact');await page.getByLabel('Subject',{exact:true}).fill('Keep this support draft')
  await context.setOffline(true);await expect(page.getByRole('heading',{name:'You’re offline',exact:true})).toBeVisible()
  await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('Keep this support draft')
  await context.setOffline(false);await expect(page.getByLabel('Subject',{exact:true})).toBeVisible();await expect(page.getByLabel('Subject',{exact:true})).toHaveValue('Keep this support draft')
  const calls=await(await request.get('http://127.0.0.1:54329/__calls')).json();expect(calls.some((c:{path:string})=>c.path.includes('cm_support_request'))).toBe(false)
})

test('refreshing offline uses the branded fallback and caches no account pages',async({page,context})=>{
  await page.goto('/profile');await workerReady(page)
  const paths=await page.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith('campusmart-offline-'))!);return(await cache.keys()).map(r=>new URL(r.url).pathname).sort()})
  expect(paths).toEqual(['/offline.html','/offline.js','/status.css'])
  await context.setOffline(true);await page.goto('/products?offline-preview=1',{waitUntil:'domcontentloaded'})
  await expect(page.getByRole('heading',{name:'You’re offline',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible()
  await context.setOffline(false);await expect(page.getByRole('heading',{name:'All listings',exact:true})).toBeVisible({timeout:15000})
})

test('custom vendor error retry refetches the server instead of repeating the error',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true}});await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products'}})
  await page.goto('/vendor/listings');await expect(page.getByRole('heading',{name:'We couldn’t load this page'})).toBeVisible()
  await request.post('http://127.0.0.1:54329/__recover',{data:{table:'products'}});await page.getByRole('button',{name:'Try again',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Your listings',exact:true})).toBeVisible();await expect(page.locator('.vx-listing')).toHaveCount(1)
})

test('unavailable data retries in place and a missing page has its own screen',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products'}});await page.goto(`/products/${ids.product}`)
  await expect(page.getByRole('heading',{name:'We could not load this information.'})).toBeVisible()
  await request.post('http://127.0.0.1:54329/__recover',{data:{table:'products'}});await page.getByRole('button',{name:'Try again',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Campus headphones',exact:true})).toBeVisible()
  await page.goto('/products/not-a-valid-id');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();await expect(page.getByRole('link',{name:'Browse listings',exact:true})).toBeVisible()
})

for(const width of [390,1280])test(`catalog skeleton matches the loaded tile geometry at ${width}px`,async({page,request})=>{
  await page.setViewportSize({width,height:900});await request.post('http://127.0.0.1:54329/__delay',{data:{table:'products',ms:3000}})
  const nav=page.goto('/products',{waitUntil:'commit'});await nav
  const skeleton=page.locator('main [data-page-skeleton="catalog"]:visible');await expect(skeleton).toBeVisible()
  const before=await skeleton.locator('.pc-photo').first().boundingBox();const columns=await skeleton.locator('.pl-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns)
  await expect(skeleton).toHaveCount(0,{timeout:15000})
  const after=await page.locator('.pl-grid .pc-photo').first().boundingBox();expect(after!.x).toBeCloseTo(before!.x,0);expect(after!.width).toBeCloseTo(before!.width,0);expect(after!.height).toBeCloseTo(before!.height,0)
  expect(Math.abs(after!.y-before!.y)).toBeLessThanOrEqual(2)
  const finalColumns=await page.locator('.pl-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns)
  const beforeColumns=columns.split(' ').map(parseFloat),afterColumns=finalColumns.split(' ').map(parseFloat)
  expect(afterColumns).toHaveLength(beforeColumns.length);afterColumns.forEach((column,i)=>expect(column).toBeCloseTo(beforeColumns[i],1))
})

test('different vendor pages show their own loaders at narrow widths',async({page,request})=>{
  test.setTimeout(90000);await page.setViewportSize({width:320,height:900});await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true}})
  for(const [path,table,kind]of [['/vendor/dashboard','products','vendor-overview'],['/vendor/listings','products','vendor-listings'],[`/vendor/listings/${ids.product}/edit`,'products','vendor-listing-form'],['/vendor/earnings','transactions','vendor-earnings'],['/vendor/messages','cm_conversations','vendor-inbox']]){
    await request.post('http://127.0.0.1:54329/__delay',{data:{table,ms:2200}});await page.goto(path,{waitUntil:'commit'})
    await expect(page.locator(`#vendor-content [data-page-skeleton="${kind}"]:visible`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true)
    await expect(page.locator('[data-page-skeleton]:visible')).toHaveCount(0,{timeout:15000});await request.post('http://127.0.0.1:54329/__delay',{data:{table,ms:0}})
  }
})
