import { test, expect } from '@playwright/test'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function loginAs(page: any, username: string, password: string) {
  await page.goto('/')
  await page.fill('input[placeholder="Enter username"]', username)
  await page.fill('input[placeholder="Enter password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 15000 })
}

// ─── 1. Login page ────────────────────────────────────────────────────────────

test('login page loads correctly', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Chantabbai')
  await expect(page.locator('input[placeholder="Enter username"]')).toBeVisible()
  await expect(page.locator('input[placeholder="Enter password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toContainText('Sign In')
})

test('wrong password shows error', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Enter username"]', 'pavan')
  await page.fill('input[placeholder="Enter password"]', 'wrongpass')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Invalid username or password')).toBeVisible()
})

// ─── 2. Owner login ───────────────────────────────────────────────────────────

test('owner (pavan) can login and sees nav tabs', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  // Use nav buttons specifically
  await expect(page.getByRole('button', { name: /Upload/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Files/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Analytics/ }).first()).toBeVisible()
  // Username visible
  await expect(page.locator('text=pavan').first()).toBeVisible()
})

test('owner default view is Upload', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await expect(page.getByRole('heading', { name: 'Upload Files' })).toBeVisible()
})

// ─── 3. Viewer login ──────────────────────────────────────────────────────────

test('viewer can login — no Upload tab, lands on Files', async ({ page }) => {
  await loginAs(page, 'viewer', 'view.001')
  // Upload button should NOT exist for viewer
  await expect(page.getByRole('button', { name: /📎 Upload/ })).not.toBeVisible()
  // Files and Analytics should exist
  await expect(page.getByRole('button', { name: /Files/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Analytics/ }).first()).toBeVisible()
})

// ─── 4. Navigation ────────────────────────────────────────────────────────────

test('owner can switch between all tabs', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')

  // Go to Files
  await page.getByRole('button', { name: /Files/ }).first().click()
  await expect(page.locator('text=Storage Used')).toBeVisible({ timeout: 10000 })

  // Go to Analytics
  await page.getByRole('button', { name: /Analytics/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Monthly Analytics' }).first()).toBeVisible({ timeout: 10000 })

  // Back to Upload
  await page.getByRole('button', { name: /Upload/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Upload Files' })).toBeVisible()
})

// ─── 5. Files view ────────────────────────────────────────────────────────────

test('files view shows stats bar', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: /Files/ }).first().click()
  await expect(page.locator('text=Storage Used')).toBeVisible({ timeout: 10000 })
})

test('view mode switcher toggles views', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: /Files/ }).first().click()
  await page.waitForTimeout(2000)
  // View mode buttons have title attributes matching ViewMode enum values
  await expect(page.getByTitle('Grid')).toBeVisible()
  await expect(page.getByTitle('List')).toBeVisible()
  await expect(page.getByTitle('Timeline')).toBeVisible()
  await page.getByTitle('List').click()
  await page.getByTitle('Grid').click()
  await page.getByTitle('Timeline').click()
})

// ─── 6. Analytics ─────────────────────────────────────────────────────────────

test('analytics tab loads correctly', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: /Analytics/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Monthly Analytics' }).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /Monthly Files/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Upload Excel/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Set Budgets/ }).first()).toBeVisible()
})

test('month selector is visible', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: /Analytics/ }).first().click()
  await page.waitForTimeout(2000)
  await expect(page.locator('select').first()).toBeVisible()
})

// ─── 7. Sign out ──────────────────────────────────────────────────────────────

test('sign out returns to login page', async ({ page }) => {
  await loginAs(page, 'pavan', 'pavan.9000')
  await page.getByRole('button', { name: 'Sign Out' }).first().click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('input[placeholder="Enter username"]')).toBeVisible()
})

// ─── 8. Mobile viewport ───────────────────────────────────────────────────────

test('mobile: login page renders correctly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})

test('mobile: all nav buttons visible after login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAs(page, 'pavan', 'pavan.9000')
  await expect(page.getByRole('button', { name: /Upload/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Files/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Analytics/ }).first()).toBeVisible()
})
