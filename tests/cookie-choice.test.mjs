import {test} from 'node:test'
import assert from 'node:assert/strict'
import {COOKIE_CHOICE_MAX_AGE,makeCookieChoice,parseCookieChoice} from '../src/lib/privacy/cookies.ts'

const now=Date.parse('2026-11-01T12:00:00Z')
test('cookie choice stores only an essential-function choice, version and date',()=>{
  const value=makeCookieChoice(new Date(now))
  assert.deepEqual(parseCookieChoice(value,now),{version:1,essential:true,savedAt:'2026-11-01T12:00:00.000Z'})
  assert.deepEqual(Object.keys(JSON.parse(value)).sort(),['essential','savedAt','version'])
})
test('invalid, outdated, future-dated and expired cookie choices request a new choice',()=>{
  for(const value of [null,'{',JSON.stringify({version:0,essential:true,savedAt:new Date(now).toISOString()}),JSON.stringify({version:1,essential:false,savedAt:new Date(now).toISOString()}),JSON.stringify({version:1,essential:true,savedAt:'not a date'}),makeCookieChoice(new Date(now+120000)),makeCookieChoice(new Date(now-COOKIE_CHOICE_MAX_AGE))])assert.equal(parseCookieChoice(value,now),null)
  assert.notEqual(parseCookieChoice(makeCookieChoice(new Date(now-COOKIE_CHOICE_MAX_AGE+1)),now),null)
})
