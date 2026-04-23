import { expect, test } from '@playwright/test';

test.describe('Public homepage', () => {
  test('renders hero with brand messaging', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Stop relying on/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows stats bar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Active members/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('has Join CTA button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText(/Join the network/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('footer is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/All rights reserved/i)).toBeVisible();
  });
});
