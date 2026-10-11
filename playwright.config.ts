import { defineConfig, devices } from '@playwright/test'
const port = process.env.ORPHEUS_WEB_TEST_PORT ?? '4173'
const base = process.env.ORPHEUS_WEB_BASE_PATH ?? '/'
const url = `http://127.0.0.1:${port}${base}`

export default defineConfig({
  testDir: './e2e',
  outputDir: process.env.INTEGRATION_URL ? `test-results/backend-${process.env.INTEGRATION_SAML ? 'saml' : 'anonymous'}` : `test-results/browser-${base === '/' ? 'root' : 'prefix'}`,
  fullyParallel: true,
  testMatch: process.env.INTEGRATION_URL ? '**/backend.spec.ts' : base === '/' ? /(?:auth|dashboard)\.spec\.ts/ : '**/base-path.spec.ts',
  workers: process.env.CI ? 2 : 4,
  use: { baseURL: process.env.INTEGRATION_URL ?? url, trace: 'retain-on-failure', ignoreHTTPSErrors: !!process.env.INTEGRATION_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.INTEGRATION_URL ? undefined : {
    command: `npm run dev -- --port ${port} --strictPort`,
    url,
    reuseExistingServer: !process.env.CI,
  },
})
