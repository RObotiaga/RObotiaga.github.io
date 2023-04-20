const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
let files = [];
let navigationStack = [];

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

async function getFilesFromMeDialog() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId, { limit: 100 });

  files = messages
    .filter((message) => message.media && message.media instanceof Api.MessageMediaPhoto)
    .map((message) => ({
      photo: message.media.photo,
      caption: message.message,
      date: message.date,
    }));
  files.sort((a, b) => b.date - a.date);
  return files;
}
function buildFileStructure(files) {
  const root = {
    name: "Main",
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
    currentFolder.content[fileName] = {
      name: fileName,
      type: "file",
      file: file.photo,
    };
  }
  return root;
}


const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
const closeBtn = document.querySelector(".close");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

function openModal(index) {
  currentImageIndex = index;
  modalImage.src = files[currentImageIndex].src;
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

function lazyLoadImage(imageDivElement, file) {
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      const buffer = await client.downloadMedia(file, {});
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const fullImageUrl = "data:image/jpeg;base64," + base64;
      imageDivElement.style.backgroundImage = `url(${fullImageUrl})`;
      file.src = fullImageUrl;
      observer.disconnect();
    }
  }, {});
  observer.observe(imageDivElement);
}

async function displayFiles(folder) {
  const fileList = document.getElementById("file-list");
  fileList.innerHTML = "";

  const backButton = document.getElementById("back-button");

  if (navigationStack.length <= 1) { // Если в стеке только корневая папка
    backButton.style.display = "none";
  } else {
    backButton.style.display = "block";
    backButton.onclick = () => {
      navigationStack.pop(); // Удаляем текущую папку из стека
      displayFiles(navigationStack[navigationStack.length - 1]); // Возвращаемся к предыдущей папке
    };
  }

  for (const itemName in folder.content) {
    const item = folder.content[itemName];
    const listItem = document.createElement("li");

    if (item.type === "file") {
      listItem.className = "li-tile";
      const file = item.file;
      const thumbnailUrl = await getThumbnailUrl(file);
      const divElement = document.createElement("div");
      divElement.style.backgroundImage = `url(${thumbnailUrl})`;
      divElement.className = "image-tile";
      lazyLoadImage(divElement, file);
      listItem.appendChild(divElement);
    } else if (item.type === "folder") {
      listItem.className = "folder";
      const divElement = document.createElement("div");
      divElement.textContent = item.name;
      divElement.className = "folder-tile";
      listItem.appendChild(divElement);
      listItem.onclick = () => {
        navigationStack.push(item); // Добавляем открытую папку в стек
        displayFiles(item);
      };
    }

    fileList.appendChild(listItem);
  }
}
async function init() {
  await client.connect();
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  navigationStack.push(fileStructure); // Добавляем корневую папку в историю навигации
  displayFiles(fileStructure);
}

init(); 