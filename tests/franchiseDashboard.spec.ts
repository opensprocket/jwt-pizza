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

// Mock empty franchise list (for new users)
async function mockNoFranchise(page: Page) {
  await page.route('*/**/api/franchise/*', async (route) => {
    await route.fulfill({ json: [] });
  });
}

// Mock store creation
async function mockCreateStore(page: Page) {
  await page.route('*/**/api/franchise/*/store', async (route) => {
    const storeReq = { name: 'Orem' };
    const storeRes = {
      id: 3,
      name: 'Orem',
      totalRevenue: 0,
    };
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject(storeReq);
    await route.fulfill({ json: storeRes });
  });
}

test('franchise dashboard displays information for franchisee', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Set up mocks
  await mockFranchiseeLogin(page);
  await mockUserFranchise(page);

  // Perform login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();

  // Navigate to Franchise Dashboard
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  // Verify Franchise Name in header
  await expect(page.getByRole('heading', { name: 'Pizza Pocket' })).toBeVisible();

  // Verify Franchise Description
  await expect(page.getByText('Everything you need to run an JWT Pizza franchise')).toBeVisible();

  // Verify Stores table content
  await expect(page.getByText('SLC')).toBeVisible();
  await expect(page.getByText('5,000 ₿')).toBeVisible();
  await expect(page.getByText('Provo')).toBeVisible();
  await expect(page.getByText('2,500 ₿')).toBeVisible();

  // Verify actions
  await expect(page.getByRole('button', { name: 'Create store' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
});

test('franchise dashboard displays marketing page for users without franchise', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Set up mocks
  await mockFranchiseeLogin(page);
  await mockNoFranchise(page);

  // Perform login
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();

  // Navigate to Franchise Dashboard
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  // Verify Marketing Content
  await expect(page.getByRole('heading', { name: 'So you want a piece of the pie?' })).toBeVisible();
  await expect(page.getByText('If you are already a franchisee, please ')).toBeVisible();
  await expect(page.getByText('Call now')).toBeVisible();
  
  // Verify Create Store button is NOT present
  await expect(page.getByRole('button', { name: 'Create store' })).not.toBeVisible();
});

test('create store flow works correctly', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Set up mocks
  await mockFranchiseeLogin(page);
  await mockUserFranchise(page);
  await mockCreateStore(page);

  // Login and Navigate
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  // Click Create Store
  await page.getByRole('button', { name: 'Create store' }).click();

  // Verify URL
  await expect(page).toHaveURL(/.*franchise-dashboard\/create-store/);

  // Fill Form
  await page.getByPlaceholder('store name').fill('Orem');

  // Submit
  await page.getByRole('button', { name: 'Create' }).click();

  // Verify navigation back to dashboard
  await expect(page).toHaveURL(/.*franchise-dashboard/);
});

test('cancel create store navigates back', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await mockFranchiseeLogin(page);
  await mockUserFranchise(page);

  // Login/Nav
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  // Enter Create Store
  await page.getByRole('button', { name: 'Create store' }).click();

  // Click Cancel
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Check URL
  await expect(page).toHaveURL(/.*franchise-dashboard/);
});

test('close store navigation works', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await mockFranchiseeLogin(page);
  await mockUserFranchise(page);

  // Login/Nav
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();

  // Click Close on the first store
  // The table row contains the 'Close' button
  const closeButtons = page.getByRole('button', { name: 'Close' });
  await closeButtons.first().click();

  // Verify navigation to close-store page
  await expect(page).toHaveURL(/.*franchise-dashboard\/close-store/);
});

