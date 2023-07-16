const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

// Initialize variables
let phoneNumber; // User's phone number
let codeNumber; // Code entered by the user
let result; // Operation result
const apiId = 26855747; // Telegram application API ID
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff"; // Telegram application API hash
const savedSession = localStorage.getItem("savedSession"); // Retrieve saved session from local storage
const stringSession = new StringSession(savedSession || ""); // Create StringSession object
const loginTextContainer = document.getElementById("loginTextContainer");
const codeTextContainer = document.getElementById("codeTextContainer");
const qrCodeContainer = document.getElementById("qrCodeContainer");
const backToSelection = document.querySelectorAll('.back_selection');
// Get DOM elements
const loginButton = document.getElementById("login_button");
loginButton.addEventListener("click", showCodeInput);
const codeButton = document.getElementById("code_button");
codeButton.addEventListener("click", loginTelegram);
const qrCodeButton = document.getElementById("login_with_qr");
qrCodeButton.addEventListener("click", loginWithQRCode);


backToSelection.forEach(input => input.addEventListener("click", () => {
  loginTextContainer.style.display = "flex";
  qrCodeContainer.style.display = "none";
  codeTextContainer.style.display = "none";
}));

// Create Telegram client
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Asynchronous function for logging in with QR code
async function loginWithQRCode() {
  loginTextContainer.style.display = "none";
  codeTextContainer.style.display = "none";
  qrCodeContainer.style.display = "flex";
  await client.connect();

  // Login with QR code
  const user = await client.signInUserWithQrCode(
    { apiHash, apiId },
    {
      onError: async (error) => {
        console.log("Error", error);
        return true;
      },
      qrCode: async ({ token }) => {
        const qr = `tg://login?token=${Base64.fromUint8Array(token, true)}`;
        new QRious({
          element: document.getElementById("qrcode"),
          value: qr,
          size: 200,
          background: "#212121",
          foreground: "white",
        });
      },
    }
  );

  const sessionString = client.session.save();
  localStorage.setItem("savedSession", sessionString);
  await client.sendMessage("me", { message: "You are logged in TeleDisk!" });
  window.location.href = "photomanager.html";
}

// Asynchronous function for logging in to Telegram
async function loginTelegram() {
  codeNumber = document.getElementById("login_code").value;
  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      phoneCode: codeNumber,
    })
  );

  const sessionString = client.session.save();
  localStorage.setItem("savedSession", sessionString);
  await client.sendMessage("me", { message: "You are logged in TeleDisk!" });
  window.location.href = "photomanager.html";
}

// Asynchronous function to show code input field
async function showCodeInput() {
  loginTextContainer.style.display = "none";
  codeTextContainer.style.display = "flex";
  phoneNumber = document.getElementById("login_login").value;

  await client.connect();

  result = await client.invoke(
    new Api.auth.SendCode({
      phoneNumber: phoneNumber,
      apiId: apiId,
      apiHash: apiHash,
      settings: new Api.CodeSettings({
        allowFlashcall: true,
        currentNumber: true,
        allowAppHash: true,
        allowMissedCall: true,
        logoutTokens: [Buffer.from("arbitrary data here")],
      }),
    })
  );

  console.log(result.phoneCodeHash);
}
if (localStorage.getItem("cachedSession")) {
  const userList = document.getElementById('logged_accounts');
  // Создаем новый div элемент
  var loggedButton = document.createElement("button");
  loggedButton.classList.add("choose_logged_account");
  loggedButton.classList.add("button_b");
  loggedButton.innerHTML = "Select account";

  // Находим элемент с классом "centered" и идентификатором "queue"
  var queueElement = document.getElementById("queue");
  
  var cachedSession = JSON.parse(localStorage.getItem('cachedSession'));
  for (var key in cachedSession) {
    var button = document.createElement('button');
    button.classList.add('button_b', 'choose-user');
    button.textContent = key;
    // console.log(key);
    queueElement.appendChild(loggedButton);
    button.addEventListener('click', function(event) {
      // console.log(cachedSession[event.target.textContent]);
      localStorage.setItem('savedSession', cachedSession[event.target.textContent]);
      delete cachedSession[event.target.textContent];
      localStorage.setItem('cachedSession', JSON.stringify(cachedSession));
      window.location.href = "photomanager.html";
    });
  
    // // Добавление кнопки в начало user_list
    userList.appendChild(button);
  }
  // Вставляем новый div после элемента "queue"
  loggedButton.addEventListener("click", async () => {
    if (userList.style.transform === "scale(0)") {
      userList.style.transform = 'scale(1)';
      loggedButton.style.display = 'none';
    } else {
      userList.style.transform = 'scale(0)';
    }
  }
)};
// Asynchronous initialization function
async function init() {
  if (savedSession) {
    await client.connect();

    try {
      await client.getMe();
      window.location.href = "photomanager.html";
    } catch (error) {
      localStorage.removeItem("savedSession");
    }
  }
}

init();
