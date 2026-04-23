import { expect, test } from '@playwright/test';

test.describe('Auth-gated pages', () => {
  test('search page gates non-logged-in users', async ({ page }) => {
    await page.goto('/search/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Members only/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('listing detail gates non-logged-in users', async ({ page }) => {
    await page.goto('/listing/johnson-realty-group/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Members only/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
