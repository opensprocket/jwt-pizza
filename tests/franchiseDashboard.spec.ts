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

