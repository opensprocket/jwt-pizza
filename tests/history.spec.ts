import { test, expect } from 'playwright-test-coverage';

test('history page loads and displays content', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  await page.getByRole('link', { name: 'History' }).click();
  
  await expect(page.getByRole('heading', { name: 'Mama Rucci, my my' })).toBeVisible();
  
  await expect(page.getByText('It all started in Mama Ricci\'s kitchen')).toBeVisible();
  
  await expect(page.getByText('Pizza has a long and rich history')).toBeVisible();
  await expect(page.getByText('ancient Egyptians')).toBeVisible();
  
  const mamaImage = page.locator('img[src="mamaRicci.png"]');
  await expect(mamaImage).toBeVisible();
});