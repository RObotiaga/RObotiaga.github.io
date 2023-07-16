const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const bigInt = require("big-integer");

const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
const imageCache = new Map();
const lazyLoadPromises = [];

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

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

  async downloadPreview() {
    if (this.type === "video") {
      const [, thumb] = this.thumb;
      const buffer = await client.downloadMedia(this.message, { thumb });
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    } else if (this.type === "photo") {
      const buffer = await client.downloadMedia(this.file);
      return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
    }
  }

  async downloadFullFile(progressBar) {
    if (this.type === "video") {
      let totalSize = bigInt(0);
      let downloadedSize = bigInt(0);

      const buffer = await client.downloadMedia(this.file, {
        progressCallback: (downloaded, fullSize) => {
          downloadedSize = bigInt(downloaded);
          totalSize = bigInt(fullSize);
          const percentage = Number(
            ((downloadedSize * bigInt(100)) / totalSize).toString()
          );
          progressBar.value = percentage;
        },
      });

      progressBar.value = 100;
      progressBar.style.display = "none";
      return URL.createObjectURL(new Blob([buffer], { type: "video/mp4" }));
    } else if (this.type === "photo") {
      return this.getCachedImage;
    }
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

  const files = [...photos, ...videos].sort((a, b) => b.date - a.date);
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

    const fileName = path[path.length - 1];
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

  return root;
}
async function openModal(item) {
  if (Array.isArray(item.file)) {
    modalVideo.src = "";
    modalv.style.display = "block";

    const progressBar = document.getElementById("videoProgressBar");
    progressBar.value = 0;

    const videoSrc = await downloadVideoFile(item);
    modalVideo.src = videoSrc;
  } else {
    modalImage.src = item.file.src;
    modal.style.display = "block";
  }
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
  filename.textContent = item.caption || "NoName";
  filename.className = "file-name";
  listItem.appendChild(filename);
  fileList.appendChild(listItem);
  lazyLoadPromises.push(lazyLoadImage(divElement, item));
  divElement.addEventListener("click", () => openModal(fileItem));
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
}
async function displayFilesAndFolders(fileStructure) {
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
  const files = await getFilesFromMeDialog();
  const fileStructure = buildFileStructure(files);
  await displayFilesAndFolders(fileStructure);
}

main();
