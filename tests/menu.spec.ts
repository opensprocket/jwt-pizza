import { test, expect } from 'playwright-test-coverage';

test('menu page loads and displays pizzas', async ({ page }) => {
  // Mock the menu API
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
      { id: 3, title: 'Margarita', image: 'pizza3.png', price: 0.0035, description: 'Essential classic' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Mock the franchises API
  await page.route('*/**/api/franchise', async (route) => {
    const franchisesRes = {
      franchises: [
        {
          id: 1,
          name: 'PizzaCorp',
          stores: [
            { id: 1, name: 'SLC', totalRevenue: 0.5 },
            { id: 2, name: 'Provo', totalRevenue: 0.3 },
          ],
        },
      ],
      more: false,
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchisesRes });
  });

  await page.goto('http://localhost:5173/menu');

  // Verify menu heading
  await expect(page.getByRole('heading', { name: 'Awesome is a click away' })).toBeVisible();

  // Verify instruction text
  await expect(page.getByText('Pick your store and pizzas from below')).toBeVisible();

  // Verify store selector is present
  const storeSelect = page.locator('select');
  await expect(storeSelect).toBeVisible();
  await expect(storeSelect).toContainText('choose store');

  // Verify pizzas are displayed
  await expect(page.getByText('Veggie')).toBeVisible();
  await expect(page.getByText('Pepperoni')).toBeVisible();
  await expect(page.getByText('Margarita')).toBeVisible();

  // Verify initial state message
  await expect(page.getByText('What are you waiting for? Pick a store and then add some pizzas!')).toBeVisible();

  // Verify checkout button is disabled initially
  const checkoutButton = page.getByRole('button', { name: 'Checkout' });
  await expect(checkoutButton).toBeDisabled();
});

test('menu page allows selecting store and pizzas', async ({ page }) => {
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    await route.fulfill({ json: menuRes });
  });

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

  await page.goto('http://localhost:5173/menu');


  await page.getByRole('link', { name: 'Image Description Veggie A' })

  await page.getByText('Veggie').click();

  await page.waitForTimeout(500);

  await expect(page.getByText('Selected pizzas: 1')).toBeVisible();

  await page.getByText('Pepperoni').click();

  await page.waitForTimeout(500);

  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();

  await page.locator('select').selectOption('1');
  
  const checkoutButton = page.getByRole('button', { name: 'Checkout' });
  await expect(checkoutButton).toBeEnabled();
});

test('menu page checkout navigates to payment', async ({ page }) => {

  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
    ];
    await route.fulfill({ json: menuRes });
  });

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

  await page.goto('http://localhost:5173/menu');

  await page.locator('select').selectOption('1');

  await page.getByText('Veggie').click();

  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Checkout' }).click();

  await expect(page).toHaveURL(/.*payment/);
});