import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readdir,access} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadingVariant} from '../src/lib/loading-routes.ts'

test('detail pages get their own layout instead of inheriting list skeletons',()=>{
  for(const [path,kind] of [['/products','catalog'],['/products/abc','product'],['/orders','orders'],['/orders/abc','order-detail'],['/messages/abc','thread'],['/vendor/listings/new','listing-form'],['/vendor/listings/abc/edit','listing-form'],['/vendor/orders/abc/slip','packing-slip'],['/vendor/settings','vendor-settings'],['/vendor/messages/abc','vendor-thread'],['/admin/disputes','admin-disputes'],['/login','login'],['/products/?sort=top','catalog']])assert.equal(loadingVariant(path),kind,path)
})
test('every page route has an explicit loading boundary',async()=>{
  async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});for(const entry of entries){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name==='page.tsx')await assert.doesNotReject(access(join(dir,'loading.tsx')),`Missing loader for ${path}`)}}
  await walk(fileURLToPath(new URL('../src/app',import.meta.url)))
})
