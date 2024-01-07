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
  }
  async delete() {
    const fileId = this.messageId;
    await client.deleteMessages("me", [fileId], {
      revoke: true,
    });
    console.log("Файл успешно удален:", this.message);
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
const sideBar = document.getElementById("side-bar");
const blackScreen = document.getElementById("black-screen");
const userChoose = document.getElementById("user-choose");
const userList = document.getElementById("user_list");
const addUserButton = document.getElementById("add_user_button");
const uploadButton = document.getElementById("upload-button");
const closeUploadButton = document.getElementById("close-upload-menu");
const uploadMenu = document.getElementById("upload-menu");
const uploadMenuButton = document.getElementById("upload-menu-button");

// modal window

closeBtn.addEventListener("click", async () => {
  modal.style.display = "none";
});
closevBtn.addEventListener("click", async () => {
  modalVideo.pause();
  modalv.style.display = "none";
});

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
  const fileArray = [];

  for (const file of files) {
    const path = file.caption.split("/");
    if (path[0].includes("#EmptyFolder")) {
      path[0] = path[0].replace("#EmptyFolder ", "");
    }

    if (!file.caption.includes("#EmptyFolder")) {
      const newFile = new File(
        file.message,
        file.type,
        file.file,
        file.caption,
        file.date,
        file.messageId,
        file.thumb || ""
      );
      fileArray.push(newFile);
    }
  }

  return fileArray;
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
  filename.className = "file-name";
  listItem.appendChild(filename);
  fileList.appendChild(listItem);
  lazyLoadPromises.push(lazyLoadImage(divElement, item));
  listItem.addEventListener("click", () => openModal(item));
  onLongPress(listItem, () => {
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
  });
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
  listItem.addEventListener("click", async () => {
    navigationStack.push(folder);
    await displayFilesAndFolders(folder);
  });
  onLongPress(listItem, () => {
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
  });
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
function groupFilesByWeek(files) {
  const groupedFiles = {};
  for (const file of files) {
    const fileDate = new Date(file.date * 1000);
    const weekStartDate = getWeekStartDate(fileDate);
    if (!groupedFiles[weekStartDate]) {
      groupedFiles[weekStartDate] = [];
    }
    groupedFiles[weekStartDate].push(file);
  }
  return groupedFiles;
}

function getWeekStartDate(date) {
  const dayOfWeek = date.getDay();
  const weekStartDate = new Date(date);
  weekStartDate.setDate(date.getDate() - dayOfWeek);
  weekStartDate.setHours(0, 0, 0, 0);
  return weekStartDate;
}

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
  await displayFilesAndFolders(currentFolder);
}
function onLongPress(element, callback) {
  let timer;

  element.addEventListener("touchstart", () => {
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, 600);
  });

  function cancel() {
    clearTimeout(timer);
  }

  element.addEventListener("touchend", cancel);
  element.addEventListener("touchmove", cancel);
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
      userphoto.style.backgroundImage = `url(https://comhub.ru/wp-content/uploads/2018/09/dog1.png)`;
    }
  }
  let me = await client.getMe();
  me = me.firstName;
  userName.textContent = `${me}`;
}
// Main thread

async function displayFilesAndFolders(fileStructure) {
  fileList.innerHTML = "";
  const groupedFiles = groupFilesByWeek(fileStructure);

  for (const weekStartDate in groupedFiles) {
    if (groupedFiles.hasOwnProperty(weekStartDate)) {
      const filesInWeek = groupedFiles[weekStartDate];
      const weekHeader = document.createElement("h3");
      weekHeader.className = "time-top";
      weekHeader.textContent = formatDate(new Date(weekStartDate));
      fileList.appendChild(weekHeader);

      for (const item of filesInWeek) {
        if (item.type !== "folder") {
          await createFileElement(item);
        }
      }
    }
  }

  await Promise.all(lazyLoadPromises);
}

function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('ru-RU', options);
}


async function main() {
  await client.connect();
  const files = await getFilesFromMeDialog();
  files.sort((a, b) => b.date - a.date); // Сортировка файлов по дате (новые в начале)
  const fileStructure = buildFileStructure(files);
  await displayFilesAndFolders(fileStructure);
}

main();

