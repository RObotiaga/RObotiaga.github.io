// TG client init

const apiId = 26855747;
const apiHash = "5bad5ec2aac0a32ab6d5db013f96a8ff";
const savedSession = localStorage.getItem("savedSession");
const stringSession = new StringSession(savedSession || "");
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

let ALBUMS;

const createAlbum = document.getElementById("create-album");
const backButton = document.getElementById("back-button");

// Create album
const messageIds = [38123, 38223, 38423, 38113, 34123];

// Structural functions

async function getAlbums() {
  const mePeerId = await client.getPeerId("me");
  const messages = await client.getMessages(mePeerId);

  const albums = messages
    .filter((message) => message.message?.startsWith("#Album "))
    .map((message) => ({
      message,
      type: "Album",
      name: getAlbumName(message.message),
      messageWithPhotoIds: extractMessageIDs(message.message),
      date: message.date,
      messageId: message.id,
    }));

  return albums.sort((a, b) => b.date - a.date);
}

function extractMessageIDs(inputString) {
  var regex = /\[([\d,]+)\]/;
  var match = regex.exec(inputString);

  if (match) {
    var idList = match[1].split(",").map(function (id) {
      return parseInt(id, 10);
    });
    return idList;
  } else {
    return [];
  }
}
function getAlbumName(caption) {
  var match = caption.match(/#Album name:(.*?) photos:/);

  if (match) {
    return match[1];
  } else {
    return "Имя альбома не найдено";
  }
}
async function createDivAlbum(album) {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  const divElement = document.createElement("div");
  const folderTile = document.createElement("div");
  folderTile.className = "album";
  const cover = await getMessageById(album.messageWithPhotoIds[0]);
  console.log(cover);
  const buffer = await client.downloadMedia(cover[0]);
  folderTile.style.backgroundImage = `url(${URL.createObjectURL(
    new Blob([buffer], { type: "image/png" })
  )})`;
  divElement.textContent = album.name;
  divElement.className = "file-name";
  listItem.appendChild(folderTile);
  listItem.appendChild(divElement);
  fileList.appendChild(listItem);
  listItem.addEventListener("click", async () => {
    await displayPhotos(album);
  });
  // onLongPress(listItem, () => {
  //   if (listItem.classList.contains("selected")) {
  //     listItem.classList.remove("selected");
  //     for (const item of getItemsInFolder(folder)) {
  //       selectedFiles.splice(
  //         findIndexByMessageId(selectedFiles, item.message.id),
  //         1
  //       );
  //     }
  //   } else {
  //     listItem.classList.add("selected");
  //     selectedFiles.push(...getItemsInFolder(folder));
  //   }
  //   updateActionButtonVisibility();
  // });
}
async function getMessageById(id) {
  const mePeerId = await client.getPeerId("me");
  const message = await client.getMessages(mePeerId, { ids: id });
  return message;
}
async function createPhotoElement(message) {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  const divElement = document.createElement("div");
  const filename = document.createElement("div");
  divElement.className = "image-tile";
  listItem.appendChild(divElement);
  filename.className = "file-name";
  listItem.appendChild(filename);
  fileList.appendChild(listItem);
  const buffer = await client.downloadMedia(message.media);
  divElement.style.backgroundImage = `url(${URL.createObjectURL(
    new Blob([buffer], { type: "image/png" })
  )})`;
  // lazyLoadPromises.push(lazyLoadImage(divElement, item));
  // listItem.addEventListener("click", () => openModal(item));
  // onLongPress(listItem, () => {
  //   if (listItem.classList.contains("selected")) {
  //     listItem.classList.remove("selected");
  //     selectedFiles.splice(
  //       findIndexByMessageId(selectedFiles, item.message.id),
  //       1
  //     );
  //   } else {
  //     listItem.classList.add("selected");
  //     selectedFiles.push(item);
  //   }
  //   updateActionButtonVisibility();
  // });
}
async function createAddPhotoButton() {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  listItem.id = "add-photo-button";
  const divElement = document.createElement("div");
  const filename = document.createElement("div");
  divElement.className = "create-photo image-tile";
  listItem.appendChild(divElement);
  filename.textContent = "Add photo";
  filename.className = "file-name";
  listItem.appendChild(filename);
  fileList.appendChild(listItem);
  listItem.addEventListener("click", async () => {
    document.location = "choosePhotos.html";
  });
}
async function createAlbumButton() {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  listItem.id = "create-album";
  const divElement = document.createElement("div");
  const folderTile = document.createElement("div");
  folderTile.className = "create-album image-tile";
  divElement.textContent = "Create Album";
  divElement.className = "file-name";
  listItem.appendChild(folderTile);
  listItem.appendChild(divElement);
  fileList.appendChild(listItem);
  listItem.addEventListener("click", async () => {
    const albumName = prompt("Введите название альбома");
    if (albumName === null) {
      return;
    }
    await client.sendMessage("me", {
      message: `#Album name:${albumName} photos:[${messageIds}]`,
    });
  });
}
function faceAlbumSection() {
  const weekHeader = document.createElement("h3");
  weekHeader.className = "time-top";
  weekHeader.textContent = "Faces";
  fileList.appendChild(weekHeader);
  startFaceScanButton();
}
async function startFaceScanButton() {
  const listItem = document.createElement("li");
  listItem.className = "li-tile";
  listItem.id = "create-album";
  const divElement = document.createElement("div");
  const folderTile = document.createElement("div");
  folderTile.className = "create-album image-tile";
  divElement.textContent = "Start scanning";
  divElement.className = "file-name";
  listItem.appendChild(folderTile);
  listItem.appendChild(divElement);
  fileList.appendChild(listItem);
  listItem.addEventListener("click", async () => {
    console.log("Started");
  });
}
async function startFaceScan() {
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
  const allPhoto = [...photos, ...docPhoto]
}
async function displayAlbums(albums) {
  fileList.innerHTML = "";
  for (const album of albums) {
    await createDivAlbum(album);
  }
  backButton.style.display = "none";
  await createAlbumButton();
  faceAlbumSection();
}
async function displayPhotos(album) {
  fileList.innerHTML = "";
  currentFolderName.textContent = album.name;
  backButton.style.display = "flex";
  backButton.onclick = async () => {
    await displayAlbums(ALBUMS);
  };
  for (const messageId of album.messageWithPhotoIds) {
    const message = await getMessageById(messageId);
    // console.log(message);
    await createPhotoElement(message[0]);
  }
  await createAddPhotoButton();
}
async function main() {
  await client.connect();
  ALBUMS = await getAlbums();
  displayAlbums(ALBUMS);
}

main();
