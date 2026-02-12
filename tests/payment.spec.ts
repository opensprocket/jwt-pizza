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

test('payment page displays order details', async ({ page }) => {
  
  await page.route('*/**/api/user/me', async (route) => {
    const userMeRes = {
      id: 5,
      name: 'pizza diner',
      email: 'd@jwt.com',
      roles: [{ role: 'diner' }],
      iat: 12345678
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: userMeRes });
  });
  
  await page.route('*/**/api/order', async (route) => {
    const orderReq = {
      items: [
        {
          menuId: 1,
          description: "Veggie",
          price: 0.0038
        },
        {
          menuId: 2,
          description: "Pepperoni",
          price: 0.0042
        }
      ],
      storeId: "1",
      franchiseId: 1 
    };
    
    const orderRes = {
      order: {
        items: [
            {
                menuId: 1,
                description: "Veggie",
                price: 0.0038
            },
            {
                menuId: 2,
                description: "Pepperoni",
                price: 0.0042
            }
        ],
        storeId: "1",
        franchiseId: 1,
        id: 1
    },
    "jwt": "test-jwt-value"
    };
    
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject(orderReq);
    await route.fulfill({ json: orderRes });
  });
  
  await loginAndOrder(page);

  // Click checkout to go to payment
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Verify we're on payment page
  await expect(page).toHaveURL(/.*payment/);

  // Verify heading
  await expect(page.getByRole('heading', { name: 'So worth it' })).toBeVisible();

  // Verify order summary message
  await expect(page.getByText(/Send me .*pizzas right now!/)).toBeVisible();

  // Verify Pay now button exists
  await expect(page.getByRole('button', { name: 'Pay now' })).toBeVisible();
  
  // Verify Cancel button exists
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

  // Verify pizza items are shown in table
  await expect(page.getByText('Veggie')).toBeVisible();
  await expect(page.getByText('Pepperoni')).toBeVisible();
});

test('payment page processes payment successfully', async ({ page }) => {
  // Use utility to login and create order
  await loginAndOrder(page);

  // Mock the order API
  await page.route('*/**/api/order', async (route) => {
    const orderRes = {
      order: {
        items: [
          { menuId: 1, description: 'Veggie', price: 0.0038 },
          { menuId: 2, description: 'Pepperoni', price: 0.0042 },
        ],
        storeId: 1,
        franchiseId: 1,
        id: 123,
      },
      jwt: 'fake-jwt-token',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  // Click checkout to go to payment
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Wait for payment page to load
  await expect(page).toHaveURL(/.*payment/);

  // Click Pay now
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Should navigate to delivery page
  await expect(page).toHaveURL(/.*delivery/);
});

test('payment page cancel returns to menu', async ({ page }) => {
  // Use utility to login and create order
  await loginAndOrder(page);

  // Click checkout to go to payment
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Wait for payment page to load
  await expect(page).toHaveURL(/.*payment/);

  // Click Cancel
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Should navigate back to menu with order state preserved
  await expect(page).toHaveURL(/.*menu/);
  
  // Verify the order state is preserved (2 pizzas selected)
  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();
});

