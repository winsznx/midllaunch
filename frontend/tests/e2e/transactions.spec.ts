import { test, expect } from '@playwright/test';

test.describe('Transaction Center', () => {
  test('should display page heading', async ({ page }) => {
    await page.goto('/transactions');

    await expect(page.getByRole('heading', { name: 'Transaction Center' })).toBeVisible();
  });

  test('should display transaction lifecycle explainer', async ({ page }) => {
    await page.goto('/transactions');

    // Lifecycle section heading
    await expect(page.getByText('Transaction Lifecycle (Section 9.9)')).toBeVisible();

    // All four lifecycle step labels
    await expect(page.getByText('Signed')).toBeVisible();
    await expect(page.getByText('BTC Confirmed')).toBeVisible();
    await expect(page.getByText('Midl Executed')).toBeVisible();
    await expect(page.getByText('Finalized')).toBeVisible();
  });

  test('should prompt wallet connection when not connected', async ({ page }) => {
    await page.goto('/transactions');

    await expect(page.getByText('Connect your wallet to see your transactions')).toBeVisible();
  });

  test.skip('should track transaction through lifecycle', async ({ page }) => {
    // TODO: This test requires actual transactions
    // Once transaction tracking is implemented:
    // 1. Create transaction
    // 2. Verify SIGNED state
    // 3. Wait for BTC_INCLUDED
    // 4. Wait for MIDL_EXECUTED
    // 5. Wait for FINALIZED
    // 6. Verify explorer links work
  });
});
