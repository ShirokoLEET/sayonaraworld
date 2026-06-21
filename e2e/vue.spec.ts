import { test, expect } from '@playwright/test'

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main.wired-shell')).toBeVisible()
  await expect(page.getByText('SAYONARA_MONITOR.EXE')).toBeVisible()
})
