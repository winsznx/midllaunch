import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test('should display wallet connect button in header', async ({ page }) => {
    await page.goto('/');

    // Header has a connect wallet button
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
  });

  test('should require wallet for portfolio page', async ({ page }) => {
    await page.goto('/portfolio');

    await expect(page.getByRole('heading', { name: 'Connect Wallet' })).toBeVisible();
    await expect(page.getByText('Connect your Bitcoin wallet to view your portfolio')).toBeVisible();
  });

  test('should require wallet for create page', async ({ page }) => {
    await page.goto('/create');

    await expect(page.getByRole('heading', { name: 'Connect Wallet' })).toBeVisible();
    await expect(page.getByText('Connect your Bitcoin wallet to create a token launch')).toBeVisible();
  });

  // TODO: Add actual wallet connection tests once wallets are available in test environment
  // - Mock wallet connection
  // - Test wallet disconnection
  // - Test wallet switching
});
