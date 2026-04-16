import { expect, test } from '@playwright/test';

test.describe('Public homepage', () => {
  test('renders hero + life-event grid + demo banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Demo banner only shows in demo mode (which is forced in Netlify build)
    await expect(page.getByText(/frontend-only preview/i)).toBeVisible();
    // At least a few life-event tiles (use roles to avoid copy duplication)
    await expect(page.getByRole('link', { name: /Buying a House/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Getting Married/i }).first()).toBeVisible();
  });

  test('CTA to search navigates', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /browse the full directory/i }).first();
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL(/\/search\/?/);
    }
  });
});
