import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tasks')
})


test.describe('Collaborative feature', () => {

  test('Collaborative filter button is visible in sidebar', async ({ page }) => {
    await expect(page.getByRole('button', { name: '👥 Collaborative' })).toBeVisible()
  })

  test('clicking Collaborative shows Collaborative Tasks heading', async ({ page }) => {
    const buttons = page.getByRole('button')
    const collabBtn = buttons.filter({ hasText: 'Collaborative' }).first()
    await collabBtn.click()
    await expect(page.getByRole('heading', { name: 'Collaborative Tasks' })).toBeVisible()
  })

  test('Collaborative filter only shows tasks with collaborators', async ({ page }) => {
    const buttons = page.getByRole('button')
    const collabBtn = buttons.filter({ hasText: 'Collaborative' }).first()
    await collabBtn.click()

    const rows = page.locator('tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td')
      const collabCell = cells.nth(3)
      await expect(collabCell).toHaveText('Yes')
    }
  })

  test('task added with collaborators appears in Collaborative filter', async ({ page }) => {
    await page.getByText('Add Task').click()
    await page.getByPlaceholder('Name').fill('Collab E2E Task')
    await page.getByPlaceholder('Due Date (YYYY-MM-DD)').fill('2026-12-01')
    await page.getByPlaceholder('In Collaboration With (comma separated)').fill('Alice, Bob')
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    await buttons.nth(count - 1).click()

    const allButtons = page.getByRole('button')
    const collabBtn = allButtons.filter({ hasText: 'Collaborative' }).first()
    await collabBtn.click()
    await expect(page.getByText('Collab E2E Task')).toBeVisible()
  })

  test('task without collaborators does not appear in Collaborative filter', async ({ page }) => {
    const buttons = page.getByRole('button')
    const collabBtn = buttons.filter({ hasText: 'Collaborative' }).first()
    await collabBtn.click()

    await expect(page.getByText('task 5')).not.toBeVisible()
  })

})


test.describe('Search feature', () => {

  test('search bar is visible on the tasks page', async ({ page }) => {
    await expect(page.getByPlaceholder('Search tasks...')).toBeVisible()
  })

  test('typing in search filters tasks by name', async ({ page }) => {
    await page.getByPlaceholder('Search tasks...').fill('task 1')
    await expect(page.getByText('task 1')).toBeVisible()
    await expect(page.getByText('task 3')).not.toBeVisible()
  })

  test('search is case insensitive', async ({ page }) => {
    await page.getByPlaceholder('Search tasks...').fill('TASK 1')
    await expect(page.getByText('task 1')).toBeVisible()
  })

  test('search with no match shows empty message', async ({ page }) => {
    await page.getByPlaceholder('Search tasks...').fill('xyznonexistent')
    await expect(page.getByText(/No tasks matching/)).toBeVisible()
  })

  test('clearing search with X button shows all tasks again', async ({ page }) => {
    await page.getByPlaceholder('Search tasks...').fill('task 1')
    await expect(page.getByText('task 3')).not.toBeVisible()
    await page.getByText('✕').click()
    await expect(page.getByText('task 1')).toBeVisible()
    await expect(page.getByText('task 3')).toBeVisible()
  })

  test('search resets when switching filter tabs', async ({ page }) => {
    await page.getByPlaceholder('Search tasks...').fill('task 1')
    await page.getByText('Completed').click()
    const searchInput = page.getByPlaceholder('Search tasks...')
    await expect(searchInput).toHaveValue('')
  })

})


test.describe('Priority feature', () => {

  test('Priority column header is visible in the table', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /priority/i })).toBeVisible()
  })

  test('tasks show priority badges', async ({ page }) => {
    const badge = page.locator('span').filter({ hasText: /^(High|Medium|Low)$/ }).first()
    await expect(badge).toBeVisible()
  })

  test('task 1 shows High priority badge', async ({ page }) => {
    const row = page.locator('tr').filter({ hasText: 'task 1' })
    await expect(row.getByText('High')).toBeVisible()
  })

  test('priority dropdown is available when adding a task', async ({ page }) => {
    await page.getByText('Add Task').click()
    await expect(page.locator('select[name="priority"]')).toBeVisible()
  })

  test('priority dropdown has High, Medium and Low options', async ({ page }) => {
    await page.getByText('Add Task').click()
    const select = page.locator('select[name="priority"]')
    await expect(select.locator('option[value="High"]')).toHaveCount(1)
    await expect(select.locator('option[value="Medium"]')).toHaveCount(1)
    await expect(select.locator('option[value="Low"]')).toHaveCount(1)
  })

  test('newly added task shows correct priority in the table', async ({ page }) => {
    await page.getByText('Add Task').click()
    await page.getByPlaceholder('Name').fill('High Priority Task')
    await page.getByPlaceholder('Due Date (YYYY-MM-DD)').fill('2026-11-01')
    await page.locator('select[name="priority"]').selectOption('High')

    const buttons = page.getByRole('button')
    const count = await buttons.count()
    await buttons.nth(count - 1).click()

    const row = page.locator('tr').filter({ hasText: 'High Priority Task' })
    await expect(row.getByText('High', { exact: true })).toBeVisible()
  })

  test('priority badge is visible in detail view', async ({ page }) => {
    await page.getByText('task 1').click()
    await expect(page.locator('span').filter({ hasText: /^(High|Medium|Low)$/ }).first()).toBeVisible()
  })

  test('priority can be edited in edit mode', async ({ page }) => {
    await page.getByText('task 1').click()
    await page.getByRole('button', { name: /edit task/i }).click()
    const select = page.locator('select[name="priority"]')
    await select.selectOption('Low')
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    await buttons.nth(count - 1).click()
    await expect(page.locator('span').filter({ hasText: 'Low' }).first()).toBeVisible()
  })

})