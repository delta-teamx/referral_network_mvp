import { expect, test } from '@playwright/test';

test.describe('Public pages', () => {
  test('pricing page shows 3 tier cards', async ({ page }) => {
    await page.goto('/pricing/');
    await expect(page.getByText(/Start free/i).first()).toBeVisible();
    await expect(page.getByText(/\$49/i).first()).toBeVisible();
    await expect(page.getByText(/\$149/i).first()).toBeVisible();
  });

  test('events page loads', async ({ page }) => {
    await page.goto('/events/');
    await expect(page.getByText(/networking events/i).first()).toBeVisible();
  });

  test('groups page loads', async ({ page }) => {
    await page.goto('/groups/');
    await expect(page.getByText(/networking group/i).first()).toBeVisible();
  });

  test('how-it-works page loads', async ({ page }) => {
    await page.goto('/how-it-works/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
