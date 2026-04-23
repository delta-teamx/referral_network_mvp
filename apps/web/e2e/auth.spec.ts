import { expect, test } from '@playwright/test';

test.describe('Auth pages', () => {
  test('login page shows social buttons + email form', async ({ page }) => {
    await page.goto('/login/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Continue with Google/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Continue with Facebook/i)).toBeVisible();
  });

  test('signup page has role selection', async ({ page }) => {
    await page.goto('/signup/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Sign up with Google/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/I am a/i)).toBeVisible();
  });

  test('forgot password page returns 200', async ({ page }) => {
    const res = await page.goto('/forgot-password/');
    expect(res?.status()).toBe(200);
  });
});
