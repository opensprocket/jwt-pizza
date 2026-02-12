import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';

/**
 * Utility function to log in and complete the ordering process up to payment
 * @param page - Playwright page object
 * @returns Promise that resolves when checkout button is ready
 */
async function loginAndOrder(page: Page) {
  // Mock login
  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'PUT') {
      const loginRes = {
        user: {
          id: 5,
          name: 'pizza diner',
          email: 'd@jwt.com',
          roles: [{ role: 'diner' }],
        },
        token: 'test-token',
      };
      await route.fulfill({ json: loginRes });
    } else {
      // GET request
      const userRes = {
        id: 3,
        name: 'd',
        email: 'd@jwt.com',
        roles: [{ role: 'diner' }],
      };
      await route.fulfill({ json: userRes });
    }
  });

  // Mock menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    await route.fulfill({ json: menuRes });
  });

  // Mock franchises
  await page.route('*/**/api/franchise?page=0&limit=20&name=*', async (route) => {
    const franchisesRes = {
      franchises: [
        {
          id: 1,
          name: 'PizzaCorp',
          stores: [{ id: 1, name: 'SLC', totalRevenue: 0.5 }],
        },
      ],
      more: false,
    };
    await route.fulfill({ json: franchisesRes });
  });

  // Login
  await page.goto('http://localhost:5173/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@test.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Login' }).click();

  // Navigate to menu
  await page.goto('http://localhost:5173/menu');

  // Select pizzas
  await page.getByText('Veggie').click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Selected pizzas: 1')).toBeVisible();

  await page.getByText('Pepperoni').click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();

  // Select store
  await page.locator('select').selectOption('1');

  // Verify checkout button is enabled
  const checkoutButton = page.getByRole('button', { name: 'Checkout' });
  await expect(checkoutButton).toBeEnabled();
}

