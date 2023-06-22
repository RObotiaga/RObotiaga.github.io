const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { CustomFile } = require("telegram/client/uploads");
const { message } = require("telegram/client");
const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
const selectedFiles = [];
let folderContent = [];
let navigationStack = [];
const imageCache = new Map();

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

let prevScrollPos = window.pageYOffset;
const header = document.getElementById("header");
let me;

function makeVisibleAnimation(element, timeOfAnimation) {
  element.classList.add("is-visible");
  element.classList.remove("is-hidden");
}
function makeHiddenAnimation(element, timeOfAnimation) {
  element.classList.add("is-hidden");
  window.setTimeout(function () {
    element.classList.remove("is-visible");
  }, timeOfAnimation);
}
window.addEventListener("scroll", function () {
  const currentScrollPos = window.pageYOffset;

  if (prevScrollPos > currentScrollPos) {
    header.classList.remove("hide");
  } else {
    header.classList.add("hide");
  }

  prevScrollPos = currentScrollPos;
});


function cacheImage(fileId, imageUrl) {
  imageCache.set(fileId, imageUrl);
}

function getCachedImage(fileId) {
  return imageCache.get(fileId);
}

function isImageCached(fileId) {
  return imageCache.has(fileId);
}

async function setName() {
  me = await client.getMe();
  const userName = document.getElementById('user-name');
  userName.textContent = `${me.firstName}`;
}

async function getFilesFromMeDialog() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId);
  const photos = messages
    .filter(
      (message) =>
      (message.media instanceof Api.MessageMediaPhoto ||
        message.message?.startsWith("#EmptyFolder "))
    )
    .map((message) => ({
      message: message,
      photo: message.media && message.media.photo,
      caption: message.message,
      date: message.date,
      messageId: message.id,
    }));

  const videos = messages
    .filter((message) => message.media instanceof Api.MessageMediaDocument && message.media.document.mimeType === "video/mp4")
    .map((message) => ({
      message: message,
      video: message.media.document,
      caption: message.message,
      date: message.date,
      messageId: message.id,
      photo: message.document.thumbs,
    }))
    .sort((a, b) => b.date - a.date);
  const files = [...photos, ...videos].sort((a, b) => b.date - a.date);
  return files;
}


function buildFileStructure(files) {
  const root = {
    name: "root",
    type: "folder",
    content: {},
  };
  for (const file of files) {
    const path = file.caption.split("/");
    if (path[0].includes("#EmptyFolder")) {
      path[0] = path[0].replace("#EmptyFolder ", '');
    }
    let currentFolder = root;
    for (const folderName of path.slice(0, -1)) {
      if (!currentFolder.content[folderName]) {
        currentFolder.content[folderName] = {
          name: folderName,
          type: "folder",
          content: {},
        };
      }
      currentFolder = currentFolder.content[folderName];
    }
    const fileName = path[path.length - 1];
    if (!currentFolder.content[fileName]) {
      currentFolder.content[fileName] = [];
    }
    currentFolder.content[fileName].push({
      name: fileName,
      type: "file",
      file: file.photo,
      messageId: file.messageId,
      message: file.message,
      video: file.video,
    });

  }
  return root;
}

const userPhoto = document.getElementById("user-photo");
const fileList = document.getElementById("file-list");
const currentFolderName = document.getElementById("currentfolder");
const fileInput = document.getElementById("file-input");
const modal = document.getElementById("modal");
const modalv = document.getElementById("modalv");
const modalImage = document.getElementById("modal-image");
const modalVideo = document.getElementById("modal-video");
const closeBtn = document.getElementById("close");
const closevBtn = document.getElementById("closev");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");
const moveButton = document.getElementById("move-button");
const acceptMoveButton = document.getElementById("accept-move-button");
const copyButton = document.getElementById("copy-button");
const acceptCopyButton = document.getElementById("accept-copy-button");
const sideBar = document.getElementById('side-bar');
const blackScreen = document.getElementById('black-screen');
const userChoose = document.getElementById('user-choose');
const userList = document.getElementById('user_list');

let sideBarOpen = false;
userPhoto.addEventListener("click", async () => {
  sideBarOpen = true;
  blackScreen.style.visibility = 'visible';
  blackScreen.style.background = 'rgb(0 0 0 / 30%)';
  sideBar.style.left = '0';
});

let userListOpen = false;
userChoose.addEventListener("click", async () => {
  if (userListOpen === false) {
    userChoose.style.transform = 'rotate(180deg)';
    userList.style.height = '8vw';
    userListOpen = true;
  } else {
    userChoose.style.transform = 'rotate(0deg)';
    userList.style.height = '0vw';
    userListOpen = false;
  }
});

document.addEventListener("click", (event) => {
  if (sideBarOpen && !sideBar.contains(event.target) && event.target !== userPhoto) {
    sideBarOpen = false;
    blackScreen.style.visibility = 'hidden';
    blackScreen.style.background = 'none';
    sideBar.style.left = '-65vw';
  }
});

async function downloadVideoFile(message) {
  const progressBar = document.getElementById('videoProgressBar');

  let totalSize = BigInt(0);
  let downloadedSize = BigInt(0);

  const buffer = await client.downloadMedia(message.video, {
    progressCallback: (downloaded, fullSize) => {
      downloadedSize = BigInt(downloaded);
      totalSize = BigInt(fullSize);
      const percentage = Number((downloadedSize * BigInt(100) / totalSize).toString());
      progressBar.value = percentage;
    }
  });
  progressBar.value = 100;
  progressBar.style.display = "none";
  const blobFile = new Blob([buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blobFile);

  // Check if the download was completed
  if (downloadedSize === totalSize) {
    console.log('Download completed');
  }

  return url;
}


async function openModal(item) {
  if (Array.isArray(item.file)) {
    modalVideo.src = '';
    modalv.style.display = "block";

    const progressBar = document.getElementById('videoProgressBar');
    progressBar.value = 0; // Reset the progress bar

    videoSrc = await downloadVideoFile(item);
    modalVideo.src = videoSrc;
  } else {
    modalImage.src = item.file.src;
    modal.style.display = "block";
  }
}


function closeModal() {
  modal.style.display = "none";
}

function closeModalV() {
  modalv.style.display = "none";
}

closeBtn.addEventListener("click", closeModal);
closevBtn.addEventListener("click", closeModalV);

async function lazyLoadImage(imageDivElement, item) {
  let fileId;
  if (!Array.isArray(item.file)) {
    fileId = item.file.id.toString();
    if (isImageCached(fileId)) {
      imageDivElement.style.backgroundImage = `url(${getCachedImage(fileId)})`;
      item.file.src = getCachedImage(fileId);
      return;
    }
  }
  const observer = new IntersectionObserver(async (entries) => {

    if (entries[0].isIntersecting) {
      try {
        let fullImageUrl;
        if (Array.isArray(item.file)) {
          const [, thumb] = item.file;
          const buffer = await client.downloadMedia(item.message, { thumb });
          fullImageUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
        } else {
          const buffer = await client.downloadMedia(item.file);
          fullImageUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
          cacheImage(fileId, fullImageUrl);
        }
        imageDivElement.style.backgroundColor = 'none';
        imageDivElement.style.backgroundImage = `url(${fullImageUrl})`;
        item.file.src = fullImageUrl;
      } catch (error) {
        console.error(`Error loading image ${error}`);
      }
      observer.disconnect();
    }
  });

  observer.observe(imageDivElement);
}

const renameButton = document.getElementById("rename-button");

function updateRenameButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount === 1) {
    makeVisibleAnimation(renameButton, 500);
  } else {
    makeHiddenAnimation(renameButton, 500);
  }
}
renameButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const selectedFiles = [];
  let currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");
  for (const checkbox of checkboxes) {
    const listItem = checkbox.closest(".li-tile");
    const fileIndex = Array.from(listItem.parentElement.children).indexOf(listItem);
    selectedFiles.push(folderContent[fileIndex]);
  }
  for (const file of selectedFiles) {
    try {
      const fileId = file.messageId;
      const newName = prompt("Введите новое имя файла");
      if (newName === null) {
        return
      }
      if (currentFolderPath === '') {
        await client.editMessage("me", { message: fileId, text: currentFolderPath.concat(newName) });
      } else {
        await client.editMessage("me", { message: fileId, text: currentFolderPath.concat('/').concat(newName) });
      }
    } catch (error) {
      console.error("Ошибка при переименовании файла:", error);
    }
  }
  makeHiddenAnimation(renameButton, 500);
  makeHiddenAnimation(moveButton, 500);
  makeHiddenAnimation(copyButton, 500);
  makeHiddenAnimation(acceptMoveButton, 500);
  makeHiddenAnimation(acceptCopyButton, 500);
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});

function updateDeleteButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    currentFolderName.style.removeProperty('transition');
    makeVisibleAnimation(deleteButton, 500);
  } else {
    currentFolderName.style.transition = '0.2s';

    makeHiddenAnimation(deleteButton, 500);
  }
}

const deleteButton = document.getElementById("delete-button");
deleteButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const currentFolder = navigationStack[navigationStack.length - 1];
  for (const checkbox of checkboxes) {
    const listItem = checkbox.closest(".li-tile");
    const fileIndex = Array.from(listItem.parentElement.children).indexOf(listItem);
    selectedFiles.push(folderContent[fileIndex]);
  }
  for (const file of selectedFiles) {
    try {
      const fileId = file.messageId;
      await client.deleteMessages("me", [fileId], {
        revoke: true,
      });
      console.log("Файл успешно удален:", file);
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
    }
    selectedFiles.length = 0;
  }

  makeHiddenAnimation(renameButton, 500);
  makeHiddenAnimation(moveButton, 500);
  makeHiddenAnimation(acceptMoveButton, 500);
  makeHiddenAnimation(copyButton, 500);
  makeHiddenAnimation(acceptCopyButton, 500);
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});
let isMouseDown = false;
let timer;

// Функция для обработки долгого нажатия
function handleLongPress(checkbox, listItem) {
  checkbox.checked = !checkbox.checked;

  if (checkbox.checked) {
    const fileIndex = Array.from(listItem.parentElement.children).indexOf(listItem);
    selectedFiles.push(folderContent[fileIndex]);
    listItem.classList.add("selected");
  } else {
    // Удалить из выбранных файлов
    const fileIndex = Array.from(listItem.parentElement.children).indexOf(listItem);
    const index = selectedFiles.findIndex(file => file === folderContent[fileIndex]);
    if (index !== -1) {
      selectedFiles.splice(index, 1);
    }
    listItem.classList.remove("selected");
  }

  // Обновить видимость кнопок
  updateDeleteButtonVisibility();
  updateMoveButtonVisibility();
  updateRenameButtonVisibility();
}

// Обработчик события нажатия кнопки мыши или касания на мобильном устройстве
function handleStartEvent(checkbox, listItem) {
  isMouseDown = true;

  // Запустить таймер через 0.7 секунды
  timer = setTimeout(() => {
    handleLongPress(checkbox, listItem);
  }, 700);
}

// Обработчик события отпускания кнопки мыши или окончания касания на мобильном устройстве
function handleEndEvent() {
  isMouseDown = false;

  // Очистить таймер
  clearTimeout(timer);
}

async function displayFiles(folder) {
  folderContent = [];
  fileList.innerHTML = "";
  const currentFolderName = document.getElementById("currentfolder");
  currentFolderName.textContent = folder.name;
  const backButton = document.getElementById("back-button");
  if (navigationStack.length <= 1) {
    backButton.style.display = "none";
  } else {
    backButton.style.display = "block";
    backButton.onclick = () => {
      navigationStack.pop();
      displayFiles(navigationStack[navigationStack.length - 1]);
    };
  }
  const lazyLoadPromises = [];
  let elementIndex = 0;
  // Separate folders and files
  const folders = [];
  const files = [];

  for (const itemName in folder.content) {
    const items = folder.content[itemName];
    if (items.type === "folder") {
      folders.push(items);
    } else if (Array.isArray(items)) {
      for (const item of items) {
        if (item.name.endsWith("NoneFile")) {
          continue;
        }
        files.push(item);
      }
    }
  }

  // Append folders
  for (const folderItem of folders) {
    const listItem = document.createElement("li");
    listItem.className = "li-tile";
    const divElement = document.createElement("div");
    const folderTile = document.createElement("div");
    folderTile.className = "folder";
    divElement.textContent = folderItem.name;
    divElement.className = "file-name";
    listItem.appendChild(folderTile);
    listItem.appendChild(divElement);
    listItem.onclick = () => {
      navigationStack.push(folderItem);
      displayFiles(folderItem);
      makeHiddenAnimation(moveButton, 500);
      makeHiddenAnimation(copyButton, 500);
      makeHiddenAnimation(renameButton, 500);
    };
    folderContent.push(folderItem);
    fileList.appendChild(listItem);
  }

  // Append files
  for (const fileItem of files) {
    const listItem = document.createElement("li");
    listItem.className = "li-tile";
    const divElement = document.createElement("div");
    const checkbox = document.createElement("input");
    const filename = document.createElement("div");
    checkbox.type = "checkbox";
    checkbox.className = "file-checkbox";
    divElement.className = "image-tile";
    listItem.appendChild(divElement);
    divElement.addEventListener("click", () => openModal(fileItem));

    filename.textContent = fileItem.name || "Noname";
    filename.className = "file-name";
    listItem.appendChild(filename);

    checkbox.addEventListener("change", async () => {
      await updateDeleteButtonVisibility();
      await updateMoveButtonVisibility();
      await updateRenameButtonVisibility();
    });
    listItem.appendChild(checkbox);

    // Добавьте обработчики событий mousedown и mouseup к элементу списка
    listItem.addEventListener("mousedown", () => handleStartEvent(checkbox, listItem));
    listItem.addEventListener("mouseup", handleEndEvent);
    listItem.addEventListener("touchstart", () => handleStartEvent(checkbox, listItem));
    listItem.addEventListener("touchend", handleEndEvent);

    fileList.appendChild(listItem);
    folderContent.push(fileItem);
    lazyLoadPromises.push(lazyLoadImage(divElement, fileItem));
  }


  await Promise.all(lazyLoadPromises);


  updateDeleteButtonVisibility();
}

async function refreshFilesAndFolders() {
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);

  const currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");

  let currentFolder = fileStructure;
  for (const folderName of currentFolderPath.split("/")) {
    if (folderName && currentFolder.content[folderName]) {
      currentFolder = currentFolder.content[folderName];
    }
  }

  navigationStack = [fileStructure, ...navigationStack.slice(1, -1), currentFolder];
  displayFiles(currentFolder);
}
async function uploadFile(files) {
  const currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");

  for (const file of files) {
    const caption = currentFolderPath + "/" + file.name;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const toUpload = new CustomFile(file.name, file.size, "", arrayBuffer);

      const result = await client.sendFile("me", {
        file: toUpload,
        caption: caption,
        workers: 1,
      });

      console.log("Файл успешно загружен:", result);
    } catch (error) {
      console.error("Ошибка при загрузке файла:", error);
    }
  }

  refreshFilesAndFolders();
}
async function setUserProfilePhotoAsBackground() {
  const buffer = await client.downloadProfilePhoto('me')

  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const fullImageUrl = "data:image/jpeg;base64," + base64;

  const userPhotoElement = document.querySelectorAll(".user-photo");
  for (const userphoto of userPhotoElement) {
    userphoto.style.backgroundImage = `url(${fullImageUrl})`;
    if (fullImageUrl == 'data:image/jpeg;base64,') {
      userphoto.style.backgroundImage = `url(https://comhub.ru/wp-content/uploads/2018/09/dog1.png)`;
    }
  }
}
const moveBuffer = [];
function updateMoveButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    makeVisibleAnimation(moveButton, 500);
    makeVisibleAnimation(copyButton, 500);
  } else {
    makeHiddenAnimation(moveButton, 500);
    makeHiddenAnimation(copyButton, 500);
    makeHiddenAnimation(acceptMoveButton, 500);
    makeHiddenAnimation(acceptCopyButton, 500);
  }
}
moveButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const currentFolder = navigationStack[navigationStack.length - 1];
  for (const checkbox of checkboxes) {
    const listItem = checkbox.closest(".li-tile");
    makeHiddenAnimation(moveButton, 500);
    makeHiddenAnimation(copyButton, 500);
    makeHiddenAnimation(renameButton, 500);
    makeVisibleAnimation(acceptMoveButton, 500);
    console.log(selectedFiles);
  }
});

copyButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const currentFolder = navigationStack[navigationStack.length - 1];
  for (const checkbox of checkboxes) {
    const listItem = checkbox.closest(".li-tile");
    makeHiddenAnimation(moveButton, 500);
    makeHiddenAnimation(copyButton, 500);
    makeHiddenAnimation(renameButton, 500);
    makeVisibleAnimation(acceptCopyButton, 500);
  }
});

acceptMoveButton.addEventListener("click", async () => {
  for (const file of selectedFiles) {
    try {
      let currentFolderPath = navigationStack
        .slice(1)
        .map((folder) => folder.name)
        .join("/");
      const fileId = file.messageId;
      const filename = file.name;
      if (currentFolderPath === '') {
        await client.editMessage("me", { message: fileId, text: currentFolderPath.concat(filename) });
      } else {
        await client.editMessage("me", { message: fileId, text: currentFolderPath.concat('/').concat(filename) });
      }
      console.log('Файл перемещен');
    } catch (error) {
      console.error("Ошибка при перемещении файла:", error);
    }
  }
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
  makeHiddenAnimation(acceptMoveButton, 500);
  selectedFiles.length = 0;
});

acceptCopyButton.addEventListener("click", async () => {
  for (const file of selectedFiles) {
    console.log(file);
    try {
      let currentFolderPath = navigationStack
        .slice(1)
        .map((folder) => folder.name)
        .join("/");
      const fileId = file.messageId;
      const filename = file.name;
      if (currentFolderPath === '') {
        console.log(currentFolderPath.concat(filename));
        //await client.sendMessage("me", { file: file.file, text: currentFolderPath.concat(filename) });
        const result = await client.sendFile("me", {
          file: file.file,
          caption: currentFolderPath.concat(filename),
          workers: 1,
        });
      } else {
        console.log(currentFolderPath.concat('/').concat(filename));
        // await client.sendMessage("me", { file: file.file, text: currentFolderPath.concat('/').concat(filename) });
        const result = await client.sendFile("me", {
          file: file.file,
          caption: currentFolderPath.concat('/').concat(filename),
          workers: 1,
        });
      }
      console.log('Файл скопирован');
    } catch (error) {
      console.error("Ошибка при копировании файла:", error);
    }
  }
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
  makeHiddenAnimation(acceptCopyButton, 500);
  selectedFiles.length = 0;
});
const createFolder = document.getElementById("create-folder");
createFolder.addEventListener("click", async () => {
  let currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");
  const createFolderName = prompt("Введите имя папки");
  if (createFolderName === null) {
    return
  }
  if (currentFolderPath === '') {
    await client.sendMessage("me", { message: "#EmptyFolder ".concat(currentFolderPath).concat(createFolderName).concat("/").concat('NoneFile') });
  } else {
    await client.sendMessage("me", { message: "#EmptyFolder ".concat(currentFolderPath).concat("/").concat(createFolderName).concat("/").concat('NoneFile') });
  }
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});

async function init() {
  await client.connect();
  setUserProfilePhotoAsBackground();
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack.push(fileStructure);
  displayFiles(fileStructure);
  const fileInput = document.getElementById("file-input");
  const uploadButton = document.getElementById("upload-button");
  const closeUploadButton = document.getElementById("close-upload-menu");
  const uploadMenu = document.getElementById("upload-menu");
  const uploadMenuButton = document.getElementById("upload-menu-button");
  setName();
  uploadMenuButton.addEventListener("click", () => {
    uploadMenu.style.transform = 'translate(0px, 0px)'
    uploadMenuButton.style.transform = 'translate(0px, 300px)'
  });

  closeUploadButton.addEventListener("click", () => {
    uploadMenu.style.transform = 'translate(0px, 500px)'
    uploadMenuButton.style.transform = 'translate(0px, 0px)'
  });

  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (event) => {
    if (event.target.files.length > 0) {
      const file = event.target.files;
      await uploadFile(file);
      const files = await getFilesFromMeDialog();
      const fileStructure = buildFileStructure(files);
      navigationStack = [fileStructure, ...navigationStack.slice(1)];
      displayFiles(navigationStack[navigationStack.length - 1]);
    }
  });
}


init(); 