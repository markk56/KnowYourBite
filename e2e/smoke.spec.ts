import { test, expect } from '@playwright/test'

/**
 * M0 smoke: the app boots to the branded shell, the theme toggles, and the
 * language switches. (Full register → verify → login flow is added with the
 * auth milestone, M0.8.)
 */
test('boots to the branded shell, toggles theme, switches language', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Know Your Bite' })).toBeVisible()
  await expect(page.getByText('Welcome to Know Your Bite')).toBeVisible()

  // Theme toggles (English label is active on first load).
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  expect(isDark).toBe(!wasDark)

  // Language switches to Hungarian.
  await page.getByRole('button', { name: 'hu' }).click()
  await expect(page.getByText('Üdvözöl a Know Your Bite')).toBeVisible()
})
