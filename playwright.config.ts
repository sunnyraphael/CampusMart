import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:45000,
  use:{baseURL:'http://127.0.0.1:3101',channel:'chrome',headless:true,trace:'retain-on-failure'},
  webServer:[
    {command:'node tests/fixture-backend.mjs',url:'http://127.0.0.1:54329/health',reuseExistingServer:false,timeout:30000},
    {command:'node tests/start-app.mjs',url:'http://127.0.0.1:3101/login',reuseExistingServer:false,timeout:180000},
  ],
})
