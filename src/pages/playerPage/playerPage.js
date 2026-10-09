const metaData = JSON.parse(sessionStorage.getItem("pageArgs") || "{}");

const nowLoading = document.getElementById("div-nowLoading");
const statusText = document.getElementById("span-status");
const progressBar = document.getElementById("div-progressBar");

let detailsPromise;
function getMediaDetails() {
  detailsPromise ??= (async () => {
    try {
      if (!metaData.MediaType || !metaData.MediaId) return null;
      const apiKey = await window.electronAPI.getTMDBAPIKEY();
      const res = await fetch(`https://api.themoviedb.org/3/${metaData.MediaType}/${metaData.MediaId}?api_key=${apiKey}`);
      return await res.json();
    } catch (err) {
      return null;
    }
  })();
  return detailsPromise;
}

startProgressAnimation();
setBackgroundImage();
renderMediaInfo();
monitoringTorrentStreamingReports();
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

async function getBackgroundImage() {
  if (metaData.bgImagePath || metaData.bgImageUrl) return metaData.bgImagePath || metaData.bgImageUrl;
  const data = await getMediaDetails();
  if (data?.backdrop_path) return `https://image.tmdb.org/t/p/original${data.backdrop_path}`;
}

async function setBackgroundImage() {
  const bgImage = await getBackgroundImage();
  if (!bgImage) return;
  const style = document.documentElement.style;
  style.backgroundImage = `url('${bgImage}')`;
  style.backgroundRepeat = "no-repeat";
  style.backgroundPosition = "center center";
  style.backgroundSize = "cover";
  style.backgroundAttachment = "fixed";
}

async function renderMediaInfo() {
  const data = await getMediaDetails();

  const title = metaData.title || metaData.MediaTitle || metaData.Title || data?.title || data?.name;
  if (!title) return nowLoading.classList.add("ready");

  document.getElementById("h-title").textContent = title;

  const date = data?.release_date || data?.first_air_date || "";
  const year = metaData.year || date.slice(0, 4);
  const season = metaData.season ?? metaData.Season;
  const episode = metaData.episode ?? metaData.Episode;
  const episodeLabel = season != null && episode != null ? `Season ${season}, Episode ${episode}` : "";
  const runtime = data?.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : "";
  document.getElementById("p-meta").textContent = [episodeLabel, year, runtime].filter(Boolean).join("  |  ");

  document.getElementById("p-overview").textContent = data?.overview || "";

  const posterPath = metaData.posterPath || (data?.poster_path && `https://image.tmdb.org/t/p/w500${data.poster_path}`);
  const poster = document.getElementById("img-poster");
  if (posterPath) {
    poster.onload = () => nowLoading.classList.add("ready");
    poster.onerror = () => { poster.hidden = true; nowLoading.classList.add("ready"); };
    poster.src = posterPath;
    poster.hidden = false;
  } else {
    nowLoading.classList.add("ready");
  }
}

const formatSpeed = (bytesPerSec) => {
  const mb = bytesPerSec / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${Math.round(bytesPerSec / 1024)} KB/s`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const STAGE_LABELS = {
  trackers: "Preparing the stream",
  connecting: "Looking for peers",
  peers: (d) => (d?.peers ? `Connected to ${plural(d.peers, "peer")}` : "Looking for peers"),
  metadata: "Reading torrent info",
  subtitles: "Fetching subtitles",
  launching: "Opening the player",
  "load-failed": "Could not start the stream",
  buffering: (d) =>
    d?.stalledFor >= 10
      ? `No data received for ${d.stalledFor}s, the torrent may have no active seeders`
      : d?.speed > 0
      ? `Buffering at ${formatSpeed(d.speed)} from ${plural(d.peers, "peer")}`
      : d?.peers > 0
        ? `Buffering, waiting for data from ${plural(d.peers, "peer")}`
        : "Buffering",
  playing: "Starting playback",
};

function stageToLabel({ stage, data }) {
  const label = STAGE_LABELS[stage];
  if (label) return typeof label === "function" ? label(data) : label;
  const raw = String(stage ?? "").trim();
  if (!raw) return null;
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function loadFailureDetails(data) {
  if (data?.reason === "timeout")
    return {
      title: "The stream timed out",
      message: `No data arrived from the torrent (${plural(data.peers ?? 0, "peer")} connected). It may have no active seeders, so try another source.`,
    };
  return {
    title: "Couldn't open the stream",
    message: "The player couldn't open the stream. Try again or pick another source.",
  };
}

function startProgressAnimation() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const animation = progressBar.animate(
    [{ transform: "translateX(-100%)" }, { transform: "translateX(250%)" }],
    { duration: 1500, iterations: Infinity, easing: "cubic-bezier(.65,0,.35,1)" }
  );
  animation.startTime = 0;
}

let statusTimeout;
function setStatus(text) {
  if (!text || text === statusText.textContent) return;
  clearTimeout(statusTimeout);
  statusText.classList.add("swap");
  statusTimeout = setTimeout(() => {
    statusText.textContent = text;
    statusText.classList.remove("swap");
  }, 250);
}

function monitoringTorrentStreamingReports() {
  window.electronAPI.getTorrentStreamingReport((report) => {
    console.log("torrent-streaming-report", report);
    if (report.stage === "load-failed") {
      const { title, message } = loadFailureDetails(report.data);
      return createWarningDiv(message, title);
    }
    setStatus(stageToLabel(report));
  });
}

function createWarningDiv(errMessage, title = "Couldn't start playback") {
  const WarningDiv = document.getElementById("div-SomethingWentWrong");
  document.getElementById("h-errorTitle").textContent = title;
  document.getElementById("p-errorMessage").innerHTML = errMessage;
  nowLoading.style.display = "none";
  WarningDiv.style.display = "flex";
}
