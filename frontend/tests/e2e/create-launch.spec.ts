import { test, expect } from '@playwright/test';

test.describe('Create Launch Flow', () => {
  test.skip('should complete full create launch flow', async ({ page }) => {
    // TODO: This test requires:
    // 1. Midl SDK integration
    // 2. Wallet mocking/connection
    // 3. Test Bitcoin transactions

    await page.goto('/create');

    await page.fill('input[placeholder="Pepe Bitcoin"]', 'Test Token');
    await page.fill('input[placeholder="PEPBTC"]', 'TEST');

    await page.click('button:has-text("Deploy Token Launch")');

    // Should show transaction progress
    // Should redirect to launch detail page after creation
  });

  test('should enforce required fields', async ({ page }) => {
    await page.goto('/create');

    const nameInput = page.locator('input[placeholder="Pepe Bitcoin"]');
    const symbolInput = page.locator('input[placeholder="PEPBTC"]');

    await expect(nameInput).toHaveAttribute('required', '');
    await expect(symbolInput).toHaveAttribute('required', '');
  });

  test('should have submit button disabled when required fields are empty', async ({ page }) => {
    await page.goto('/create');

    const submitButton = page.getByRole('button', { name: /Deploy Token Launch/i });
    await expect(submitButton).toBeDisabled();
  });

  test('should show live preview sidebar', async ({ page }) => {
    await page.goto('/create');

    // Preview updates as user types
    const nameInput = page.locator('input[placeholder="Pepe Bitcoin"]');
    await nameInput.fill('My Token');

    await expect(page.getByText('My Token')).toBeVisible();
  });
});
