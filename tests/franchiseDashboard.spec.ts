import { test, expect } from 'playwright-test-coverage';
import { Page } from '@playwright/test';

// Mock login for a standard franchisee user
async function mockFranchiseeLogin(page: Page) {
  await page.route('*/**/api/auth', async (route) => {
    const loginReq = { email: 'f@jwt.com', password: 'franchisee' };
    const loginRes = {
      user: {
        id: 2,
        name: 'Franchisee User',
        email: 'f@jwt.com',
        roles: [
            { role: 'diner' },
            { objectId: 1, role: 'franchisee'}
        ],
      },
      token: 'franchisee-token',
    };
    
    if (route.request().method() === 'PUT') {
        expect(route.request().postDataJSON()).toMatchObject(loginReq);
        await route.fulfill({ json: loginRes });
    } else if (route.request().method() === 'DELETE') {
        await route.fulfill({ json: { message: 'logout successful' } });
    } else {
        await route.continue();
    }
  });
}

// Mock getting the specific franchise for the logged-in user
async function mockUserFranchise(page: Page) {
  await page.route('*/**/api/franchise/*', async (route) => {
    // Return an array containing the user's franchise
    const franchiseRes = [
        {
          id: 1,
          name: 'Pizza Pocket',
          admins: [{ id: 2, name: 'Franchisee User', email: 'f@jwt.com' }],
          stores: [
            { id: 1, name: 'SLC', totalRevenue: 5000 },
            { id: 2, name: 'Provo', totalRevenue: 2500 },
          ],
        }
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });
}

