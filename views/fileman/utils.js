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

// upload menu

uploadMenuButton.addEventListener("click", () => {
  uploadMenu.style.transform = "translate(0px, 0px)";
  uploadMenuButton.style.transform = "translate(0px, 300px)";
});
closeUploadButton.addEventListener("click", () => {
  uploadMenu.style.transform = "translate(0px, 500px)";
  uploadMenuButton.style.transform = "translate(0px, 0px)";
});
uploadButton.addEventListener("click", () => {
  fileInput.click();
});

// Side Bar
let sideBarOpen = false;
userPhoto.addEventListener("click", async () => {
  sideBarOpen = true;
  blackScreen.style.visibility = "visible";
  blackScreen.style.background = "rgb(0 0 0 / 30%)";
  sideBar.style.left = "0";
});
let userListOpen = false;
userChoose.addEventListener("click", async () => {
  var userCount = userList.childElementCount;
  var minHeight = 50;
  var vwMultiplier = 8;

  var heightValue =
    "min(" + minHeight * userCount + "px," + vwMultiplier * userCount + "vw)";
  if (userListOpen === false) {
    userChoose.style.transform = "scale(-1)";
    userList.style.height = heightValue;
    userListOpen = true;
  } else {
    userChoose.style.transform = "scale(1)";
    userList.style.height = "0vw";
    userListOpen = false;
  }
});
document.addEventListener("click", (event) => {
  if (
    sideBarOpen &&
    !sideBar.contains(event.target) &&
    event.target !== userPhoto
  ) {
    sideBarOpen = false;
    blackScreen.style.visibility = "hidden";
    blackScreen.style.background = "none";
    sideBar.style.left = "-65vw";
  }
});
