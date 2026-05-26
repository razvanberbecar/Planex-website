import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'https://localhost:3443',
    headless: true,
    ignoreHTTPSErrors: true,
  },
})