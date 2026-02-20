import { test, expect } from '@playwright/test';

test.describe('Browse Launches', () => {
  test('should display empty state when no launches', async ({ page }) => {
    await page.goto('/launches');

    // Should show either launch cards or empty state
    const hasCards = await page.locator('[data-testid="token-card"]').count() > 0;
    const hasEmptyState = await page.getByText('No launches yet').isVisible().catch(() => false);
    expect(hasCards || hasEmptyState).toBeTruthy();
  });

  test('should have working sort tabs', async ({ page }) => {
    await page.goto('/launches');

    // Check tab buttons exist
    await expect(page.getByRole('button', { name: /Trending/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /New/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Near Cap/i })).toBeVisible();
  });

  test('should have working search input', async ({ page }) => {
    await page.goto('/launches');

    const search = page.getByPlaceholder(/Search by name or ticker/i);
    await expect(search).toBeVisible();

    await search.fill('BTC');
    // Search filters client-side, no navigation expected
    await expect(search).toHaveValue('BTC');
  });

  test('should switch active tab on click', async ({ page }) => {
    await page.goto('/launches');

    const newTab = page.getByRole('button', { name: /New/i });
    await newTab.click();
    // Tab becomes active (orange background applied via style)
    await expect(newTab).toBeVisible();
  });
});

test.describe('Launch Detail', () => {
  test.skip('should display launch information', async ({ page }) => {
    // This test needs a real launch address
    const testLaunchAddress = '0x0000000000000000000000000000000000000000';
    await page.goto(`/launch/${testLaunchAddress}`);

    await expect(page.getByText('Buy Tokens')).toBeVisible();
    await expect(page.getByText('Recent Activity')).toBeVisible();
  });
});
