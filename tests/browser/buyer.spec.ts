import {test,expect} from '@playwright/test'
import {session,ids} from '../fixture-backend.mjs'

test.beforeEach(async({context,request})=>{
  await request.post('http://127.0.0.1:54329/__reset')
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})

test('all buyer destinations load without client errors',async({page})=>{
  test.setTimeout(90000)
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(e.message))
  for(const path of ['/','/categories','/products','/deals','/wishlist','/saved','/messages',`/messages/${ids.chat}`,'/notifications','/profile','/settings','/orders',`/orders/${ids.order}`,`/products/${ids.product}`,`/vendors/${ids.vendor}`,'/help','/contact','/privacy','/terms','/how-it-works']) {
    const response=await page.goto(path)
    expect(response?.status(),path).toBe(200)
    await expect(page.locator('main h1').first(),path).toBeVisible()
  }
  expect(errors).toEqual([])
})

for(const theme of ['light','dark']) for(const width of [320,360,390,412,430,600,900,1280]) {
  test(`buyer layout: ${theme}, ${width}px`,async({page})=>{
    await page.addInitScript((value)=>localStorage.setItem('campusmart-theme',value),theme)
    await page.setViewportSize({width,height:900})
    for(const path of ['/categories','/products','/profile','/settings',`/messages/${ids.chat}`]) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveClass(new RegExp(theme))
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${theme} ${width} ${path}`).toBe(true)
      if(width===390&&(path==='/categories'||path==='/products'))await page.screenshot({path:`test-results/previews/${path.slice(1)}-${theme}.png`,fullPage:true})
    }
  })
}

test('cart controls follow the approved mobile and desktop layout',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/products')
  const button=page.locator('.pc-add').first()
  await expect(button.locator('.pc-add-label')).toBeHidden()
  const b=await button.boundingBox();const footer=await page.locator('.pc-foot').first().boundingBox()
  expect(b!.x+b!.width).toBeCloseTo(footer!.x+footer!.width-10,0)
  expect(b!.width).toBe(36)
  await button.click();await expect(button).toHaveAttribute('title','Added to cart')
  await page.setViewportSize({width:1280,height:900})
  await expect(button.locator('.pc-add-label')).toBeVisible()
  expect((await button.boundingBox())!.width).toBeGreaterThan(100)
  await page.goto('/cart');await expect(page.getByText('Campus headphones').first()).toBeVisible()
  await page.goto('/checkout');await expect(page.getByText('Payment unavailable',{exact:true})).toBeDisabled()
  const calls=await (await page.request.get('http://127.0.0.1:54329/__calls')).json()
  expect(calls.some((c:{path:string})=>c.path.includes('create_order'))).toBe(false)
  await expect(page.getByText('Your payment was successful')).toHaveCount(0)
})

test('search, favorites, saved searches, chat and support work',async({page})=>{
  test.setTimeout(90000)
  await page.setViewportSize({width:390,height:844});await page.goto('/products')
  await page.getByRole('searchbox',{name:'Search listings'}).last().fill('headphones')
  await page.getByRole('button',{name:'Search',exact:true}).last().click()
  await expect(page).toHaveURL(/q=headphones/)
  await page.getByRole('button',{name:'Save search',exact:true}).click()
  await expect(page.getByText('Search saved.',{exact:false})).toBeVisible()
  await page.goto('/saved');await expect(page.getByRole('heading',{name:'headphones'})).toBeVisible()
  await page.goto(`/products/${ids.product}`);await page.getByRole('button',{name:'Save to favorites'}).first().click()
  await page.goto('/wishlist');await expect(page.getByText('Campus headphones').first()).toBeVisible()
  await page.getByRole('button',{name:'Remove from favorites'}).last().click()
  await expect(page.getByText('Save something you like')).toBeVisible()
  await page.goto(`/messages/${ids.chat}`);await page.getByRole('textbox',{name:'Message',exact:true}).fill('Is campus pickup available?')
  await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByText('Is campus pickup available?',{exact:true})).toBeVisible()
  await page.goto('/contact');await page.getByLabel('Subject',{exact:true}).fill('Question about delivery')
  await page.getByLabel('What happened?').fill('Please help me confirm the delivery arrangements for my order.')
  await page.getByRole('button',{name:'Send request'}).click();await expect(page.getByText('Request sent.',{exact:false})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Question about delivery'})).toBeVisible()
})

test('failed product query is an error rather than an empty store or 404',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products'}})
  await page.goto(`/products/${ids.product}`)
  await expect(page.getByText('We could not load this information.')).toBeVisible()
  await expect(page.getByText('Page not found',{exact:true})).toHaveCount(0)
})

test('signed-out buyers are redirected and login preserves the destination',async({page,context})=>{
  await context.clearCookies();await page.goto('/wishlist')
  await expect(page).toHaveURL(/login\?redirectTo=/)
  await page.getByLabel('Email address').fill('buyer@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL(/\/wishlist$/)
})
