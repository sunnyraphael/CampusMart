import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirect,profileSchema,messageSchema,supportSchema } from '../src/lib/buyer/validation.ts'
import { listingImages } from '../src/lib/buyer/images.ts'
import { buildProductsHref,cleanSearch,parseSort } from '../src/lib/products-query.ts'
import { calcServiceFee } from '../src/lib/fees.ts'

test('login destinations reject external URLs, control characters, backslashes and auth loops',()=>{
  for(const value of ['https://evil.example','//evil.example','/\\evil.example','/login','/register','/auth/callback','/\n/evil.example']) assert.equal(safeRedirect(value),'/')
  assert.equal(safeRedirect('/products?q=books&page=2'),'/products?q=books&page=2')
  assert.equal(safeRedirect('/reset-password'),'/reset-password')
})
test('buyer inputs enforce message, phone and support limits',()=>{
  assert.equal(profileSchema.safeParse({full_name:'Sunny',phone:'08012345678'}).success,true)
  assert.equal(profileSchema.safeParse({full_name:'Sunny',phone:'incorrect'}).success,false)
  assert.equal(messageSchema.safeParse('   ').success,false)
  assert.equal(messageSchema.safeParse('a'.repeat(2001)).success,false)
  assert.equal(supportSchema.safeParse({subject:'Order issue',body:'x'.repeat(20),order_id:'someone-else'}).success,false)
})
test('saved search links preserve filters safely',()=>{
  assert.equal(buildProductsHref({q:'book & pen',category:'books',sort:'price_asc'}),'/products?category=books&q=book+%26+pen&sort=price_asc')
  assert.equal(parseSort('malicious'),'newest')
  assert.equal(cleanSearch('  %book_*  '),'book')
})
test('images tolerate missing and legacy values without using unsafe URLs',()=>{
  assert.deepEqual(listingImages(null),[])
  assert.deepEqual(listingImages('https://example.com/photo.jpg'),['https://example.com/photo.jpg'])
  assert.deepEqual(listingImages('["https://example.com/a.jpg"]'),['https://example.com/a.jpg'])
  assert.deepEqual(listingImages(['javascript:alert(1)',false,'/photo.jpg']),['/photo.jpg'])
})
test('service fee threshold excludes delivery and is waived at exactly 20000',()=>{
  assert.equal(calcServiceFee(10000),200)
  assert.equal(calcServiceFee(19999),400)
  assert.equal(calcServiceFee(20000),0)
})
