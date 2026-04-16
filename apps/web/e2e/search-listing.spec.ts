import { expect, test } from '@playwright/test';

test.describe('Search + listing detail', () => {
  test('search page loads with mock listings', async ({ page }) => {
    await page.goto('/search/');
    await expect(page.getByRole('heading', { name: /find a pro/i })).toBeVisible();
    // At least the first seed listing is visible
    await expect(page.getByText(/Johnson Realty Group/i)).toBeVisible();
  });

  test('listing detail renders and shows action buttons', async ({ page }) => {
    await page.goto('/listing/johnson-realty-group/');
    await expect(page.getByRole('heading', { name: /Johnson Realty Group/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Request a quote/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Refer this business/i })).toBeVisible();
  });
});
