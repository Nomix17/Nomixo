const metaData = JSON.parse(sessionStorage.getItem("pageArgs") || "{}");

const loadingGif = document.getElementById("LoadingGif");

setBackgroundImage();
handleFullScreenIcon();
loadVideo();
monitoringErrorsCummingFromMainProcess();

document.body.addEventListener("dblclick", () => {
  fullscreenClicked();
});

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "Escape":
      event.preventDefault();
      goBack();
      break;
    case "f":
      event.preventDefault();
      fullscreenClicked();
      break;
  }
});

async function loadVideo() {
  const apiKeyPromise = window.electronAPI.getTMDBAPIKEY();
  if (!metaData.IMDB_ID) metaData.IMDB_ID = await getIMDB_ID(metaData.MediaType, metaData.MediaId, apiKeyPromise);

  const usingMagnet = !metaData.downloadPath;
  playVideoInMpv(usingMagnet);
}

function playVideoInMpv(playMagnet) {
  if (playMagnet) {
    window.electronAPI.StreamTorrentOverMpv(metaData);
  } else {
    window.electronAPI.PlayVideoOverMpv(metaData);
  }
}

function goBack() {
  window.electronAPI.goBack();
}

function monitoringErrorsCummingFromMainProcess() {
  window.electronAPI.getFetchingTorrentErrors((err) => {
    console.error(err);
    createWarningDiv(err);
  });
}

function getBackgroundImage() {
  const fetchMediaBackgroundImage = async () => {
    try {
      const apiKey = await window.electronAPI.getTMDBAPIKEY();
      const url = `https://api.themoviedb.org/3/${metaData.MediaType}/${metaData.MediaId}?api_key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.backdrop_path) return `https://image.tmdb.org/t/p/original/${data.backdrop_path}`;
    } catch (err) {}
  };
  return metaData.bgImagePath || metaData.bgImageUrl || fetchMediaBackgroundImage();
}

async function setBackgroundImage() {
  const bgImage = await getBackgroundImage();
  if (!bgImage) return;
  document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bgImage}')`;
  document.documentElement.style.backgroundRepeat = "no-repeat";
  document.documentElement.style.backgroundPosition = "center center";
  document.documentElement.style.backgroundSize = "cover";
  document.documentElement.style.backgroundAttachment = "fixed";
}

function createWarningDiv(errMessage) {
  const WarningDiv = document.getElementById("div-SomethingWentWrong");
  WarningDiv.innerHTML = errMessage;
  loadingGif.style.display = "none";
  WarningDiv.style.display = "flex";
}
