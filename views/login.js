const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

// Инициализация переменных
var phoneNumber; // Номер телефона пользователя
var codeNumber; // Код, введенный пользователем
var result; // Результат выполнения операции
const apiId = 26855747; // Идентификатор API вашего приложения Telegram
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff"; // Хэш API вашего приложения Telegram
const savedSession = localStorage.getItem("savedSession"); // Получение сохраненной сессии из локального хранилища
const stringSession = new StringSession(savedSession || ""); // Создание объекта StringSession

// Получение элементов DOM
var loginButton = document.getElementById('login_button');
loginButton.addEventListener('click', showCodeInput);
var codeButton = document.getElementById('code_button');
codeButton.addEventListener('click', LoginTelegram);
var qrCodeButton = document.getElementById('login_with_qr');
qrCodeButton.addEventListener('click', LoginWithQRcode);

// Создание клиента Telegram
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5, // Количество попыток подключения
});

// Асинхронная функция для входа с помощью QR-кода
async function LoginWithQRcode(){
  document.getElementById("loginTextContainer").style.display = "none"; // Скрытие контейнера с текстом входа
  document.getElementById("qrCodeContainer").style.display = "block"; // Отображение контейнера с QR-кодом

  await client.connect(); // Установка соединения с серверами Telegram

  // Вход с помощью QR-кода
  const user = await client.signInUserWithQrCode(
        { apiHash, apiId },
        {
            onError: async (p1) => {
                console.log("error", p1);
                return true;
            },
            qrCode: async ({ token }) => {              
                const qr = `tg://login?token=${Base64.fromUint8Array(token, true)}`;
                new QRious({
                  element: document.getElementById("qrcode"), 
                  value: qr,
                  size: 200,
                  background: '#212121',
                  foreground: 'white',
                });
            },
        }
    );

    const sessionString = client.session.save(); // Сохранение сессии клиента
    localStorage.setItem("savedSession", sessionString); // Сохранение сессии в локальном хранилище
    await client.sendMessage("me", { message: "you are logged in TeleDisk!" }); // Отправка сообщения пользователю
    window.location.href = "photomanager.html"; // Перенаправление на страницу photomanager.html
}

// Асинхронная функция для входа в Telegram
async function LoginTelegram() {
  codeNumber = document.getElementById("login_code").value; // Получение введенного пользователем кода
  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phoneNumber, // Номер телефона пользователя
      phoneCodeHash: result.phoneCodeHash, // Хэш кода подтверждения
      phoneCode: codeNumber, // Код, введенный пользователем
    })
  );

  const sessionString = client.session.save(); // Сохранение сессии клиента
  localStorage.setItem("savedSession", sessionString); // Сохранение сессии в локальном хранилище
  await client.sendMessage("me", { message: "you are logged in TeleDisk!" }); // Отправка сообщения пользователю
  window.location.href = "photomanager.html"; // Перенаправление на страницу photomanager.html
};

// Асинхронная функция для отображения поля ввода кода
async function showCodeInput() {
  document.getElementById("loginTextContainer").style.display = "none"; // Скрытие контейнера с текстом входа
  document.getElementById("codeTextContainer").style.display = "block"; // Отображение контейнера с полем ввода кода
  phoneNumber = document.getElementById("login_login").value; // Получение введенного пользователем номера телефона

  await client.connect(); // Установка соединения с серверами Telegram

  result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber: phoneNumber, // Номер телефона пользователя
      apiId: apiId, // Идентификатор API вашего приложения Telegram
      apiHash: apiHash, // Хэш API вашего приложения Telegram
      settings: new Api.CodeSettings({
        allowFlashcall: true, // Разрешение Flash-звонков
        currentNumber: true,
        allowAppHash: true,
        allowMissedCall: true,
        logoutTokens: [Buffer.from("arbitrary data here")],
      }),
    })
  );

  console.log(result.phoneCodeHash); // Вывод хэша кода подтверждения в консоль
};

// Асинхронная функция инициализации
async function init() {
  if (savedSession) {
    await client.connect(); // Установка соединения с серверами Telegram

    try {
      await client.getMe(); // Получение информации о текущем пользователе
      window.location.href = "photomanager.html"; // Перенаправление на страницу photomanager.html
    } catch (error) {
      localStorage.removeItem("savedSession"); // Удаление сохраненной сессии из локального хранилища
    }
  }
}

init(); // Вызов функции инициализации
