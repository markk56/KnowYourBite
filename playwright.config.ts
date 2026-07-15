import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 5000)
const baseURL = `http://localhost:${PORT}`

// E2E smoke tests (IMPLEMENTATION-ROADMAP.md M0.9). Playwright boots the app
// itself so the same command works locally, in CI, and on Replit.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
