// TG client init

const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// global repositories

const imageCache = new Map();
const fileCache = new Map();
const lazyLoadPromises = [];
let navigationStack = [];
let selectedFiles = [];

// Classes

class File {
  constructor(message, type, file, caption, date, messageId, thumb = null) {
    this.message = message;
    this.type = type;
    this.file = file;
    this.caption = caption;
    this.date = date;
    this.messageId = messageId;
    this.thumb = thumb;
    this.name = caption.split("/").pop();
  }
  async getCachedImage() {
    if (imageCache.has(this.file.id.toString())) {
      return imageCache.get(this.file.id.toString());
    } else {
      const fileURL = await this.downloadPreview();
      imageCache.set(this.file.id.toString(), fileURL);
      return fileURL;
    }
  }
  async getCachedFile() {
    if (fileCache.has(this.file.id.toString())) {
      return fileCache.get(this.file.id.toString());
    } else {
      const fileURL = await this.downloadFullFile();
      fileCache.set(this.file.id.toString(), fileURL);
      return fileURL;
    }
  }
  async downloadPreview() {
    if (this.type === "video") {
      const [, thumb] = this.thumb;
      const buffer = await client.downloadMedia(this.message, { thumb });
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    } else if (this.type === "photo") {
      const size = this.file.size;
      const buffer = await client.downloadMedia(this.message, { size });
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    } else if (this.type === "docPhoto") {
      const [, thumb] = this.thumb;
      const buffer = await client.downloadMedia(this.message, { thumb });
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    }
  }
  async downloadFullFile() {
    if (this.type === "video") {
      let totalSize = 0;
      let downloadedSize = 0;
      const progressBar = document.getElementById("videoProgressBar");

      const buffer = await client.downloadMedia(this.file, {
        progressCallback: (downloaded, fullSize) => {
          downloadedSize = downloaded;
          totalSize = fullSize;
          const percentage = Number(
            ((downloadedSize * 100) / totalSize).toString()
          );
          progressBar.value = percentage;
        },
      });

      progressBar.value = 100;
      progressBar.style.display = "none";
      return URL.createObjectURL(new Blob([buffer], { type: "video/mp4" }));
    } else if (this.type === "photo") {
      return this.getCachedImage();
    } else if (this.type === "docPhoto") {
      const buffer = await client.downloadMedia(this.file);
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    }
  }
  async rename(newName) {
    const fileId = this.messageId;
    if (getPath() === "") {
      await client.editMessage("me", {
        message: fileId,
        text: getPath().concat(newName),
      });
    } else {
      await client.editMessage("me", {
        message: fileId,
        text: getPath().concat("/").concat(newName),
      });
    }
    updateFileStructure();
  }
  async copyTo(newPath) {
    const filename = this.name;
    if (newPath === "") {
      const result = await client.sendFile("me", {
        file: this.file,
        caption: newPath.concat(filename),
        workers: 1,
      });
    } else {
      const result = await client.sendFile("me", {
        file: this.file,
        caption: newPath.concat("/").concat(filename),
        workers: 1,
      });
    }
    console.log("Файл скопирован");
    updateFileStructure();
  }
  async delete() {
    const fileId = this.messageId;
    await client.deleteMessages("me", [fileId], {
      revoke: true,
    });
    console.log("Файл успешно удален:", this.message);
    updateFileStructure();
  }
  async moveTo(newPath) {
    let result;
    const filename = this.name || "";
    if (newPath === "") {
      result = await client.editMessage("me", {
        message: this.messageId,
        text: newPath.concat(filename),
      });
    } else {
      result = await client.editMessage("me", {
        message: this.messageId,
        text: newPath.concat("/").concat(filename),
      });
    }
    console.log(result);
    console.log("Файл перемещен");
    updateFileStructure();
  }
}

class Folder {
  constructor(name) {
    this.name = name;
    this.type = "folder";
    this.content = [];
  }

  addFile(file) {
    this.content.push(file);
  }

  addFolder(folder) {
    this.content.push(folder);
  }
}

// Elements

const backButton = document.getElementById("back-button");
const createEmptyFolder = document.getElementById("create-folder");
const renameButton = document.getElementById("rename-button");
const deleteButton = document.getElementById("delete-button");
const userName = document.getElementById("user-name");

// Structural functions

async function getFilesFromMeDialog() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId);
  const photos = messages
    .filter(
      (message) =>
        message.media instanceof Api.MessageMediaPhoto ||
        message.message?.startsWith("#EmptyFolder ")
    )
    .map((message) => ({
      message,
      type: "photo",
      file: message.media && message.media.photo,
      caption: message.message,
      date: message.date,
      messageId: message.id,
    }));

  const videos = messages
    .filter(
      (message) =>
        message.media instanceof Api.MessageMediaDocument &&
        message.media.document.mimeType === "video/mp4"
    )
    .map((message) => ({
      message,
      type: "video",
      file: message.media.document,
      caption: message.message,
      date: message.date,
      messageId: message.id,
      thumb: message.media.document.thumbs,
    }));
  const docPhoto = messages
    .filter(
      (message) =>
        message.media instanceof Api.MessageMediaDocument &&
        message.media.document.mimeType === "image/png"
    )
    .map((message) => ({
      message,
      type: "docPhoto",
      file: message.media.document,
      caption: message.message,
      date: message.date,
      messageId: message.id,
      thumb: message.media.document.thumbs,
    }));

  const files = [...photos, ...videos, ...docPhoto].sort(
    (a, b) => b.date - a.date
  );
  return files;
}
function buildFileStructure(files) {
  const root = new Folder("root");

  for (const file of files) {
    const path = file.caption.split("/");
    if (path[0].includes("#EmptyFolder")) {
      path[0] = path[0].replace("#EmptyFolder ", "");
    }

    let currentFolder = root;

    for (const folderName of path.slice(0, -1)) {
      let foundFolder = currentFolder.content.find(
        (item) => item instanceof Folder && item.name === folderName
      );
      if (!foundFolder) {
        foundFolder = new Folder(folderName);
        currentFolder.addFolder(foundFolder);
      }

      currentFolder = foundFolder;
    }
    if (file.caption.indexOf("#EmptyFolder")) {
      const newFile = new File(
        file.message,
        file.type,
        file.file,
        file.caption,
        file.date,
        file.messageId,
        file.thumb || ""
      );
      currentFolder.addFile(newFile);
    }
  }

  return root;
}
async function lazyLoadImage(divElement, item) {
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      try {
        const fileURL = await item.getCachedImage();
        divElement.style.backgroundColor = "none";
        divElement.style.backgroundImage = `url(${fileURL})`;
      } catch (error) {
        console.error(`Error loading image ${error}`);
      }
      observer.disconnect();
    }
  });
  observer.observe(divElement);
}
async function createFileElement(item) {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  const divElement = document.createElement("div");
  const filename = document.createElement("div");
  divElement.className = "image-tile";
  listItem.appendChild(divElement);
  filename.textContent = item.name || "NoName";
  filename.className = "file-name";
  listItem.appendChild(filename);
  fileList.appendChild(listItem);
  lazyLoadPromises.push(lazyLoadImage(divElement, item));
  function selectFile() {
    if (listItem.classList.contains("selected")) {
      listItem.classList.remove("selected");
      selectedFiles.splice(
        findIndexByMessageId(selectedFiles, item.message.id),
        1
      );
    } else {
      listItem.classList.add("selected");
      selectedFiles.push(item);
    }
    updateActionButtonVisibility();
  }
  function clickFile() {
    if (selectedFiles.length > 0) {
      selectFile();
    } else {
      openModal(item);
    }
  }
  onLongPress(listItem, selectFile, clickFile, 600);
}
async function createFolder(folder) {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  const divElement = document.createElement("div");
  const folderTile = document.createElement("div");
  folderTile.className = "folder";
  divElement.textContent = folder.name;
  divElement.className = "file-name";
  listItem.appendChild(folderTile);
  listItem.appendChild(divElement);
  fileList.appendChild(listItem);
  function selectFolder() {
    if (listItem.classList.contains("selected")) {
      listItem.classList.remove("selected");
      for (const item of getItemsInFolder(folder)) {
        selectedFiles.splice(
          findIndexByMessageId(selectedFiles, item.message.id),
          1
        );
      }
    } else {
      listItem.classList.add("selected");
      selectedFiles.push(...getItemsInFolder(folder));
    }
    updateActionButtonVisibility();
  }
  async function clickFolder() {
    if (selectedFiles.length > 0) {
      selectFolder();
    } else {
      navigationStack.push(folder);
      await displayFilesAndFolders(folder);
    }
  }
  onLongPress(listItem, selectFolder, clickFolder, 600);
}
async function openModal(item) {
  if (item.type == "video") {
    modalVideo.src = "";
    modalv.style.display = "block";
    const fileURL = await item.getCachedFile();
    modalVideo.src = fileURL;
  } else {
    const fileURL = await item.getCachedFile();
    modalImage.src = fileURL;
    modal.style.display = "block";
  }
}

// Auxiliary functions

async function checkRootFolder() {
  if (navigationStack.length <= 1) {
    return true;
  } else {
    return false;
  }
}
function compareFilesAndFolders(a, b) {
  if (a instanceof Folder && !(b instanceof Folder)) {
    return -1;
  } else if (!(a instanceof Folder) && b instanceof Folder) {
    return 1;
  } else {
    return 0;
  }
}
function getPath() {
  const currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");
  return currentFolderPath;
}
async function findObjectByName(obj, name) {
  if (obj.name === name) {
    return obj;
  }
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      const result = await findObjectByName(obj[key], name);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
async function updateFileStructure() {
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  const currentFolder = await findObjectByName(
    fileStructure,
    currentFolderName.textContent
  );
  console.log(fileStructure, currentFolder);
  await displayFilesAndFolders(currentFolder);
}
async function onLongPress(element, callback1, callback2, delay) {
  let pressStartTime = 0;
  let timer = null;
  function startPress(event) {
    pressStartTime = Date.now();
    timer = setTimeout(() => {
      timer = null;
      callback1();
    }, delay);
  }

  function endPress(event) {
    clearTimeout(timer);
    const pressDuration = Date.now() - pressStartTime;
    if (pressDuration <= delay) {
      callback2();
    }
  }

  element.addEventListener("mousedown", startPress, {passive: true});
  element.addEventListener("touchstart", startPress, {passive: true});

  element.addEventListener("mouseup", endPress);
  element.addEventListener("touchend", endPress);
}

function findIndexByMessageId(array, findId) {
  let index = array.findIndex((item) => item.message.id === findId);
  return index;
}
function getItemsInFolder(obj) {
  const items = [];
  for (const item of obj.content)
    if (item instanceof File) {
      items.push(item);
    } else {
      items.push(...getItemsInFolder(item));
    }
  return items;
}
function updateActionButtonVisibility() {
  if (selectedFiles.length === 1) {
    makeVisibleAnimation(renameButton, 500);
  } else {
    makeHiddenAnimation(renameButton, 500);
  }
  if (selectedFiles.length > 0) {
    currentFolderName.style.removeProperty("transition");
    makeVisibleAnimation(deleteButton, 500);
  } else {
    currentFolderName.style.transition = "0.2s";
    makeHiddenAnimation(deleteButton, 500);
  }
  if (selectedFiles.length > 0) {
    makeVisibleAnimation(moveButton, 500);
    makeVisibleAnimation(copyButton, 500);
  } else {
    makeHiddenAnimation(moveButton, 500);
    makeHiddenAnimation(copyButton, 500);
  }
}
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
let prevScrollPos = window.pageYOffset;
window.addEventListener("scroll", function () {
  const currentScrollPos = window.pageYOffset;

  if (prevScrollPos > currentScrollPos) {
    header.classList.remove("hide");
  } else {
    header.classList.add("hide");
  }

  prevScrollPos = currentScrollPos;
});
async function setUserProfilePhotoAsBackground() {
  const buffer = await client.downloadProfilePhoto("me");
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const fullImageUrl = "data:image/jpeg;base64," + base64;
  const userPhotoElement = document.querySelectorAll(".user-photo");
  for (const userphoto of userPhotoElement) {
    userphoto.style.backgroundImage = `url(${fullImageUrl})`;
    if (fullImageUrl == "data:image/jpeg;base64,") {
      userphoto.style.backgroundImage = `url(../img/dog1.png)`;
    }
  }
  let me = await client.getMe();
  me = me.firstName;
  userName.textContent = `${me}`;
}

// File upload

async function uploadFile(files) {
  for (const file of files) {
    let caption = "";
    if (await checkRootFolder()) {
      caption = getPath() + file.name;
    } else {
      caption = getPath() + "/" + file.name;
    }
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
}
fileInput.addEventListener("change", async (event) => {
  if (event.target.files.length > 0) {
    const file = event.target.files;
    await uploadFile(file);
  }
  await updateFileStructure();
});

// File rename

renameButton.addEventListener("click", async () => {
  for (const file of selectedFiles) {
    try {
      const newName = prompt("Введите новое имя файла");
      if (newName === null) {
        return;
      }
      file.rename(newName);
      selectedFiles.length = 0;
      updateActionButtonVisibility();
    } catch (error) {
      console.error("Ошибка при переименовании файла:", error);
    }
  }
});

// File move

const moveBuffer = [];
moveButton.addEventListener("click", async () => {
  moveBuffer.push(...selectedFiles);
  selectedFiles.length = 0;
  updateActionButtonVisibility();
  makeVisibleAnimation(acceptMoveButton, 500);
});
acceptMoveButton.addEventListener("click", async () => {
  for (const file of moveBuffer) {
    try {
      file.moveTo(getPath());
    } catch (error) {
      console.error("Ошибка при перемещении файла:", error);
    }
  }
  makeHiddenAnimation(acceptMoveButton, 500);
  moveBuffer.length = 0;
});

// File copy

const copyBuffer = [];
copyButton.addEventListener("click", async () => {
  copyBuffer.push(...selectedFiles);
  selectedFiles.length = 0;
  updateActionButtonVisibility();
  makeVisibleAnimation(acceptCopyButton, 500);
});
acceptCopyButton.addEventListener("click", async () => {
  for (const file of copyBuffer) {
    try {
      file.copyTo(getPath());
    } catch (error) {
      console.error("Ошибка при копировании файла:", error);
    }
  }
  makeHiddenAnimation(acceptCopyButton, 500);
  copyBuffer.length = 0;
});

// File delete

deleteButton.addEventListener("click", async () => {
  for (const file of selectedFiles) {
    try {
      file.delete();
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
    }
  }
  selectedFiles.length = 0;
  updateActionButtonVisibility();
});

// Add account

addUserButton.addEventListener("click", async () => {
  const me = await client.getMe();

  var savedSession = localStorage.getItem("savedSession");

  var dictionary = {};
  dictionary[me.firstName] = savedSession;

  localStorage.setItem("cachedSession", JSON.stringify(dictionary));

  localStorage.removeItem("savedSession");

  document.location = "../loginpage/login.html";
});

async function addChooseUserButton() {
  var cachedSession = JSON.parse(localStorage.getItem("cachedSession"));
  for (var key in cachedSession) {
    var button = document.createElement("div");
    button.classList.add("side-bar-button", "choose-user");
    button.textContent = key;
    button.addEventListener("click", async function (event) {
      me = await client.getMe();
      me = me.firstName;
      cachedSession[me] = localStorage.getItem("savedSession");
      localStorage.setItem(
        "savedSession",
        cachedSession[event.target.textContent]
      );
      delete cachedSession[event.target.textContent];
      localStorage.setItem("cachedSession", JSON.stringify(cachedSession));
      location.reload();
    });
    userList.insertBefore(button, addUserButton);
  }
}
// Create empty folder

createEmptyFolder.addEventListener("click", async () => {
  let caption = "";
  const createFolderName = prompt("Введите имя папки");
  if (createFolderName === null) {
    return;
  }
  if (await checkRootFolder()) {
    caption = "#EmptyFolder "
      .concat(getPath())
      .concat(createFolderName)
      .concat("/")
      .concat("NoName");
  } else {
    caption = "#EmptyFolder "
      .concat(getPath())
      .concat("/")
      .concat(createFolderName)
      .concat("/")
      .concat("NoName");
  }
  await client.sendMessage("me", { message: caption });
  await updateFileStructure();
});

// Main thread

async function displayFilesAndFolders(fileStructure) {
  fileList.innerHTML = "";
  currentFolderName.textContent = fileStructure.name;
  if (await checkRootFolder()) {
    backButton.style.display = "none";
  } else {
    backButton.style.display = "flex";
    backButton.onclick = () => {
      navigationStack.pop();
      selectedFiles.length = 0;
      updateActionButtonVisibility();
      displayFilesAndFolders(navigationStack[navigationStack.length - 1]);
    };
  }
  fileStructure.content.sort(compareFilesAndFolders);
  for (const item of fileStructure.content) {
    if (item.type === "folder") {
      await createFolder(item);
    } else {
      await createFileElement(item);
    }
  }
  await Promise.all(lazyLoadPromises);
}

async function main() {
  await client.connect();
  setUserProfilePhotoAsBackground();
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack.push(fileStructure);
  await displayFilesAndFolders(fileStructure);
  await addChooseUserButton();
}

main();
