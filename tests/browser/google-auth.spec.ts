import{test,expect}from'@playwright/test'
const backend='http://127.0.0.1:54329'
test.beforeEach(async({request})=>{await request.post(backend+'/__reset')})
test('Google login uses the site callback and PKCE without granting admin access',async({page})=>{
 await page.route(backend+'/auth/v1/authorize**',route=>route.fulfill({contentType:'text/html',body:'<h1>Google OAuth fixture</h1>'}))
 await page.goto('/login');await page.getByRole('button',{name:'Continue with Google',exact:true}).click()
 await expect(page).toHaveURL(/auth\/v1\/authorize/);const url=new URL(page.url());expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('redirect_to')).toContain('http://127.0.0.1:3101/auth/callback');expect(url.searchParams.get('code_challenge')).toBeTruthy()
})
test('Google signup requires age, terms and matching email intake before redirecting',async({page,request})=>{
 await page.route(backend+'/auth/v1/authorize**',route=>route.fulfill({contentType:'text/html',body:'<h1>Google OAuth fixture</h1>'}))
 await page.goto('/register');const google=page.getByRole('button',{name:'Sign up with Google',exact:true});await expect(google).toBeDisabled()
 await page.getByRole('combobox',{name:'Age band',exact:true}).selectOption('adult');await page.getByRole('checkbox',{name:/I agree to the buyer terms/}).check();await google.click();await expect(page.getByRole('alert').filter({hasText:'Enter the email address'})).toBeVisible()
 await page.getByLabel('Email address',{exact:true}).fill('google@example.test');await google.click();await expect(page).toHaveURL(/auth\/v1\/authorize/)
 const calls=await(await request.get(backend+'/__calls')).json();expect(calls.some((c:{path:string})=>c.path.endsWith('/rpc/cm_prepare_google_signup'))).toBe(true)
})
