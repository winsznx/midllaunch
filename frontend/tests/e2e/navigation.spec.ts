import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to all main pages', async ({ page }) => {
    await page.goto('/');

    // Check home page loads
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Bitcoin Token');

    // Navigate to Browse
    await page.goto('/launches');
    await expect(page).toHaveURL('/launches');
    await expect(page.getByRole('heading', { name: 'Token Launches' })).toBeVisible();

    // Navigate to Create
    await page.goto('/create');
    await expect(page).toHaveURL('/create');

    // Navigate to Portfolio
    await page.goto('/portfolio');
    await expect(page).toHaveURL('/portfolio');

    // Navigate to Transactions
    await page.goto('/transactions');
    await expect(page).toHaveURL('/transactions');
    await expect(page.getByRole('heading', { name: 'Transaction Center' })).toBeVisible();
  });

  test('should display recent launches section on home page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Recent Launches' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse Tokens/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Launch a Token/i })).toBeVisible();
  });
});
