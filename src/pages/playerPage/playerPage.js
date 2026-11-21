const metaData = JSON.parse(sessionStorage.getItem("pageArgs") || "{}");
console.log(metaData);
const nowLoading = document.getElementById("div-nowLoading");
const statusText = document.getElementById("span-status");
const progressBar = document.getElementById("div-progressBar");

let detailsPromise;
function getMediaDetails() {
  detailsPromise ??= (async () => {
    try {
      if (!metaData.MediaType || !metaData.MediaId) return null;
      const apiKey = await window.electronAPI.getTMDBAPIKEY();
      const res = await fetch(
        `https://api.themoviedb.org/3/${metaData.MediaType}/${metaData.MediaId}?api_key=${apiKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
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

function toSrc(p) {
  if (!p) return null;
  return /^(https?:|file:|data:)/.test(p) ? p : `file://${encodeURI(p)}`;
}

function setBackgroundImage() {
  const sources = [
    toSrc(metaData.bgImagePath),
    metaData.bgImageUrl?.replace(/([^:])\/\//g, "$1/"),
  ].filter(Boolean);

  const apply = (src) => {
    const style = document.documentElement.style;
    style.backgroundImage = `url("${src}")`;
    style.backgroundRepeat = "no-repeat";
    style.backgroundPosition = "center center";
    style.backgroundSize = "cover";
    style.backgroundAttachment = "fixed";
  };

  (function tryNext(i) {
    if (i >= sources.length) return;
    const img = new Image();
    img.onload = () => apply(sources[i]);
    img.onerror = () => tryNext(i + 1);
    img.src = sources[i];
  })(0);
}

function setPoster() {
  const poster = document.getElementById("img-poster");
  const sources = [toSrc(metaData.posterPath), metaData.posterUrl].filter(Boolean);
  if (!sources.length) return;

  let i = 0;
  poster.onerror = () => {
    if (++i < sources.length) poster.src = sources[i];
    else poster.hidden = true;
  };
  poster.src = sources[0];
  poster.hidden = false;
}

function renderMediaInfo() {
  const title = metaData.Title || metaData.title || metaData.MediaTitle;
  if (title) {
    document.title = `${title} - Nomixo`;
    document.getElementById("h-title").textContent = title;
  }

  const { seasonNumber, episodeNumber } = metaData;
  document.getElementById("p-episode").textContent =
    seasonNumber != null && episodeNumber != null
      ? `S${seasonNumber} E${episodeNumber}`
      : "";

  const meta = document.getElementById("p-meta");
  meta.textContent = [metaData.Year || metaData.year, metaData.Quality]
    .filter(Boolean)
    .join("  |  ");
  const runtimeEl = document.createElement("span");
  runtimeEl.id = "span-runtime";
  runtimeEl.className = "skeleton skeleton-inline";
  meta.append(meta.textContent ? "  |  " : "", runtimeEl);

  const overview = document.getElementById("p-overview");
  overview.textContent = "";
  overview.classList.add("loading");
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("role", "status");
  spinner.setAttribute("aria-label", "Loading description");
  overview.append(spinner);

  setPoster();
  nowLoading.classList.add("ready");

  enrichFromTMDB();
}

async function enrichFromTMDB() {
  const data = await getMediaDetails();
  const overview = document.getElementById("p-overview");
  const runtimeEl = document.getElementById("span-runtime");

  overview.classList.remove("loading");
  overview.textContent = data?.overview || "";
  overview.classList.remove("fade-in");
  void overview.offsetWidth;
  overview.classList.add("fade-in");

  const runtime = data?.runtime
    ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`
    : data?.episode_run_time?.[0]
      ? `${data.episode_run_time[0]}m`
      : "";

  if (runtimeEl) {
    if (runtime) {
      runtimeEl.classList.remove("skeleton", "skeleton-inline");
      runtimeEl.textContent = runtime;
    } else {
      runtimeEl.previousSibling?.remove();
      runtimeEl.remove();
    }
  }

  if (data && !metaData.posterPath && !metaData.posterUrl && data.poster_path) {
    const poster = document.getElementById("img-poster");
    poster.src = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
    poster.hidden = false;
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

    } else if (report.stage === "next-episode-info") {
      const title = report?.data?.Title;
      const seasonNumber = report?.data?.seasonNumber;
      const episodeNumber = report?.data?.episodeNumber;
      const year = report?.data?.Year

      document.getElementById("h-title").textContent = title;
      document.getElementById("p-episode").textContent =
        seasonNumber != null && episodeNumber != null ? `S${seasonNumber} E${episodeNumber}` : "";
      document.getElementById("p-meta").textContent = year;
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
