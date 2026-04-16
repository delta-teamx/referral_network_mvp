import { expect, test } from '@playwright/test';

test.describe('Pricing + network surfaces', () => {
  test('pricing page shows 3 plans with upgrade CTAs', async ({ page }) => {
    await page.goto('/pricing/');
    await expect(page.getByText(/Free/i).first()).toBeVisible();
    await expect(page.getByText(/Pro/i).first()).toBeVisible();
    await expect(page.getByText(/Premium/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Upgrade to Pro/i })).toBeVisible();
  });

  test('groups page lists seed groups', async ({ page }) => {
    await page.goto('/groups/');
    await expect(page.getByRole('heading', { name: /find a networking group/i })).toBeVisible();
    await expect(page.getByText(/STL Realtors/i)).toBeVisible();
  });

  test('invite page renders with a token query', async ({ page }) => {
    await page.goto('/invite/?token=demo-token-1');
    await expect(page.getByText(/invited you to their network/i)).toBeVisible();
  });
});
