import { test, expect } from 'playwright-test-coverage';

test('registration successful', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('Bob');
  await page.getByRole('textbox', { name: 'Full name' }).press('Tab');
  await page.getByRole('textbox', { name: 'Email address' }).fill('bob@bob.com');
  await page.getByRole('textbox', { name: 'Email address' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('hunter2');
  await page.getByRole('button', { name: 'Register' }).click();
  
  await page.getByRole('link', { name: 'B', exact: true }).click();
  await page.getByText('Bob', { exact: true }).click();
  await page.getByText('bob@bob.com').click();
});