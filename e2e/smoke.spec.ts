import { expect, test } from '@playwright/test';

const clientResponse = {
  data: {
    id: 'test.repo',
    attributes: {
      name: 'Test Repo',
      hasPassword: true
    },
    relationships: {
      prefixes: {
        data: [{ id: '10.1234' }]
      }
    }
  }
};

const listResponse = {
  data: [
    {
      id: '10.1234/abc',
      type: 'dois',
      attributes: {
        doi: '10.1234/abc',
        prefix: '10.1234',
        titles: [{ title: 'Sample DOI' }],
        publicationYear: 2024,
        state: 'findable'
      }
    }
  ],
  links: { next: null }
};

test('smoke flow', async ({ page }) => {
  await page.route('**/clients/**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(clientResponse) });
  });

  await page.route('**/dois**', async (route) => {
    if (route.request().method() === 'GET' && route.request().url().includes('/dois?')) {
      await route.fulfill({ status: 200, body: JSON.stringify(listResponse) });
      return;
    }
    if (route.request().method() === 'GET' && route.request().url().includes('/dois/10.1234/abc')) {
      await route.fulfill({ status: 200, body: JSON.stringify({ data: listResponse.data[0] }) });
      return;
    }
    await route.fulfill({ status: 200, body: JSON.stringify({}) });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'DataCite Unified Console' })).toBeVisible();

  await page.getByLabel('Repository ID').fill('test.repo');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Logged in as Test Repo')).toBeVisible();

  await page.getByRole('button', { name: 'Fetch DOIs' }).click();
  await expect(page.getByText('Sample DOI')).toBeVisible();

  await page.getByRole('button', { name: 'JSON' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit JSON Metadata' })).toBeVisible();

  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('Updated 10.1234/abc.')).toBeVisible();
});
