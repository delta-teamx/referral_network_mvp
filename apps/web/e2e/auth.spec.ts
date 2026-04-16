import { expect, test } from '@playwright/test';

test.describe('Auth pages', () => {
  test('login page shows Google button + email form', async ({ page }) => {
    await page.goto('/login/');
    await expect(page.getByText(/Continue with Google/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('signup page has role selection + Google button', async ({ page }) => {
    await page.goto('/signup/');
    await expect(page.getByText(/Sign up with Google/i)).toBeVisible();
    await expect(page.getByText(/I am a/i)).toBeVisible();
    await expect(page.getByRole('radio', { name: /Consumer/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Business owner/i })).toBeVisible();
  });
});
