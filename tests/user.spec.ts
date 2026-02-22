import { test, expect } from 'playwright-test-coverage';

test('updateUser', async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  
  await page.route('*/**/api/auth', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const registerReq = { name: 'pizza diner', email: email, password: 'diner' };
      const registerRes = {
        user: {
          id: 1,
          name: 'pizza diner',
          email: email,
          roles: [{ role: 'diner' }],
        },
        token: 'registerToken123',
      };
      expect(request.postDataJSON()).toMatchObject(registerReq);
      await route.fulfill({ json: registerRes });
    } else if (request.method() === 'PUT') {
      const loginReq = { email: email, password: 'diner' };
      const loginRes = {
        user: {
          id: 1,
          name: 'pizza diner',
          email: email,
          roles: [{ role: 'diner' }],
        },
        token: 'loginToken456',
      };
      expect(request.postDataJSON()).toMatchObject(loginReq);
      await route.fulfill({ json: loginRes });
    }
  });

  await page.route('*/**/api/user/*', async (route) => {
    const updateUserRes = {
      user: {
        id: 1,
        name: 'pizza diner',
        email: email,
        roles: [{ role: 'diner' }],
      },
      token: 'updatedToken789',
    };
    await route.fulfill({ json: updateUserRes });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');
  
  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');
});