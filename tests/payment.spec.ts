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
    const userRes = {
      user: { id: 5, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] },
      token: 'test-token',
    };
    await route.fulfill({ json: userRes });
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({
      json: { id: 5, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] },
    });
  });

  // Mock menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    await route.fulfill({ json: menuRes });
  });

  await page.route('*/**/api/franchise?page=0&limit=20&name=*', async (route) => {
    await route.fulfill({
      json: {
        franchises: [{ id: 1, name: 'PizzaCorp', stores: [{ id: 1, name: 'SLC' }] }],
        more: false,
      },
    });
  });

  await page.goto('http://localhost:5173/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('http://localhost:5173/menu');
  await page.getByText('Veggie').click();
  await page.getByText('Pepperoni').click();
  await page.locator('select').selectOption('1');
}

test('payment page processes payment successfully', async ({ page }) => {
  await loginAndOrder(page);

  // Mock successful order creation
  await page.route('*/**/api/order', async (route) => {
    await route.fulfill({
      json: { order: { items: [], storeId: 1, franchiseId: 1, id: 123 }, jwt: 'fake-jwt' },
    });
  });

  await page.getByRole('button', { name: 'Checkout' }).click();
  
  // No need to log in again here! 
  await expect(page).toHaveURL(/.*payment/);
  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page).toHaveURL(/.*delivery/);
});

test('payment page cancel returns to menu', async ({ page }) => {
  await loginAndOrder(page);

  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page).toHaveURL(/.*payment/);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/.*menu/);
  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();
});

test('payment page displays correct total for order', async ({ page }) => {
  await loginAndOrder(page);

  await page.getByRole('button', { name: 'Checkout' }).click();
  
  // This will now pass because api/user/me is mocked in loginAndOrder
  await expect(page).toHaveURL('http://localhost:5173/payment');
  await expect(page.getByText('Veggie')).toBeVisible();
  await expect(page.getByText('Pepperoni')).toBeVisible();
  
  // Check total: 0.0038 + 0.0042 = 0.008
  await expect(page.getByText('0.008 ₿')).toBeVisible();
});