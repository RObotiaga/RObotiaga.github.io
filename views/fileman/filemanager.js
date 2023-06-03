const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { CustomFile } = require("telegram/client/uploads");
const { message } = require("telegram/client");
const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
let folderContent =[];
let navigationStack = [];
const imageCache = new Map();
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
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
    renameButton.style.display = "block";
  } else {
    renameButton.style.display = "none";
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
  renameButton.style.display = "none";
  moveButton.style.display = "none";
  acceptMoveButton.style.display = "none";
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});

function updateDeleteButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    currentFolderName.style.removeProperty('transition');
    currentFolderName.style.maxWidth = '22vw';
    deleteButton.style.display = "block";
  } else {
    currentFolderName.style.transition = '0.2s';
    currentFolderName.style.maxWidth = '80vw';
    deleteButton.style.display = "none";
  }
}

const deleteButton = document.getElementById("delete-button");
deleteButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const selectedFiles = [];
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
  }

  renameButton.style.display = "none";
  moveButton.style.display = "none";
  acceptMoveButton.style.display = "none";
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});
async function displayFiles(folder) {
  folderContent = [];
  fileList.innerHTML = "";
  const currentFolderName = document.getElementById("currentfolder");
  const userPhoto = document.getElementById("user-photo");
  currentFolderName.textContent = folder.name;
  const backButton = document.getElementById("back-button");
  if (navigationStack.length <= 1) {
    backButton.style.display = "none";
    userPhoto.style.display = "block";
  } else {
    backButton.style.display = "block";
    userPhoto.style.display = "none";
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

  const userPhotoElement = document.getElementById("user-photo");
  userPhotoElement.style.backgroundImage = `url(${fullImageUrl})`;
  if (fullImageUrl == 'data:image/jpeg;base64,') {
    userPhotoElement.style.backgroundImage = `url(https://comhub.ru/wp-content/uploads/2018/09/dog1.png)`;
  }
}
const moveButton = document.getElementById("move-button");
const acceptMoveButton = document.getElementById("accept-move-button");
const moveBuffer = [];
function updateMoveButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    moveButton.style.display = "block";
  } else {
    moveButton.style.display = "none";
    acceptMoveButton.style.display = "none";
  }
}
moveButton.addEventListener("click", async () => {
  const checkboxes = document.querySelectorAll(".file-checkbox:checked");
  const currentFolder = navigationStack[navigationStack.length - 1];
  for (const checkbox of checkboxes) {
    const listItem = checkbox.closest(".li-tile");
    moveButton.style.display = "none";
    renameButton.style.display = "none";
    acceptMoveButton.style.display = "block";
    const fileIndex = Array.from(listItem.parentElement.children).indexOf(listItem);
    selectedFiles.push(folderContent[fileIndex]);
  }
});

acceptMoveButton.addEventListener("click", async () => {
  for (const file of moveBuffer) {
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
  acceptMoveButton.style.display = "none";
  moveBuffer.length = 0;
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