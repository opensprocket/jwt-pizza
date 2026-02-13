import { test, expect } from 'playwright-test-coverage';
import { Page } from '@playwright/test';

// Helper function to mock admin login
async function mockAdminLogin(page: Page) {
  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'a@jwt.com', password: 'admin' };
    const loginRes = {
      user: {
        id: 1,
        name: 'Admin User',
        email: 'a@jwt.com',
        roles: [{ role: 'admin' }],
      },
      token: 'admin-token',
    };
    expect(route.request().method()).toBe('PUT');
    expect(route.request().postDataJSON()).toMatchObject(loginReq);
    await route.fulfill({ json: loginRes });
  });
}

// Helper function to mock franchises list
async function mockFranchises(page: Page) {
  await page.route('*/**/api/franchise*', async (route) => {
    const franchisesRes = {
      franchises: [
        {
          id: 1,
          name: 'PizzaCorp',
          admins: [{ id: 1, name: 'Franchise Admin 1', email: 'admin1@pizza.com' }],
          stores: [
            { id: 1, name: 'SLC', totalRevenue: 1000 },
            { id: 2, name: 'Provo', totalRevenue: 750 },
          ],
        },
        {
          id: 2,
          name: 'Pizza Paradise',
          admins: [{ id: 2, name: 'Franchise Admin 2', email: 'admin2@pizza.com' }],
          stores: [{ id: 3, name: 'Orem', totalRevenue: 500 }],
        },
      ],
      more: false,
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchisesRes });
  });
}

