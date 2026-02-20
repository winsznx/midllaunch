import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  test('should fetch and display launches from API', async ({ page }) => {
    // Intercept API call
    await page.route('**/api/launches*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          launches: [],
          total: 0
        })
      });
    });

    await page.goto('/launches');

    // Should handle empty response
    await expect(page.getByText(/no launches/i)).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Simulate API error
    await page.route('**/api/launches*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    await page.goto('/launches');

    // Should show error message
    await expect(page.getByText(/error/i)).toBeVisible();
  });

  test.skip('should display real-time WebSocket updates', async ({ page }) => {
    // TODO: Test WebSocket real-time updates
    // 1. Connect to WebSocket
    // 2. Simulate event broadcast
    // 3. Verify UI updates
    // 4. Test reconnection logic
  });
});
