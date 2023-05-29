import { test, expect } from '@playwright/test';


test('should enter phone number and show code input', async ({ page }) => {
  await page.goto('https://robotiaga.github.io/views/login.html');
  await page.fill('#login_login', '1234567890');
  await page.click('#login_button');
  await page.waitForSelector('#codeTextContainer', { state: 'visible' });
});

