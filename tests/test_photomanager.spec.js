const { test, expect } = require('@playwright/test');

const savedSession ='1AgAWdmVudXMud2ViLnRlbGVncmFtLm9yZwG7huGkZUZLioys+ElTXnVro5gQethH/Zau2fVtxSZBrwY7nQV6fZpZc75381XWyK7k6b+Il2jf+x4cB+5r9UvoNcG0hE8yDAtgraCCA8OAfADsmANBBRbD4tgYDGxd+6w156zYpsqbsCMl/yLh0iy9yrdfkxNt4U5UvYndCLSEpgMpJbXdMwSNVIAe/+vai+nc3FDBMv0XLdUxMC0p0bBljD+G/WmQRs8Hwb+PU6Gda6cLrgZRmmS+MynRhhkFLMEGIjf9IN7IQTY/Sy9p/ePCuibYBN9+QGmDoLJ6qE4xjsF8mjuvHIx7kLtyL1z3/4Vcsqb9sgrWAawz+yhymt+QbA=='

test('should display file list', async ({ page }) => {
  // Загружаем HTML-страницу с кодом
  await page.goto('https://robotiaga.github.io/views/photomanager.html');
  await page.evaluate(`localStorage.setItem("savedSession", '${savedSession}');`);
  // Ожидаем, пока список файлов загрузится и станет видимым
  await page.screenshot({path: 'screenshots/example.png'});
  await page.waitForSelector('#file-list', { state: 'visible' });
  await page.screenshot({path: 'screenshots/example1.png'});
  // Проверяем, что список файлов отображается
  const fileList = await page.$('#file-list');
  expect(fileList).not.toBeNull();
});

test('should open modal with image', async ({ page }) => {
  // Загружаем HTML-страницу с кодом
  await page.goto('file:///path/to/your/html/filemanager.html');

  // Ожидаем, пока список файлов загрузится и станет видимым
  await page.waitForSelector('#file-list', { state: 'visible' });

  // Кликаем на первый файл из списка
  await page.click('#file-list li:first-child');

  // Ожидаем, пока модальное окно откроется
  await page.waitForSelector('#modal', { state: 'visible' });

  // Проверяем, что модальное окно с изображением отображается
  const modalImage = await page.$('#modal-image');
  expect(modalImage).not.toBeNull();
});

test('should navigate to the next image in modal', async ({ page }) => {
  // Загружаем HTML-страницу с кодом
  await page.goto('file:///path/to/your/html/filemanager.html');

  // Ожидаем, пока список файлов загрузится и станет видимым
  await page.waitForSelector('#file-list', { state: 'visible' });

  // Кликаем на первый файл из списка
  await page.click('#file-list li:first-child');

  // Ожидаем, пока модальное окно откроется
  await page.waitForSelector('#modal', { state: 'visible' });

  // Кликаем на кнопку "Next"
  await page.click('.next');

  // Ожидаем, пока изображение в модальном окне обновится
  await page.waitForSelector('#modal-image[src="path/to/next/image.jpg"]', { state: 'visible' });
});


