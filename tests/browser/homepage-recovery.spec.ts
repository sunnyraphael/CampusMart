import {test,expect} from '@playwright/test'

test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:54329/__reset')})

test('signed-out homepage recovers from a temporary listing outage',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products',times:1,status:503}})
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'Buy and sell with students on your campus.'})).toBeVisible()
  await expect(page.locator('.hm-grid .pc')).toHaveCount(1)
  await expect(page.getByRole('heading',{name:'Listings are temporarily unavailable'})).toHaveCount(0)
})

test('homepage stays usable on a persistent listing failure and retry restores the cards',async({page,request})=>{
  await request.post('http://127.0.0.1:54329/__fail',{data:{table:'products'}})
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'Buy and sell with students on your campus.'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Listings are temporarily unavailable'})).toBeVisible()
  await expect(page.getByRole('link',{name:'Browse listings',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'This page could not load'})).toHaveCount(0)
  await request.post('http://127.0.0.1:54329/__recover',{data:{table:'products'}})
  await page.getByRole('button',{name:'Retry listings'}).click()
  await expect(page.locator('.hm-grid .pc')).toHaveCount(1)
  await expect(page.getByRole('heading',{name:'Listings are temporarily unavailable'})).toHaveCount(0)
})
