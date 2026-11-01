import { defineConfig } from '@playwright/test'
import { COOKIE_CHOICE_KEY,makeCookieChoice } from './src/lib/privacy/cookies'
export default defineConfig({
  testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:45000,
  use:{storageState:{cookies:[],origins:[{origin:'http://127.0.0.1:3101',localStorage:[{name:COOKIE_CHOICE_KEY,value:makeCookieChoice(new Date())}]}]},baseURL:'http://127.0.0.1:3101',channel:'chrome',headless:true,trace:'retain-on-failure'},
  webServer:[
    {command:'node tests/fixture-backend.mjs',url:'http://127.0.0.1:54329/health',reuseExistingServer:false,timeout:30000},
    {command:'node tests/start-app.mjs',url:'http://127.0.0.1:3101/login',reuseExistingServer:false,timeout:180000},
  ],
})
