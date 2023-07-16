import { test, expect } from '@playwright/test';

// Измените savedSession в соответствии с вашим кодом
const savedSession = '1AgAWdmVudXMud2ViLnRlbGVncmFtLm9yZwG7OpGNNguU42Td8oVu+2OSJXF3KbjkQZL+Fmy/81VPIgEdOMl9OPw8sKTkbp065E354gcYL7gceXSfj55kfdzEOlaq2ffuP6juzyiNLV2UlnnK7ZG/2B7Uj6q2D2Y3aCS3MA1KyD32ASwia+bq+F/BRdGeIHz480vGTqsh4fyVVsKbEigP1jbWa+Uq+3hF7GfKNaG4/jf5Z+KcNuZrlEFzU0LqFkZYopz/QQoP1Cn4S9Sj/TjpUWvQ+YuTmXK9qgku5nKQYiP/cVYJmFXgZs0aaO8qJxo/L8CjNe34EuadktdjDn3CfHbL+Zph8T4JhZejuW8abAyrfR/W33F4QgN19A==';

const localTesting = false;

async function loginInApp(page, savedSession) {
  if (localTesting) {
    await page.goto('http://127.0.0.1:5500/views/login.html');
  } else {
    await page.goto('https://robotiaga.github.io/views/login.html');
  }
  await page.evaluate((session) => {
    localStorage.setItem('savedSession', session);
  }, savedSession);
}

test('open modal', async ({ page }) => {
  await loginInApp(page, savedSession);
  if (localTesting) {
    await page.goto('http://127.0.0.1:5500/views/photomanager.html');
  } else {
    await page.goto('https://robotiaga.github.io/views/photomanager.html');
  }
  await page.waitForSelector('#file-list div');
  // Ждем изменения background-image элемента
  await page.waitForFunction(() => {
    const element = document.querySelector('#file-list div');
    const result = getComputedStyle(element).backgroundImage !== 'url("data:image/jpeg;base64,")';
    console.log(getComputedStyle(element).backgroundImage);
    return result;
  });

  await page.locator('#file-list div').first().click();
  await page.screenshot({ path: 'screenshots/screenshot2.png' });
  const modal = await page.$('#modal');
  const isModalVisible = await modal.isVisible();
  expect(isModalVisible).toBe(true);
});

// test('close modal', async ({ page }) => {

// });