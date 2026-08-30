const metaData = JSON.parse(sessionStorage.getItem("pageArgs") || "{}");
console.log(metaData);
const DEFAULT_VOLUME = 0.5;
const CONTROLS_HIDE_DELAY_MS = 1000;
const PLAYBACK_SAVE_INTERVAL_MS = 10000;
const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.1;

const SUB_SIZE_STEP_PERCENT = 10;
const SUB_SIZE_MIN_PERCENT = -100;
const SUB_SIZE_MAX_PERCENT = 200;
const SUB_DELAY_STEP_MS = 100;

let subsDelay = 0; // ms
let defaultFontSize = 30; // px
let subsSizeOffsetPercent = 0;

let oldVolume = null;
let mouseHoveringOnControlDiv = false;
let videoIsPlaying = false;

let SubsStruct = [];
let subtitlesArray = [];

let controlsHideTimeout;

const TopButtonsContainer = document.getElementById("div-topButtonsContainer");
const MiddleContainer = document.getElementById("div-videoContainer");
const BottomButtonsContainer = document.getElementById("div-bottomButtonsContainer");
const SubDivDisplay = document.getElementById("div-Subtitles");
const loadingGif = document.getElementById("LoadingGif");
const VideoElement = document.getElementsByTagName("video")[0];
const VideoSlider = document.getElementById("input-videoSlider");
const VideoPositionElement = document.getElementById("p-videoPosition");
const VideoDurationElement = document.getElementById("p-videoDuration");
const VolumeButton = document.getElementById("btn-VolumeButton");
const VolumeSliderElement = document.getElementById("input-volumeSlider");
const switchToggle = document.getElementById("toggle-subs");
const SubButton = document.getElementById("btn-OpenSubtitle");
const SubDiv = document.getElementById("div-MainSubtitleContainer");
const SubSizeDivInput = document.getElementById("div-subSize").querySelector("input");
const SubDelayDivInput = document.getElementById("div-subDelay").querySelector("input");
const bottomSubElement = document.getElementById("div-BottomSubContainer");
const SubsListDiv = document.getElementById("div-subsList");

const sliderMaxValue = VideoSlider.max;
VideoElement.volume = DEFAULT_VOLUME;


setBackgroundImage();
loadSubSettings();
loadVideo();

SubSizeDivInput.value = "+0%";
SubDelayDivInput.value = "+0ms";

repositionSubDiv();

monitoringErrorsCummingFromMainProcess();
monitorMsgFromMainProcess();
loadIconsDynamically();

TopButtonsContainer.addEventListener("mouseenter", () => { mouseHoveringOnControlDiv = true; });
TopButtonsContainer.addEventListener("mouseleave", () => { mouseHoveringOnControlDiv = false; });
BottomButtonsContainer.addEventListener("mouseenter", () => { mouseHoveringOnControlDiv = true; });
BottomButtonsContainer.addEventListener("mouseleave", () => { mouseHoveringOnControlDiv = false; });

window.addEventListener("mousemove", () => {
  clearTimeout(controlsHideTimeout);

  TopButtonsContainer.style.top = "0";
  BottomButtonsContainer.style.bottom = "0";
  SubDiv.style.bottom = BottomButtonsContainer.getBoundingClientRect().height + 10 + "px";
  SubDivDisplay.style.bottom = BottomButtonsContainer.getBoundingClientRect().height + "px";

  controlsHideTimeout = setTimeout(() => {
    const shouldHideControls = !mouseHoveringOnControlDiv && SubDiv.classList.contains("hideElement") && videoIsPlaying;
    if (shouldHideControls) {
      TopButtonsContainer.style.top = "-150%";
      BottomButtonsContainer.style.bottom = "150%";
      SubDivDisplay.style.bottom = "5%";
    }
  }, CONTROLS_HIDE_DELAY_MS);
});

window.addEventListener("mousedown", hideSubDiv);
window.addEventListener("resize", repositionSubDiv);

VideoElement.addEventListener("pause", () => ChangePauseUnpauseIcons(false));
VideoElement.addEventListener("play", () => ChangePauseUnpauseIcons(true));
VideoElement.addEventListener("playing", () => { loadingGif.style.display = "none"; });
VideoElement.addEventListener("waiting", () => { loadingGif.style.display = "block"; });

VideoElement.addEventListener("timeupdate", () => {
  if (isFinite(VideoElement.duration) && isFinite(VideoSlider.value)) {
    VideoSlider.value = (VideoElement.currentTime / VideoElement.duration) * sliderMaxValue;
    VideoDurationElement.innerText = gettingformatedTime(VideoElement.duration);
    VideoPositionElement.innerText = gettingformatedTime(VideoElement.currentTime);
  }
});

VideoElement.addEventListener("loadedmetadata", async () => {
  const oldPlayBackPosition = await getLatestPlayBackPosition();
  VideoElement.currentTime = oldPlayBackPosition;

  setInterval(() => {
    const lastPbPosition = parseInt(VideoElement.currentTime);
    updateLastSecondBeforeQuit(lastPbPosition);
  }, PLAYBACK_SAVE_INTERVAL_MS);
}, { once: true });

VideoElement.addEventListener("enterpictureinpicture", () => {
  VideoElement.style.display = "none";
  document.getElementById("picture-in-picture-indicator-text").style.display = "block";
  document.getElementById("img-OpenPIP").src = "../../../assets/icons/closePIP.png";
});

VideoElement.addEventListener("leavepictureinpicture", () => {
  VideoElement.style.display = "block";
  document.getElementById("picture-in-picture-indicator-text").style.display = "none";
  document.getElementById("img-OpenPIP").src = "../../../assets/icons/PIP.png";
});

MiddleContainer.addEventListener("dblclick", () => {
  fullscreenClicked();
});

VolumeSliderElement.addEventListener("input", () => {
  VideoElement.muted = false;
  if (parseInt(VolumeSliderElement.value) === 0) oldVolume = 1;
  VideoElement.volume = VolumeSliderElement.value / 100;
  updateVolumeIcons();
});

VideoSlider.addEventListener("input", () => {
  if (isFinite(VideoElement.duration) && isFinite(VideoSlider.value)) {
    VideoElement.currentTime = (VideoSlider.value * VideoElement.duration) / sliderMaxValue;
  }
});

window.addEventListener("keydown", (event) => {
  let stopPropagation = true;

  const typingInField = (event.target.tagName === "INPUT" && event.target.type !== "range")
    || event.target.tagName === "TEXTAREA";
  if (typingInField) return;

  switch (event.key) {
    case "Escape":
      window.electronAPI.goBack();
      break;
    case "ArrowUp":
      VideoElement.volume = Math.min(1, VideoElement.volume + VOLUME_STEP);
      break;
    case "ArrowDown":
      VideoElement.volume = Math.max(0, VideoElement.volume - VOLUME_STEP);
      break;
    case "ArrowRight":
      VideoElement.currentTime += SEEK_STEP_SECONDS;
      break;
    case "ArrowLeft":
      VideoElement.currentTime -= SEEK_STEP_SECONDS;
      break;
    case " ":
      TogglePauseUnpause();
      break;
    case "f":
      fullscreenClicked();
      break;
    case "p":
      togglePIP();
      break;
    case "m":
      if (oldVolume !== null) {
        VideoElement.volume = oldVolume === 0 ? 1 : oldVolume;
        oldVolume = null;
      } else {
        oldVolume = VideoElement.volume;
        VideoElement.volume = 0;
      }
      break;
    default:
      stopPropagation = false;
  }

  if (event.key === "Tab" || event.key === "Super" || event.key === "Alt") {
    event.preventDefault();
  }

  VolumeSliderElement.value = VideoElement.volume * 100;
  updateVolumeIcons();

  if (stopPropagation) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

switchToggle.addEventListener("change", (event) => {
  bottomSubElement.classList.toggle("hideElement");
  SubsStruct = [];
  SubDivDisplay.innerHTML = "";
  Array.from(SubsListDiv.children).forEach(element => element.classList.remove("active"));

  event.stopImmediatePropagation();
});

[SubSizeDivInput, SubDelayDivInput].forEach(subInputElement => {
  subInputElement.addEventListener("focus", () => {
    const formatedValue = getNumberFromStringInput(subInputElement.value);
    subInputElement.setAttribute("old_value", formatedValue);
  });

  subInputElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") subInputElement.blur();
  });
});

SubSizeDivInput.addEventListener("blur", () => {
  const inputedValue = getValueForSubInputConfiguration(SubSizeDivInput);
  const currentFontSize = defaultFontSize + (defaultFontSize * Number(inputedValue)) / 100 + "px";

  SubDivDisplay.style.fontSize = currentFontSize;
  subsSizeOffsetPercent = Number(inputedValue);
  SubSizeDivInput.value = `${inputedValue}%`;
});

SubDelayDivInput.addEventListener("blur", () => {
  const inputedValue = getValueForSubInputConfiguration(SubDelayDivInput);
  subsDelay = Number(inputedValue);
  SubDelayDivInput.value = `${inputedValue}ms`;
});

async function loadVideo() {
  const apiKeyPromise = window.electronAPI.getTMDBAPIKEY();
  if (!metaData.IMDB_ID) metaData.IMDB_ID = await getIMDB_ID(metaData.MediaType, metaData.MediaId, apiKeyPromise);

  const usingMagnet = !metaData.downloadPath;
  const useExternalPlayer = metaData.playerType === "external" || metaData.playerType == null;

  if (useExternalPlayer) {
    playVideoInMpv(usingMagnet);
    return;
  }

  if (usingMagnet) {
    await loadRemoteVideo();
  } else {
    await loadLocalVideo();
  }
}

async function loadRemoteVideo() {
  const subs = await window.electronAPI.fetchSubtitles({
    IMDB_ID: metaData.IMDB_ID,
    seasonNumber: metaData.seasonNumber,
    episodeNumber: metaData.episodeNumber 
  });
  subtitlesArray = subs;
  insertLanguageButton(subs);
  getSubsViaLanguage("en");

  try {
    const [url, mimeType] = await window.electronAPI.getVideoUrl(metaData.MagnetLink, metaData.fileName);
    console.log(`Video Format: ${mimeType}`);
    if (mimeType === "video/x-matroska") {
      throw new Error(`${mimeType} Video Format is Not Supported.`);
    }
    startVideoPlayback(`<source src=${url} type='${mimeType}'>`);
  } catch (err) {
    console.error(err);
    createWarningDiv(err.message);
  }
}

async function loadLocalVideo() {
  const videoPath = await window.electronAPI.getFullVideoPath(metaData.downloadPath, metaData.fileName);
  const identifyingElements = {
    IMDB_ID: metaData.IMDB_ID,
    episodeNumber: metaData.episodeNumber,
    seasonNumber: metaData.seasonNumber,
    DownloadDir: metaData.downloadPath
  };

  const subs = await window.electronAPI.loadLocalSubs(videoPath, identifyingElements);
  subtitlesArray = subs;
  insertLanguageButton(subs);
  getSubsViaLanguage("built-in");

  startVideoPlayback(`<source src='${videoPath}'>`, { showTopBar: true });
}

function startVideoPlayback(sourceHtml, { showTopBar = false } = {}) {
  VideoElement.id = "video-MediaPlayer";
  VideoElement.innerHTML = sourceHtml;
  VideoElement.load();
  VideoElement.play();

  VideoElement.removeAttribute("style");
  document.documentElement.removeAttribute("style");
  document.documentElement.style.backgroundColor = "black";

  TopButtonsContainer.classList.remove("fixedTopBar");
  if (showTopBar) TopButtonsContainer.style.display = "flex";
  BottomButtonsContainer.style.display = "block";

  videoIsPlaying = true;
}

async function playVideoInMpv(PlayMagnet) {
  if (PlayMagnet) {
    window.electronAPI.StreamTorrentOverMpv(metaData);
  } else {
    window.electronAPI.PlayVideoOverMpv(metaData);
  }
}

function insertLanguageButton(subs) {
  const langArray = [
    { display: "Built In", languageCode: "built-in" },
    { display: "English", languageCode: "en" },
    { display: "Arabic", languageCode: "ar" },
    { display: "French", languageCode: "fr" }
  ];

  subs.forEach(sub => {
    const alreadyListed = langArray.some(
      langObj => langObj.languageCode.toLowerCase() === sub.languageCode.toLowerCase()
    );
    if (!alreadyListed) {
      langArray.push({ display: sub.display, languageCode: sub.languageCode });
    }
  });

  const subBtnDiv = document.getElementById("div-LeftSubContainer");
  if (!subBtnDiv) return;

  langArray.forEach((lang, index) => {
    const buttonElement = document.createElement("button");

    if (index === 0) buttonElement.style.backgroundColor = "rgba(255,255,255,0.1)";

    buttonElement.addEventListener("click", (event) => {
      loadLanguageSub(event.target);
    });

    buttonElement.value = lang.languageCode;
    buttonElement.innerText = lang.display;

    subBtnDiv.append(buttonElement);
  });
}

function loadLanguageSub(button) {
  Array.from(button.parentElement.children).forEach(element => element.removeAttribute("style"));
  button.style.backgroundColor = "rgba(255,255,255,0.1)";
  getSubsViaLanguage(button.value);
}

function getSubsViaLanguage(languageCode) {
  const languageData = subtitlesArray.filter(sub => sub.languageCode === languageCode);
  hideAllSubsInList();

  if (!languageData.length) {
    SubsListDiv.classList.add("no-subs-found");
    return;
  }
  insertSubElements(languageData);
}

function hideAllSubsInList() {
  SubsListDiv.classList.remove("no-subs-found");

  Array.from(SubsListDiv.querySelectorAll("button")).forEach(element => {
    element.style.display = "none";
    element.style.margin = 0;
  });
}

function insertSubElements(fetchedData) {
  let counter = 0;

  for (const subData of fetchedData) {
    const subtitlePath = subData.url;
    const elementId = base64Id(subtitlePath);
    const existingElement = SubsListDiv.querySelector(`#${elementId}`);

    if (existingElement) {
      existingElement.style.display = "block";
      counter++;
      continue;
    }

    const subElement = document.createElement("button");
    subElement.id = elementId;
    subElement.innerText = subData.display === "Built In" ? subData.languageName : counter;
    subElement.value = subtitlePath;

    subElement.addEventListener("click", async () => {
      Array.from(SubsListDiv.children).forEach(element => element.classList.remove("active"));
      subElement.classList.add("active");

      if (subData?.type === "local") {
        const fileContent = await window.electronAPI.readSubFile(subtitlePath);
        parseSrtSubs(fileContent);
      } else {
        const data = await fetch(subtitlePath).then(res => res.text());
        parseSrtSubs(data);
      }
    });

    SubsListDiv.append(subElement);
    counter++;
  }
}

function SubObj(startTime, endTime, content) {
  this.startTime = startTime;
  this.endTime = endTime;
  this.content = content;
}

function getTimeInSecFromString(text) {
  const [hourStr, minuteStr, secondPart] = text.trim().split(":");
  const [secondStr, milSecondStr] = secondPart.split(",");

  const hour = parseInt(hourStr) * 60 * 60;
  const minute = parseInt(minuteStr) * 60;
  const second = parseInt(secondStr);
  const milSecond = parseInt(milSecondStr) * 0.001;

  return hour + minute + second + milSecond;
}

function parseSrtSubs(SubsText) {
  SubsStruct = [];
  SubDivDisplay.innerHTML = "";

  const blocks = SubsText.replace(/\r/g, "").split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split("\n").filter(line => line.trim() !== "");
    const timingLineIndex = lines.findIndex(line => line.includes(" --> "));
    if (timingLineIndex === -1) continue;

    const [stringStartTime, stringEndTimeRaw] = lines[timingLineIndex].split(" --> ");
    const stringEndTime = stringEndTimeRaw.trim().split(" ")[0];

    const startTime = getTimeInSecFromString(stringStartTime);
    const endTime = getTimeInSecFromString(stringEndTime);
    const content = lines.slice(timingLineIndex + 1).join("\n");

    SubsStruct.push(new SubObj(startTime, endTime, content));
  }

  VideoElement.removeEventListener("timeupdate", displaySub);
  VideoElement.addEventListener("timeupdate", displaySub);
}

function displaySub() {
  let found = false;

  for (let i = 0; i < SubsStruct.length; i++) {
    const cue = SubsStruct[i];
    const isActive = (cue.startTime + subsDelay / 1000) <= VideoElement.currentTime
      && (cue.endTime + subsDelay / 1000) >= VideoElement.currentTime;

    if (isActive) {
      if (SubDivDisplay.innerHTML !== cue.content) {
        SubDivDisplay.innerHTML = cue.content.replaceAll("\n", "<br>");
        SubDivDisplay.classList.remove("hideElement");
      }
      found = true;
      break;
    }
  }

  if (!found) SubDivDisplay.classList.add("hideElement");
}

function OpenSubtitles() {
  repositionSubDiv();
  SubDiv.classList.toggle("hideElement");
}

function repositionSubDiv() {
  SubDiv.style.left = SubButton.getBoundingClientRect().left + SubButton.offsetWidth / 2 + "px";
}

function hideSubDiv(event) {
  if (SubDiv.classList.contains("hideElement")) return;

  const subDivRect = SubDiv.getBoundingClientRect();
  const subButtonRect = SubButton.getBoundingClientRect();

  const cursorInRect = (rect) =>
    event.clientX >= rect.left && event.clientX <= rect.right &&
    event.clientY >= rect.top && event.clientY <= rect.bottom;

  if (!cursorInRect(subDivRect) && !cursorInRect(subButtonRect)) {
    SubDiv.classList.add("hideElement");
  }
}

function SubSize(operation) {
  if (operation === "+" && subsSizeOffsetPercent < SUB_SIZE_MAX_PERCENT) subsSizeOffsetPercent += SUB_SIZE_STEP_PERCENT;
  else if (operation === "-" && subsSizeOffsetPercent > SUB_SIZE_MIN_PERCENT) subsSizeOffsetPercent -= SUB_SIZE_STEP_PERCENT;

  const sign = subsSizeOffsetPercent >= 0 ? "+" : "";
  SubSizeDivInput.value = sign + subsSizeOffsetPercent + "%";

  SubDivDisplay.style.fontSize = defaultFontSize + (defaultFontSize * subsSizeOffsetPercent) / 100 + "px";
}

function SubDelay(operation) {
  const valueToAdd = operation === "+" ? SUB_DELAY_STEP_MS : operation === "-" ? -SUB_DELAY_STEP_MS : 0;
  subsDelay += valueToAdd; // ms

  const sign = subsDelay >= 0 ? "+" : "";
  SubDelayDivInput.value = sign + subsDelay + "ms";
}

function getValueForSubInputConfiguration(inputElement) {
  const newValue = getNumberFromStringInput(inputElement.value);
  const oldValue = inputElement.getAttribute("old_value");
  const choosenValue = newValue ?? oldValue;

  return choosenValue >= 0 ? `+${choosenValue}` : choosenValue;
}

function getNumberFromStringInput(rawInput) {
  const formatedInput = rawInput.replace("ms", "").replace("%", "");
  const numberInput = Number(formatedInput);
  return !isNaN(numberInput) ? numberInput : null;
}

async function loadSubSettings() {
  const Settings = await window.electronAPI.loadSettings();

  SubDivDisplay.style.fontSize = Settings.SubFontSizeInternal;
  SubDivDisplay.style.fontFamily = Settings.SubFontFamilyInternal;
  SubDivDisplay.style.color = Settings.SubColorInternal;

  const numberInHex = parseInt(Settings.SubBackgroundColorInternal.split("#")[1], 16);
  const r = (numberInHex >> 16) & 255;
  const g = (numberInHex >> 8) & 255;
  const b = numberInHex & 255;
  SubDivDisplay.style.backgroundColor = `rgba(${r},${g},${b},${Settings.SubBackgroundOpacityLevelInternal / 100}`;

  if (Settings.DownloadSubtitlesByDefault) {
    switchToggle.checked = true;
    bottomSubElement.classList.toggle("hideElement");
  }

  defaultFontSize = Settings.SubFontSizeInternal;
}

function TogglePauseUnpause() {
  if (VideoElement.paused) VideoElement.play();
  else VideoElement.pause();
}

function ChangePauseUnpauseIcons(paused) {
  const PauseButtonImageElement = document.getElementById("img-PauseButton");
  PauseButtonImageElement.src = paused
    ? "../../../assets/icons/BPause.png"
    : "../../../assets/icons/BPlay.png";
}

function toggleVolume() {
  VideoElement.muted = !VideoElement.muted;
  updateVolumeIcons();
}

function updateVolumeIcons() {
  const icon = VolumeButton.children[0];
  if (VideoElement.volume <= 0.0 || VideoElement.muted) icon.src = "../../../assets/icons/BMute.png";
  else if (VideoElement.volume <= 0.25) icon.src = "../../../assets/icons/BVolumeLow.png";
  else if (VideoElement.volume <= 0.75) icon.src = "../../../assets/icons/BVolumeMid.png";
  else icon.src = "../../../assets/icons/BVolumeControl.png";
}

async function togglePIP() {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else {
    await VideoElement.requestPictureInPicture();
  }
}

function goBack() {
  window.electronAPI.goBack();
}

async function getLatestPlayBackPosition() {
  const targetIdentification = { MediaId: metaData.MediaId, MediaType: metaData.MediaType };
  let MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if (MediaLibraryObject == null) return 0;
  MediaLibraryObject = MediaLibraryObject[0];

  const mediaIsAnEpisode = MediaLibraryObject.hasOwnProperty("episodeNumber") && MediaLibraryObject.hasOwnProperty("seasonNumber");
  const isRequestedEpisode = mediaIsAnEpisode
    ? (MediaLibraryObject["episodeNumber"] === metaData.episodeNumber && MediaLibraryObject["seasonNumber"] === metaData.seasonNumber)
    : true;

  const hasSavedProgress = MediaLibraryObject.hasOwnProperty("typeOfSave")
    && MediaLibraryObject["typeOfSave"].includes("Currently Watching")
    && MediaLibraryObject.hasOwnProperty("lastPlaybackPosition")
    && isRequestedEpisode;

  return hasSavedProgress ? MediaLibraryObject["lastPlaybackPosition"] : 0;
}

async function updateLastSecondBeforeQuit(lastPbPosition) {
  const targetIdentification = { MediaId: metaData.MediaId, MediaType: metaData.MediaType };
  let MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if (MediaLibraryObject != null) {
    MediaLibraryObject = {
      ...MediaLibraryObject[0],
      ...metaData,
      lastPlaybackPosition: lastPbPosition,
      timeOfSave: Date.now().toString()
    };

    if (!MediaLibraryObject?.["typeOfSave"].includes("Currently Watching")) {
      MediaLibraryObject["typeOfSave"].push("Currently Watching");
    }

    await window.electronAPI.removeMediaFromLibrary(targetIdentification);
  } else {
    MediaLibraryObject = {
      ...metaData,
      lastPlaybackPosition: lastPbPosition,
      typeOfSave: ["Currently Watching"],
      timeOfSave: Date.now()
    };
  }

  window.electronAPI.addMediaToLibrary(MediaLibraryObject);
}

function monitoringErrorsCummingFromMainProcess() {
  window.electronAPI.getFetchingTorrentErrors((err) => {
    console.error(err);
    createWarningDiv(err);
  });
}

function monitorMsgFromMainProcess() {
  window.electronAPI.getMsgFromMainProcess((msg) => {
    if (msg.type === "request" && msg.request === "exit_video_player") {
      window.electronAPI.goBack();
    }
  });
}

function monitorTorrentStreamingReport() {
  window.electronAPI.getTorrentStreamingReport((msg) => {
    if (msg.type !== "progress") return;

    switch (msg.stage) {
      case "metadata-peers":
        console.log("Number of peers connections:", msg.data.peers);
        break;
      case "metadata-received":
        console.log("Metadata Received");
        break;
    }
  });
}

function gettingformatedTime(time) {
  const hours = parseInt((time / 60) / 60);
  const minutes = parseInt((time / 60) - hours * 60);
  const seconds = parseInt(time - minutes * 60 - hours * 60 * 60);

  return String(hours).padStart(2, "0") + ":"
    + String(minutes).padStart(2, "0") + ":"
    + String(seconds).padStart(2, "0");
}

function setBackgroundImage() {
  document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${metaData.bgImageUrl || metaData.bgImagePath}')`;
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
