const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
let files = [];
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

async function getFilesFromMeDialog() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId);

  files = messages
    .filter((message) => {
      if (message.media) {
        if (message.media instanceof Api.MessageMediaPhoto) {
          return true;
        } else if (message.media instanceof Api.MessageMediaDocument) {
          const document = message.media.document;
          console.log(document);
          return document.mime_type && document.mime_type.startsWith("video/");
        }
      }
      return false;
    })
    .map((message) => {
      if (message.media instanceof Api.MessageMediaPhoto) {
        return message.media.photo;
      } else if (message.media instanceof Api.MessageMediaDocument) {
        return message.media.document;
      }
    });

  files.sort((a, b) => b.date - a.date);
  return files;
}


const modal = document.getElementById("modal");
const modalImage = document.getElementById("modal-image");
const closeBtn = document.querySelector(".close");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

async function loadImage(file) {
  if (file instanceof Api.Document) {
    const buffer = await client.downloadMedia(file, {});
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const videoUrl = "data:video/mp4;base64," + base64;

    const videoElement = document.createElement("video");
    videoElement.src = videoUrl;
    videoElement.controls = true;
    console.log(videoUrl);
    const videoContainer = document.getElementById("video-container");
    videoContainer.innerHTML = "";
    videoContainer.appendChild(videoElement);
  } else if (file instanceof Api.Photo) {
    const buffer = await client.downloadMedia(file, {});

    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const fullImageUrl = "data:image/jpeg;base64," + base64;

    file.src = fullImageUrl;
  }
}

function openModal(index) {
  currentImageIndex = index;

  if (!files[currentImageIndex].src) {
    loadImage(files[currentImageIndex]);
  }

  if (files[currentImageIndex] instanceof Api.Document) {
    modalImage.style.display = "none";
    videoContainer.style.display = "block";
  } else if (files[currentImageIndex] instanceof Api.Photo) {
    modalImage.src = files[currentImageIndex].src;
    modalImage.style.display = "block";
    videoContainer.style.display = "none";
  }

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
  const fileId = file.id.toString();

  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting) {
      try {
        //imageDivElement.style.backgroundColor = `rgb(135,116,225)`;
        const buffer = await client.downloadMedia(file, {});
        fullImageUrl = URL.createObjectURL(
          new Blob([buffer], { type: 'image/png' } /* (1) */)
        );
        imageDivElement.style.backgroundImage = `url(${fullImageUrl})`;
        file.src = fullImageUrl;
      } catch (error) {
        console.error(`Error loading image ${fileId}: ${error}`);
        // Handle image loading error as needed, e.g. show a fallback image
      }
      observer.disconnect();
    }
  }, {});

  // Start observing the imageDivElement
  observer.observe(imageDivElement);
}

async function displayFiles(files) {
  const fileList = document.getElementById("file-list");
  const groupDuration = 10 * 24 * 60 * 60 * 1000;
  let currentGroupStartDate = new Date(files[0].date * 1000);

  function addGroupHeader(date) {
    const groupHeader = document.createElement("h3");
    groupHeader.textContent = date.toLocaleDateString();
    groupHeader.className = "time-top";
    fileList.appendChild(groupHeader);
  }

  addGroupHeader(currentGroupStartDate);

  for (const [index, file] of files.entries()) {
    const nextIndex = index + 1;
    const fileDate = new Date(file.date * 1000);
    let nextFileDate = null;

    if (nextIndex < files.length) {
      nextFileDate = new Date(files[nextIndex].date * 1000);
    }

    if (currentGroupStartDate - fileDate >= groupDuration) {
      if (nextFileDate && currentGroupStartDate - nextFileDate >= groupDuration) {
        currentGroupStartDate = nextFileDate;
        addGroupHeader(currentGroupStartDate);
      } else {
        currentGroupStartDate = fileDate;
        addGroupHeader(currentGroupStartDate);
      }
    }

    const listItem = document.createElement("li");
    listItem.className = "li-tile";

    if (file instanceof Api.Photo) {
      const thumbnailUrl = await getThumbnailUrl(file);

      // Create a div element and set its background-image CSS property
      const divElement = document.createElement("div");
      divElement.style.backgroundImage = `url(${thumbnailUrl})`;
      divElement.className = "image-tile";

      // Lazy load the full-resolution image

      // Add event listener to open the modal
      divElement.addEventListener("click", () => openModal(index));

      listItem.appendChild(divElement);
    } else if (file instanceof Api.Document) {
      const videoIcon = document.createElement("i");
      videoIcon.className = "fas fa-video";

      const divElement = document.createElement("div");
      divElement.className = "video-tile";
      divElement.appendChild(videoIcon);

      // Add event listener to open the modal
      divElement.addEventListener("click", () => openModal(index));

      listItem.appendChild(divElement);
    }

    fileList.appendChild(listItem);
    lazyLoadImage(listItem.firstChild, file);
  }
}

async function setUserProfilePhotoAsBackground() {
  const buffer = await client.downloadProfilePhoto('me')
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const fullImageUrl = "data:image/jpeg;base64," + base64;
  const userPhotoElement = document.getElementById("user-photo");
  userPhotoElement.style.backgroundImage = `url(${fullImageUrl})`;
}

async function init() {
  await client.connect();
  setUserProfilePhotoAsBackground();
  const files = await getFilesFromMeDialog();
  displayFiles(files);
}

init();   