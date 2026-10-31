import {test,expect} from '@playwright/test'
import {session,ids} from '../fixture-backend.mjs'

test.beforeEach(async({context,request})=>{
  await request.post('http://127.0.0.1:54329/__reset')
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session())).toString('base64url'),domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'}])
})

test('logged-in login redirects retain query filters',async({page})=>{
  await page.goto('/login?redirectTo='+encodeURIComponent('/products?category=books&q=math%20notes'))
  const url=new URL(page.url())
  expect(url.pathname).toBe('/products');expect(url.searchParams.get('category')).toBe('books');expect(url.searchParams.get('q')).toBe('math notes')
})

test('signed-out login returns to the original page and its query',async({page,context})=>{
  await context.clearCookies();await page.goto('/orders?page=2')
  expect(new URL(page.url()).searchParams.get('redirectTo')).toBe('/orders?page=2')
  await page.getByLabel('Email address').fill('buyer@example.test');await page.getByLabel('Password',{exact:true}).fill('fixture-password')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page).toHaveURL(/\/orders\?page=2$/)
})

test('profile setup errors remain visible after the callback establishes a session',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'users'}})
  await page.goto('/auth/callback?token_hash=fixture&type=email')
  await expect(page).toHaveURL(/\/login\?error=profile_failed$/)
  await expect(page.locator('.buyer-auth [role="alert"]')).toContainText('account details could not be loaded')
})

test('buyer enables vendor access explicitly before seeing onboarding',async({page})=>{
  await page.goto('/vendor/onboarding')
  await expect(page).toHaveURL(/\/start-selling$/)
  await expect(page.locator('.ob-page')).toHaveCount(0)
  await page.getByRole('button',{name:'Continue to store setup'}).click()
  await expect(page).toHaveURL(/\/vendor\/onboarding$/,{timeout:30000})
  await expect(page.locator('.ob-page')).toBeVisible({timeout:30000})
})

test('existing vendors are redirected away from onboarding and legacy enrollment links',async({page,request,context})=>{
  test.setTimeout(90000)
  await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true}})
  for(const path of ['/vendor/onboarding','/start-selling']) {
    // Next can deliver a server redirect as streamed HTML instead of HTTP 307.
    // Assert the browser's destination and that the onboarding form never renders.
    await page.goto(path)
    await expect(page).toHaveURL(/\/vendor\/dashboard$/,{timeout:30000})
    await expect(page.locator('.ob-page')).toHaveCount(0)
  }
  const legacy=await context.request.get('/vendor/new',{maxRedirects:0})
  expect(legacy.status()).toBe(307)
  expect(new URL(legacy.headers().location,'http://127.0.0.1:3101').pathname).toBe('/start-selling')
})

test('vendor header follows the current page and links to the owned storefront',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true}})
  for(const [path,title]of [['/vendor/listings','Listings'],['/vendor/earnings','Earnings'],['/vendor/settings','Store settings']]) {
    await page.goto(path)
    await expect(page.locator('.vs-topbar-title')).toHaveText(title)
    await expect(page.getByRole('link',{name:'View Store',exact:true})).toHaveAttribute('href',`/vendors/${ids.vendor}`)
    await expect(page.getByRole('link',{name:'My Store',exact:true})).toHaveAttribute('href',`/vendors/${ids.vendor}`)
  }
})

test('listing deletion reports a cleanup failure and can retry without losing the queue',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__vendor',{data:{role:'vendor',store:true,storageFailure:true}})
  await page.goto('/vendor/listings')
  await page.getByRole('button',{name:'Delete Campus headphones',exact:true}).click()
  await page.getByRole('button',{name:'Delete Listing',exact:true}).click()
  await expect(page.getByText('Listing deleted. Some photos need another cleanup attempt; use Clean up unused photos.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Delete Campus headphones',exact:true})).toHaveCount(0)
  await request.post('http://127.0.0.1:54329/__vendor',{data:{storageFailure:false}})
  await page.getByRole('button',{name:'Clean up unused photos',exact:true}).click()
  await expect(page.getByText('Unused photo cleanup is up to date.')).toBeVisible()
})
