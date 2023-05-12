const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { CustomFile } = require("telegram/client/uploads");
const { message } = require("telegram/client");
const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
let files = [];
let navigationStack = [];
const imageCache = new Map();
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Функция для сохранения изображения в кэше
function cacheImage(fileId, imageUrl) {
  imageCache.set(fileId, imageUrl);
}

// Функция для получения изображения из кэша
function getCachedImage(fileId) {
  return imageCache.get(fileId);
}

// Функция для проверки наличия изображения в кэше
function isImageCached(fileId) {
  return imageCache.has(fileId);
}

async function getFilesFromMeDialog() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId, { limit: 100 });
  files = messages
    .filter((message) => message.media && message.media instanceof Api.MessageMediaPhoto)
    .map((message) => ({
      photo: message.media.photo,
      caption: message.message,
      date: message.date,
      messageId: message.id,
    }));
  files.sort((a, b) => b.date - a.date);
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
      messageId: file.messageId
    });
  }
  return root;
}


const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload-button");
const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
const closeBtn = document.querySelector(".close");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

function openModal(item) {
  modalImage.src = item.file.src; // используем свойство 'src' из файла в объекте 'item'
  modal.style.display = "block";
}

function closeModal() {
  modal.style.display = "none";
}

function showPrevImage() {
  currentImageIndex = (currentImageIndex - 1 + files.length) % files.length;
  modalImage.src = files[currentImageIndex].src;
}

function showNextImage() {
  currentImageIndex = (currentImageIndex + 1) % files.length;
  modalImage.src = files[currentImageIndex].src;
}

closeBtn.addEventListener("click", closeModal);
prevBtn.addEventListener("click", showPrevImage);
nextBtn.addEventListener("click", showNextImage);

async function getThumbnailUrl(file) {
  const thumbnail = file.sizes.find((size) => size.type === 's') || file.sizes[0];
  const buffer = await client.downloadMedia(thumbnail, {});
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return "data:image/jpeg;base64," + base64;
}

async function lazyLoadImage(imageDivElement, file) {
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      const fileId = file.id.toString();

      if (isImageCached(fileId)) {
        imageDivElement.style.backgroundImage = `url(${getCachedImage(fileId)})`;
        file.src = getCachedImage(fileId);
      } else {
        const buffer = await client.downloadMedia(file, {});
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const fullImageUrl = "data:image/jpeg;base64," + base64;
        cacheImage(fileId, fullImageUrl);
        imageDivElement.style.backgroundImage = `url(${fullImageUrl})`;
        file.src = fullImageUrl;
      }

      observer.disconnect();
    }
  }, {});
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
  const selectedCheckbox = document.querySelector(".file-checkbox:checked");
  const fileIndex = Array.from(document.querySelectorAll(".file-checkbox")).indexOf(selectedCheckbox);
  const file = files[fileIndex];
  const oldCaption = file.caption;
  const newCaption = prompt("Enter a new caption for the image:", oldCaption);

  if (newCaption !== null && newCaption !== oldCaption) {
    try {
      await client.editMessageCaption("me", file.messageId, newCaption);
      console.log("Caption successfully renamed:", newCaption);
      refreshFilesAndFolders(); // Refresh the files and folders list
    } catch (error) {
      console.error("Error renaming caption:", error);
    }
  }
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});

// Add updateRenameButtonVisibility to the event listeners for the checkboxes


function updateDeleteButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    deleteButton.style.display = "block";
  } else {
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
    selectedFiles.push(Object.values(currentFolder.content).flat()[fileIndex]);
  }
  for (const file of selectedFiles) {
    try {
      const fileId = file.messageId;
      await client.deleteMessages("me", [fileId], {
        revoke: true,
      });
      console.log("Файл успешно удален:");  
    } catch (error) {
      console.error("Ошибка при удалении файла:", error);
    }
  }

  // Обновите список файлов после удаления
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack = [fileStructure, ...navigationStack.slice(1)];
  displayFiles(navigationStack[navigationStack.length - 1]);
});

async function displayFiles(folder) {
  const fileList = document.getElementById("file-list");
  fileList.innerHTML = "";
  console.log(folder.name);
  const currentFolderName = document.getElementById("currentfolder");
  const userPhoto = document.getElementById("user-photo");
  currentFolderName.textContent = folder.name;
  const backButton = document.getElementById("back-button");
  currentFiles = files.map((file, index) => ({ file, index }));

  if (navigationStack.length <= 1) { // Если в стеке только корневая папка
    backButton.style.display = "none";
    userPhoto.style.display = "block";
  } else {
    backButton.style.display = "block";
    userPhoto.style.display = "none";
    backButton.onclick = () => {
      navigationStack.pop(); // Удаляем текущую папку из стека
      displayFiles(navigationStack[navigationStack.length - 1]); // Возвращаемся к предыдущей папке
    };
  }

  for (const itemName in folder.content) {
    const items = folder.content[itemName];

    if (Array.isArray(items) && items[0].type === "file") {
      for (const item of items) {
        const listItem = document.createElement("li");
        listItem.className = "li-tile";
        const file = item.file;
        const thumbnailUrl = await getThumbnailUrl(file);
        const divElement = document.createElement("div");
        const checkbox = document.createElement("input");
        const filename = document.createElement("div"); // Создаем элемент <p> для имени файла
        checkbox.type = "checkbox";
        checkbox.className = "file-checkbox";
        divElement.style.backgroundImage = `url(${thumbnailUrl})`;
        divElement.className = "image-tile";
        lazyLoadImage(divElement, file);
        listItem.appendChild(divElement);
        divElement.addEventListener("click", () => openModal(item));

        // Устанавливаем имя файла и добавляем его к элементу списка
        filename.textContent = item.name || "Noname"; // Используйте подпись сообщения для имени файла
        filename.className = "file-name"; // Добавляем класс для стилизации имени файла
        listItem.appendChild(filename);
        
        // Добавляем обработчик событий для чекбоксов
        checkbox.addEventListener("change", updateDeleteButtonVisibility);
        checkbox.addEventListener("change", updateMoveButtonVisibility);
        checkbox.addEventListener("change", updateRenameButtonVisibility);
        listItem.appendChild(checkbox);

        fileList.appendChild(listItem);
      }
    } else if (items.type === "folder") {
      const listItem = document.createElement("li");
      listItem.className = "li-tile";
      const divElement = document.createElement("div");
      const folderTile = document.createElement("div");
      folderTile.className = "folder";
      divElement.textContent = items.name;
      divElement.className = "file-name";
      listItem.appendChild(folderTile);
      listItem.appendChild(divElement);
      listItem.onclick = () => {
        navigationStack.push(items); // Добавляем открытую папку в стек
        displayFiles(items);
      };
      fileList.appendChild(listItem);
    }
  }

  // Обновляем видимость кнопки удаления после изменения списка файлов
  updateDeleteButtonVisibility();
}
function arrayBufferFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
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
async function uploadFile() {
  const currentFolder = navigationStack[navigationStack.length - 1];
  const currentFolderPath = navigationStack
    .slice(1)
    .map((folder) => folder.name)
    .join("/");
  const caption = currentFolderPath + "/" + fileInput.files[0].name;

  try {
    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();
    const toUpload = new CustomFile(file.name, file.size, "", arrayBuffer);

    const result = await client.sendFile("me", {
      file: toUpload,
      caption: caption,
      workers: 1,
    });

    console.log("Файл успешно загружен:", result);
    refreshFilesAndFolders(); // Обновляем список файлов и папок
  } catch (error) {
    console.error("Ошибка при загрузке файла:", error);
  }
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

function updateMoveButtonVisibility() {
  const selectedCheckboxesCount = document.querySelectorAll(".file-checkbox:checked").length;
  if (selectedCheckboxesCount > 0) {
    moveButton.style.display = "block";
  } else {
    moveButton.style.display = "none";
  }
}
moveButton.addEventListener("click", async () => {
  const folderList = document.getElementById("folder-list");
  folderList.innerHTML = "";

  for (const folderName in fileStructure.content) {
    const folder = fileStructure.content[folderName];

    if (folder.type === "folder") {
      const listItem = document.createElement("li");
      listItem.className = "folder";
      const divElement = document.createElement("div");
      divElement.textContent = folder.name;
      divElement.className = "folder-tile";
      listItem.appendChild(divElement);

      listItem.onclick = async () => {
        const newFolderPath = folder.name;

        // Перемещение выбранных файлов в новую папку
        for (const file of filesToMove) {
          try {
            const messageId = file.messageId;
            const newCaption = newFolderPath + "/" + file.name;
            await client.editMessageCaption("me", messageId, newCaption);
            console.log("Файл успешно перемещен:", file.name);
          } catch (error) {
            console.error("Ошибка при перемещении файла:", error);
          }
        }

        // Обновление списка файлов после перемещения
        const files = await getFilesFromMeDialog();
        const fileStructure = buildFileStructure(files);
        navigationStack = [fileStructure, ...navigationStack.slice(1)];
        displayFiles(navigationStack[navigationStack.length - 1]);
      };

      folderList.appendChild(listItem);
    }
  }

  // Показать список папок для выбора
  document.getElementById("folder-selection-modal").style.display = "block";
});

async function init() {
  await client.connect();
  setUserProfilePhotoAsBackground();
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack.push(fileStructure); // Добавляем корневую папку в историю навигации
  displayFiles(fileStructure);
  const fileInput = document.getElementById("file-input");
  const uploadButton = document.getElementById("upload-button");

  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (event) => {
    if (event.target.files.length > 0) {
      const file = event.target.files[0];
      await uploadFile(file);
      // Обновите список файлов после загрузки
      const files = await getFilesFromMeDialog();
      const fileStructure = buildFileStructure(files);
      navigationStack = [fileStructure, ...navigationStack.slice(1)];
      displayFiles(navigationStack[navigationStack.length - 1]);
    }
  });
}


init(); 