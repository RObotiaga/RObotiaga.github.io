const { test, expect } = require('@playwright/test');

//change savedSession on your code
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

test('should display file list', async ({ page }) => {
  await loginInApp(page, savedSession);
  if (localTesting) {
    await page.goto('http://127.0.0.1:5500/views/photomanager.html');
  } else {
    await page.goto('https://robotiaga.github.io/views/photomanager.html');
  }
  await page.waitForSelector('.image-tile');
  // Проверяем, что список файлов отображается
  const fileList = await page.$('#file-list');
  expect(fileList).not.toBeNull();
  // Проверяем наличие фонового изображения для первого image-tile
  const firstImageTile = await page.$('.image-tile');
  const hasBackgroundImage = await page.evaluate((imageTile) => {
    const backgroundImage = window.getComputedStyle(imageTile).getPropertyValue('background-image');
    console.log(backgroundImage);
    return backgroundImage !== 'url("data:image/jpeg;base64,")';
  }, firstImageTile);
  expect(hasBackgroundImage).toBe(false);
  await page.screenshot({ path: 'screenshots/screenshot1.png' });
});

