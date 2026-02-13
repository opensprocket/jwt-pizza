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

// Helper function to mock franchises with pagination
async function mockFranchisesPagination(page: Page) {
  await page.route('*/**/api/franchise*', async (route) => {
    const url = new URL(route.request().url());
    const pageParam = url.searchParams.get('page') || '0';
    const currentPage = parseInt(pageParam);

    const franchisesRes = {
      franchises: [
        {
          id: currentPage + 1,
          name: `Franchise ${currentPage + 1}`,
          admins: [{ id: 1, name: `Admin ${currentPage + 1}`, email: `admin${currentPage + 1}@test.com` }],
          stores: [{ id: 1, name: `Store ${currentPage + 1}`, totalRevenue: 100 }],
        },
      ],
      more: currentPage < 2,
    };
    await route.fulfill({ json: franchisesRes });
  });
}

// Helper function to mock franchises with filter support
async function mockFranchisesWithFilter(page: Page) {
  await page.route('*/**/api/franchise*', async (route) => {
    const url = new URL(route.request().url());
    const filter = url.searchParams.get('name') || '*';

    let franchises: { id: number; name: string; admins: { id: number; name: string; email: string; }[]; stores: { id: number; name: string; totalRevenue: number; }[]; }[] = [];
    if (filter === '*' || filter === '**') {
      franchises = [
        {
          id: 1,
          name: 'PizzaCorp',
          admins: [{ id: 1, name: 'Admin 1', email: 'admin1@test.com' }],
          stores: [{ id: 1, name: 'Store 1', totalRevenue: 100 }],
        },
        {
          id: 2,
          name: 'Burger Place',
          admins: [{ id: 2, name: 'Admin 2', email: 'admin2@test.com' }],
          stores: [{ id: 2, name: 'Store 2', totalRevenue: 200 }],
        },
      ];
    } else if (filter.includes('Pizza') || filter.includes('pizza')) {
      franchises = [
        {
          id: 1,
          name: 'PizzaCorp',
          admins: [{ id: 1, name: 'Admin 1', email: 'admin1@test.com' }],
          stores: [{ id: 1, name: 'Store 1', totalRevenue: 100 }],
        },
      ];
    }

    await route.fulfill({
      json: {
        franchises,
        more: false,
      },
    });
  });
}

// Helper function to mock empty franchises
async function mockEmptyFranchises(page: Page) {
  await page.route('*/**/api/franchise*', async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });
}

// Helper function to mock single franchise with one store
async function mockSingleFranchise(page: Page, franchiseName: string, storeName: string) {
  await page.route('*/**/api/franchise*', async (route) => {
    const franchisesRes = {
      franchises: [
        {
          id: 1,
          name: franchiseName,
          admins: [{ id: 1, name: 'Admin', email: 'admin@test.com' }],
          stores: [{ id: 1, name: storeName, totalRevenue: 100 }],
        },
      ],
      more: false,
    };
    await route.fulfill({ json: franchisesRes });
  });
}

