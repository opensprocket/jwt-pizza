import {test, expect } from 'playwright-test-coverage';

const adminUser = {
    id: 99,
    name: 'Admin User',
    email: 'admin@jwt.com',
    roles: [{ role: 'admin'}],
};

const regularUsers = [
    { id: 1, name: 'Alice Smith', email: 'alice@jwt.com', roles: [{ role: 'diner' }] },
    { id: 2, name: 'Bob Jones',   email: 'bob@jwt.com',   roles: [{ role: 'diner' }] },
    { id: 3, name: 'Carol White', email: 'carol@jwt.com', roles: [{ role: 'franchisee' }] },
];

// Matches GET /api/user?page=0&limit=10&name=*
const usersPageResponse = {
    users: regularUsers,
    more: false,
};

test('admin can view user list', async ({ page }) => {
    // Mock PUT /api/auth  (login)
    await page.route('*/**/api/auth', async (route) => {
        const req = route.request();
        if (req.method() === 'PUT') {
            await route.fulfill({
                json: { user: adminUser, token: 'adminToken' },
            });
        } else {
            await route.continue();
        }
    });

    // Mock GET /api/user  (list + /me)
    await page.route('*/**/api/user**', async (route) => {
        const req = route.request();
        if (req.method() !== 'GET') { await route.continue(); return; }

        if (req.url().includes('/me')) {
            await route.fulfill({ json: adminUser });
        } else {
            // Handles /api/user?page=0&limit=10&name=* (and similar paginated calls)
            await route.fulfill({ json: usersPageResponse });
        }
    });

    // Mock GET /api/franchise  (handles /api/franchise?page=0&limit=3&name=* and similar)
    await page.route('*/**/api/franchise**', async (route) => {
        await route.fulfill({ json: franchisesPageResponse });
    });

    // Log in as admin
    await page.goto('/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('admin@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();

    // Navigate to admin dashboard
    await page.getByRole('link', { name: 'Admin' }).click();

    // Users section should be visible
    await expect(page.getByRole('main')).toContainText('Users');

    // All three users should appear
    await expect(page.getByRole('main')).toContainText('Alice Smith');
    await expect(page.getByRole('main')).toContainText('alice@jwt.com');
    await expect(page.getByRole('main')).toContainText('Bob Jones');
    await expect(page.getByRole('main')).toContainText('Carol White');
});