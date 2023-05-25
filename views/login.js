const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

var phoneNumber;
var codeNumber;
var result;
const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");

var loginButton = document.getElementById('login_button');
loginButton.addEventListener('click', showCodeInput);
var codeButton = document.getElementById('code_button');
codeButton.addEventListener('click', LoginTelegram);

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

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

async function showCodeInput() {
  document.getElementById("loginTextContainer").style.display = "none";
  document.getElementById("codeTextContainer").style.display = "block";
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
};

async function LoginTelegram() {
  codeNumber = document.getElementById("login_code").value;
  await client.invoke(
    new Api.auth.SignIn({
      phoneNumber: phoneNumber,
      phoneCodeHash: result.phoneCodeHash,
      phoneCode: codeNumber,
    })
  );
  console.log(phoneNumber);
  console.log(codeNumber);
  const sessionString = client.session.save();
  localStorage.setItem("savedSession", sessionString);
  console.log(sessionString);
  await client.sendMessage("me", { message: "Hello!" });
  window.location.href = "filemanager.html";
};
