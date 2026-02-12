import { test, expect } from 'playwright-test-coverage';

test('about page loads and displays content', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  
  await page.getByRole('link', { name: 'About' }).click();
  
  await expect(page.getByRole('heading', { name: 'The secret sauce' })).toBeVisible();
  
  await expect(page.getByText('At JWT Pizza, our amazing employees')).toBeVisible();
  
  await expect(page.getByRole('heading', { name: 'Our employees' })).toBeVisible();
  
  const employeeImages = page.locator('img[alt="Employee stock photo"]');
  await expect(employeeImages).toHaveCount(4);
  
  await page.getByRole('img', { name: 'Employee stock photo' }).first().click();
  await page.getByRole('img', { name: 'Employee stock photo' }).nth(1).click();
  await page.getByRole('img', { name: 'Employee stock photo' }).nth(2).click();
  await page.getByRole('img', { name: 'Employee stock photo' }).nth(3).click();
});