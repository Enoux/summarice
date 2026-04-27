import { expect, test } from '@playwright/test';

/**
 * Full flow (login → upload → highlight) needs auth + storage; keep a light smoke
 * that verifies the app builds and the library route is reachable when unauthenticated
 * redirects to login.
 */
test('unauthenticated user is redirected from dashboard', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/login/);
});
