import {test,expect} from '@playwright/test'
import {ids} from '../fixture-backend.mjs'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({request})=>{await request.post(backend+'/__reset')})
test('public pages have distinct metadata, canonical URLs and a single visible main heading',async({page})=>{
 const titles=new Set<string>(),descriptions=new Set<string>()
 for(const path of ['/','/categories','/products','/how-it-works','/contact','/privacy','/products/'+ids.product]){
  await page.goto(path)
  await expect(page.locator('h1:visible')).toHaveCount(1)
  const title=await page.title(),description=await page.locator('meta[name=description]').getAttribute('content')
  expect(titles.has(title)).toBe(false);expect(description).toBeTruthy();expect(descriptions.has(description!)).toBe(false);titles.add(title);descriptions.add(description!)
  expect(new URL((await page.locator('link[rel=canonical]').getAttribute('href'))!).href).toBe(new URL(path,'http://127.0.0.1:3101').href)
 }
})
test('crawler files expose public pages while utility pages stay out of search',async({page,request})=>{
 const robots=await request.get('/robots.txt');expect(robots.ok()).toBe(true);expect(await robots.text()).toContain('Sitemap: http://127.0.0.1:3101/sitemap.xml')
 const sitemap=await request.get('/sitemap.xml');const xml=await sitemap.text();expect(sitemap.ok()).toBe(true);expect(xml).toContain('/categories</loc>');expect(xml).not.toContain('/admin');expect(xml).not.toContain('/checkout');expect(xml).not.toContain('/orders')
 await page.goto('/login?redirectTo=%2Forders');await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','http://127.0.0.1:3101/login');await expect(page.locator('form')).toHaveAttribute('method','post')
})
test('runtime scripts use a unique nonce and unapproved inline scripts are blocked',async({page,request})=>{
 await page.route('**/login',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('</head>','<script>window.unapprovedAuditScript=true</script></head>')})})
 const response=await page.goto('/login');const policy=response!.headers()['content-security-policy']
 expect(policy).toContain("'strict-dynamic'");expect(policy.split(';').find(v=>v.trim().startsWith('script-src '))).not.toContain('unsafe-inline');expect(response!.headers()['x-powered-by']).toBeUndefined()
 const first=policy.match(/'nonce-([^']+)'/)![1];expect(first).toBeTruthy()
 expect(await page.locator('script[src]').first().evaluate(e=>(e as HTMLScriptElement).nonce)).toBe(first)
 expect(await page.evaluate(()=>Reflect.get(window,'unapprovedAuditScript'))).toBeUndefined()
 const next=await request.get('/login');expect(next.headers()['content-security-policy']).not.toContain("'nonce-"+first+"'")
})
test('the compiled stylesheet excludes selectors accidentally scanned from browser tests',async({page,request})=>{
 await page.goto('/')
 const hrefs=await page.locator('link[rel=stylesheet]').evaluateAll(links=>links.map(e=>(e as HTMLLinkElement).href))
 expect(hrefs.length).toBeGreaterThan(0)
 for(const href of hrefs){const css=await(await request.get(href)).text();expect(css).not.toContain(':visible:is()')}
})
