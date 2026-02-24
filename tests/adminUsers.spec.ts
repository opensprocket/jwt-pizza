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

// Matches GET /api/franchise?page=0&limit=3&name=*
const franchisesPageResponse = {
    franchises: [
        {
            id: 21,
            name: 'Multi Admin Franchise 107r93',
            admins: [
                { id: 133, name: 'Franchisee User', email: 'franchisee-vq7xg43hk2@test.com' },
                { id: 135, name: 'Regular User',    email: 'regular-birao6ws3j@test.com'    },
            ],
            stores: [],
        },
        {
            id: 102,
            name: 'Multi Admin Franchise 226ekm',
            admins: [
                { id: 284, name: 'Franchisee User', email: 'franchisee-fa6bd31wkn@test.com' },
                { id: 286, name: 'Regular User',    email: 'regular-2peh51k2bx@test.com'    },
            ],
            stores: [],
        },
        {
            id: 138,
            name: 'Multi Admin Franchise 38zcgb',
            admins: [
                { id: 366, name: 'Franchisee User', email: 'franchisee-a32yx8bot1@test.com' },
                { id: 368, name: 'Regular User',    email: 'regular-dsaaymxcfz@test.com'    },
            ],
            stores: [],
        },
    ],
    more: true,
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

test('filters the user list based on search input', async ({ page }) => {
    // The specific filtered response mock provided
    const filteredUsersResponse = {
        "users": [
            { "id": 5, "name": "Test User", "email": "test-u1k0o1dr2y@test.com", "roles": [{ "role": "diner" }, { "role": "admin" }] },
            { "id": 21, "name": "Test User", "email": "test-7r0zk0k5od@test.com", "roles": [{ "role": "diner" }, { "role": "admin" }] },
            { "id": 23, "name": "Test Diner", "email": "jcqwgs96am@test.com", "roles": [{ "role": "diner" }] },
            { "id": 25, "name": "Test Admin", "email": "gs8zhw8gst@test.com", "roles": [{ "role": "diner" }, { "role": "admin" }] },
            { "id": 26, "name": "test user", "email": "oa5fgxy4bn@test.com", "roles": [{ "role": "diner" }] }
        ],
        "more": false
    };

    // Mock PUT /api/auth (login)
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

    // Mock the user API endpoints
    await page.route('*/**/api/user**', async (route) => {
        const req = route.request();
        const url = req.url();
        
        // Intercept the specific search query
        if (req.method() === 'GET' && url.includes('name=Test')) {
            await route.fulfill({ json: filteredUsersResponse });
        } 
        // Initial load for all regular users (Alice, Bob, etc.)
        else if (req.method() === 'GET' && !url.includes('/me')) {
            await route.fulfill({ json: usersPageResponse });
        } 
        // Admin authorization check
        else if (url.includes('/me')) {
            await route.fulfill({ json: adminUser });
        } else {
            await route.continue();
        }
    });

    // Mock franchises to prevent test from hanging on unrelated requests
    await page.route('*/**/api/franchise**', async (route) => {
        await route.fulfill({ json: franchisesPageResponse });
    });

    // Login and navigate
    await page.goto('/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    // Verify initial users are visible (from usersPageResponse)
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeVisible();

    // Apply the filter
    await page.getByPlaceholder('Filter users').fill('Test');
    await page.getByRole('button', { name: 'Search' }).click();

    // Verify the list updates to show the new mock data
    await expect(page.getByRole('cell', { name: 'Test Diner' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Test Admin' })).toBeVisible();
    
    // Because there are multiple "Test User"s, verifying by unique email is safer
    await expect(page.getByRole('cell', { name: 'test-7r0zk0k5od@test.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'oa5fgxy4bn@test.com' })).toBeVisible();

    // Verify the original users are correctly hidden
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Bob Jones' })).toBeHidden();
});

test('deletes a user and updates the table', async ({ page }) => {
    // Create a mutable copy of the users for this specific test
    let currentUsers = [...regularUsers];

    // Mock PUT /api/auth (login)
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

    // Mock the user API endpoints
    await page.route('*/**/api/user**', async (route) => {
        const req = route.request();
        
        if (req.method() === 'DELETE') {
            // Extract the user ID from the end of the URL
            const urlParts = req.url().split('/');
            const idToDelete = parseInt(urlParts[urlParts.length - 1], 10);
            
            // Remove the user from our mock database
            currentUsers = currentUsers.filter(u => u.id !== idToDelete);
            
            // Return a 204 No Content success response
            await route.fulfill({ status: 204 });
        } else if (req.method() === 'GET' && !req.url().includes('/me')) {
            // Return the dynamically updated list
            await route.fulfill({ json: { users: currentUsers, more: false } });
        } else if (req.url().includes('/me')) {
            await route.fulfill({ json: adminUser });
        } else {
            await route.continue();
        }
    });

    // Mock franchises to prevent unhandled route errors
    await page.route('*/**/api/franchise**', async (route) => {
        await route.fulfill({ json: franchisesPageResponse });
    });

    // Login and navigate — use relative '/' instead of hardcoded localhost URL
    await page.goto('/');
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();

    // Verify Alice is visible initially
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeVisible();

    // Locate Alice's row and click her delete button
    const aliceRow = page.locator('tr', { hasText: 'Alice Smith' });
    await aliceRow.getByTestId('delete-user').click();

    // Verify Alice is removed, but Bob is still there
    await expect(page.getByRole('cell', { name: 'Alice Smith' })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Bob Jones' })).toBeVisible();
});