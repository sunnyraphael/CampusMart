import {defineConfig} from '@playwright/test'
import base from './playwright.config'
process.env.CAMPUSMART_PAYSTACK_FIXTURE='1'
export default defineConfig({...base,testMatch:'paystack.spec.ts',timeout:90000})
