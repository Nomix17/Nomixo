const RightmiddleDiv = document.getElementById("div-middle-right");
const SelectMediaType = document.getElementById("select-type");
const SelectSaveType = document.getElementById("select-save");
const SelectSortType = document.getElementById("select-sort");
const SavedMedia = document.getElementById("div-SavedMedia");
const categoriDescription = document.querySelector(".div-categories-description");
const searchInput = document.getElementById("input-searchForMovie");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");
const chooseRandomMediaEl = document.getElementById("choose-random-media");
const randomMuteToggleEl = document.getElementById("random-mute-toggle");
const randomLiveRegionEl = document.getElementById("random-result-live");

const data = new URLSearchParams(window.location.search);
const typeOfSave = data.get("typeOfSave");

async function loadDataFromLibrary(apiKey){
  const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  if(wholeLibraryInformation == null || wholeLibraryInformation.length === 0) {
    addEmptyLibraryWarning(RightmiddleDiv);
    return;
  }
  await fetchMediaDataFromLibrary(apiKey, wholeLibraryInformation, SavedMedia, RightmiddleDiv);
}

const getCategorieFullName = (value) => {
  const option = SelectMediaType.querySelector(`.select-option[value="${getDropdownValue(SelectMediaType)}"]`);
  return option ? option.textContent : value;
}

function filterMedia(MediaTypeFilter,SaveTypeFilter) {
  let numberOfDisplayedElements = 0;
  for(const item of SavedMedia.querySelectorAll(".div-MovieElement")){
    if(
      (MediaTypeFilter.toLowerCase() === "all" || item.getAttribute("mediaType") === MediaTypeFilter) &&
      (SaveTypeFilter.toLowerCase() === "all" || item.getAttribute("saveType").includes(SaveTypeFilter))
    ){
      numberOfDisplayedElements ++;
      item.style.display = "flex";
    }else{
      item.style.display = "none";
    }
  }

  return numberOfDisplayedElements;
}

async function addDropDownsEventListener() {
  [SelectMediaType,SelectSaveType].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      const newTypeOfSave = getDropdownValue(SelectSaveType);
      const newMediaType = getDropdownValue(SelectMediaType);
      cancelRandomPick();
      changeDescriptionTitleValue(newTypeOfSave);
      const numberOfDisplayedElements = filterMedia(newMediaType, newTypeOfSave);
      if(!numberOfDisplayedElements)
        addEmptyLibraryWarning(RightmiddleDiv);
      else
        hideEmptyLibraryWarning(RightmiddleDiv);

      updateRandomControls();
    });
  });

  SelectSortType.addEventListener("dropdownChange",()=>{
    cancelRandomPick();
    const sortType = getDropdownValue(SelectSortType);
    sortMediaELements(SortingCriteria[sortType]);
  });

}

const RANDOM_PICK = {
  START_DELAY: 120,
  DELAY_GROWTH: 1.1,
  STOP_DELAY: 600,
  FINAL_DELAY: 1000,
  SMOOTH_SCROLL_ABOVE: 200,
  TICK_VOLUME: 0.12,
  CHIME_VOLUME: 0.18,
  MUTE_KEY: "randomPickerMuted",
};

const randomPicker = {
  timeout: null,
  chimeTimeout: null,
  rolling: false,
  audioCtx: null,
  lastWinnerId: null,
  muted: false,
};

function getMediaUniqueId(el) {
  return `${el.getAttribute("mediaType")}:${el.getAttribute("mediaId")}`;
}

function getRandomCandidates() {
  return Array.from(SavedMedia.querySelectorAll(".div-MovieElement")).filter(el =>
    el.style.display !== "none" &&
    (el.getAttribute("saveType") || "").includes("Watch Later")
  );
}

function announceRandomResult(text) {
  if (randomLiveRegionEl) randomLiveRegionEl.textContent = text;
}

function clearRandomHighlight() {
  document
    .querySelectorAll(".div-MovieElement.roulette-active, .div-MovieElement.roulette-chosen")
    .forEach(el => el.classList.remove("roulette-active", "roulette-chosen"));
}

function cancelRandomPick() {
  clearTimeout(randomPicker.timeout);
  clearTimeout(randomPicker.chimeTimeout);
  randomPicker.rolling = false;
  chooseRandomMediaEl.disabled = false;
  clearRandomHighlight();
  announceRandomResult("");
}

function updateRandomControls() {
  const show =
    getDropdownValue(SelectSaveType) === "Watch Later" &&
    getRandomCandidates().length > 0;
  chooseRandomMediaEl.classList.toggle("hidden", !show);
  randomMuteToggleEl.classList.toggle("hidden", !show);
}

function renderMuteState() {
  randomMuteToggleEl.classList.toggle("muted", randomPicker.muted);
  randomMuteToggleEl.setAttribute("aria-pressed", String(randomPicker.muted));
  randomMuteToggleEl.setAttribute(
    "aria-label",
    randomPicker.muted ? "Unmute random picker sound" : "Mute random picker sound"
  );
}

function loadMutePreference() {
  try {
    randomPicker.muted = localStorage.getItem(RANDOM_PICK.MUTE_KEY) === "1";
  } catch {
    randomPicker.muted = false;
  }
  renderMuteState();
}

function toggleMute() {
  randomPicker.muted = !randomPicker.muted;
  try {
    localStorage.setItem(RANDOM_PICK.MUTE_KEY, randomPicker.muted ? "1" : "0");
  } catch {}
  renderMuteState();
}

function playTick(frequency = 600, duration = 0.05, volume = RANDOM_PICK.TICK_VOLUME) {
  const ctx = randomPicker.audioCtx;
  if (randomPicker.muted || !ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function scrollToMedia(el, { smooth = false, force = false } = {}) {
  if (!force) {
    const container = RightmiddleDiv.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (rect.top >= container.top && rect.bottom <= container.bottom) return;
  }
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
}

function finishRandomPick(winnerEl) {
  clearRandomHighlight();
  winnerEl.classList.add("roulette-chosen");
  scrollToMedia(winnerEl, { smooth: true, force: true });

  playTick(800, 0.15, RANDOM_PICK.CHIME_VOLUME);
  randomPicker.chimeTimeout = setTimeout(
    () => playTick(1200, 0.3, RANDOM_PICK.CHIME_VOLUME),
    120
  );

  randomPicker.lastWinnerId = getMediaUniqueId(winnerEl);
  randomPicker.rolling = false;
  chooseRandomMediaEl.disabled = false;

  const title = winnerEl.querySelector(".parag-MovieTitle p")?.textContent?.trim();
  announceRandomResult(title ? `Picked: ${title}` : "Picked a random title");
}

function pickRandomMedia() {
  if (randomPicker.rolling) return;

  const medias = getRandomCandidates();
  if (medias.length === 0) return;

  cancelRandomPick();
  randomPicker.rolling = true;
  chooseRandomMediaEl.disabled = true;

  if (!randomPicker.muted) {
    randomPicker.audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (randomPicker.audioCtx.state === "suspended") randomPicker.audioCtx.resume();
  }

  const count = medias.length;

  let winner = Math.floor(Math.random() * count);
  if (count > 1 && getMediaUniqueId(medias[winner]) === randomPicker.lastWinnerId) {
    winner = (winner + 1 + Math.floor(Math.random() * (count - 1))) % count;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (count === 1 || reduceMotion) {
    finishRandomPick(medias[winner]);
    return;
  }

  const delays = [];
  for (let d = RANDOM_PICK.START_DELAY; d <= RANDOM_PICK.STOP_DELAY; d *= RANDOM_PICK.DELAY_GROWTH) {
    delays.push(d);
  }
  delays.push(RANDOM_PICK.FINAL_DELAY);

  const totalMoves = delays.length;
  const laps = winner >= totalMoves ? 0 : Math.ceil((totalMoves - winner) / count);
  const distance = winner + laps * count;
  const positionAt = (i) => Math.round((i * distance) / totalMoves) % count;
  let step = 0;
  let index = 0;
  let previous = null;

  const highlight = (el, smooth, force = false) => {
    previous?.classList.remove("roulette-active");
    el.classList.add("roulette-active");
    previous = el;
    scrollToMedia(el, { smooth, force });
  };

  const tickFrequency = () => 500 + (step / totalMoves) * 400;

  highlight(medias[index], false, true);
  playTick(tickFrequency());

  const advance = () => {
    const delay = delays[step];
    randomPicker.timeout = setTimeout(() => {
      step++;
      index = positionAt(step);

      if (step === totalMoves) {
        finishRandomPick(medias[index]);
        return;
      }

      highlight(medias[index], delay > RANDOM_PICK.SMOOTH_SCROLL_ABOVE);
      playTick(tickFrequency());
      advance();
    }, delay);
  };

  advance();
}

function setupRandomPicker() {
  loadMutePreference();
  chooseRandomMediaEl.addEventListener("click", pickRandomMedia);
  randomMuteToggleEl.addEventListener("click", toggleMute);

  window.addEventListener("pagehide", clearRandomHighlight);
  window.addEventListener("beforeunload", clearRandomHighlight);
}

function sortMediaELements(sortingType = SortingCriteria.alphabetical) {
  const mediaElements = Array.from(SavedMedia.children);
  switch (sortingType) {
    case SortingCriteria.alphabetical:{
      mediaElements.sort((a,b) => {
        const aTitle = a.querySelector(".parag-MovieTitle p").textContent || "";
        const bTitle = b.querySelector(".parag-MovieTitle p").textContent || "";
        return aTitle.localeCompare(bTitle);
      });
      break;
    }

    case SortingCriteria.newest:{
      mediaElements.sort((a,b) => {
        const aSaveTime = Number(a.getAttribute("saveTime")) || 0;
        const bSaveTime = Number(b.getAttribute("saveTime")) || 0;
        return bSaveTime - aSaveTime;
      });

      break;
    }

    case SortingCriteria.oldest:{
      mediaElements.sort((a,b) => {
        const aSaveTime = Number(a.getAttribute("saveTime")) || 0;
        const bSaveTime = Number(b.getAttribute("saveTime")) || 0;
        return aSaveTime - bSaveTime;
      });
      break;
    }
  }

  const fragment = document.createDocumentFragment();
  mediaElements.forEach(ele => fragment.appendChild(ele));
  SavedMedia.appendChild(fragment);
}

function changeDescriptionTitleValue(newTypeOfSave=typeOfSave){
  const descriptionTitle = categoriDescription.querySelector("h1")
  if(descriptionTitle)
    descriptionTitle.innerText = newTypeOfSave;
}

async function loadCachedMediaData(cachedData){
  const containersData = cachedData?.containers_data;
  if(containersData){
    SavedMedia.innerHTML = "";
    const allMediaElements = [];
    const allXremoveFromLibButtons = [];
    const allContinueWatchingButton = [];
    for(const mediaContainer of containersData){
      if(mediaContainer.id){
        const containerDomElement = document.getElementById(mediaContainer.id);
        if(!containerDomElement || !mediaContainer?.HTMLContent) continue;
        containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...document.querySelectorAll(".div-MovieElement"));
        allXremoveFromLibButtons.push(...document.querySelectorAll(".btn-remove-from-library"));
        allContinueWatchingButton.push(...document.querySelectorAll(".continue-video-button"));
      }
    }
    
    // recreate MediaElement Event Listeners
    for(const mediaDomElement of allMediaElements){
      if(mediaDomElement){
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        const posterUrl = mediaDomElement.getAttribute("posterUrl");
        if(mediaId && mediaType){
          const posterContainer = mediaDomElement.querySelector(".img-MoviePosterContainer");
          const posterElement = mediaDomElement.querySelector(".img-MoviePoster");
          loadImageWithAnimation(posterContainer,posterElement,posterUrl);
          addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType)
          addFloatingDivToDisplayFullTitle(mediaDomElement);
        }
      }
    }

    // recreate xremove Btns Event Listeners
    for(const removeFromLibButton of allXremoveFromLibButtons){
      const thisMediaElement = removeFromLibButton?.parentElement;
      if(!thisMediaElement) continue;
      addEventListenerToRemoveFromLibraryButton(
        removeFromLibButton,
        thisMediaElement.getAttribute("mediaId"),
        thisMediaElement.getAttribute("mediaType")
      )
    }

    // recreate continue watching Btns Event Listeners
    for(const continueWatchingBtn of allContinueWatchingButton){
      const thisMediaElement = continueWatchingBtn?.parentElement;
      if(!thisMediaElement) continue;
      continueWatchingEventListener(
        continueWatchingBtn,
        {
          mediaId:thisMediaElement.getAttribute("mediaId"),
          mediaType:thisMediaElement.getAttribute("mediaType"),
          findInLib:true
        }
      )
    }
  }
}

async function loadMedia() {
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
  await loadDataFromLibrary(apiKey);
}

async function initPage() {
  const cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(!cachedMediaInfo?.right_middle_div_top_scroll_value)
    RightmiddleDiv.classList.add("activate");

  const mediaType = cachedMediaInfo?.dropdown_mediaType || "all";
  const saveType = cachedMediaInfo?.dropdown_saveType || typeOfSave || "All";
  const sortType = cachedMediaInfo?.dropdown_sortType || "newest";

  changeDescriptionTitleValue();
  setDropdownValue(SelectMediaType, mediaType);
  setDropdownValue(SelectSaveType, saveType);
  setDropdownValue(SelectSortType, sortType);
  addDropDownsEventListener();
  setupRandomPicker();

  await loadMedia();
  clearRandomHighlight();
  filterMedia(mediaType, saveType);
  sortMediaELements(SortingCriteria[sortType])
  updateRandomControls();

  if(cachedMediaInfo) {
    console.log("Loading Cached Information");
    loadCachedRightDivScrollValue(cachedMediaInfo);
  }

  globalLoadingGif.remove()
  RightmiddleDiv.classList.add("activate");
}

function focusFunction(element) {
  element.focus();
}

triggerLoadingGif();
dropDownInit();
initPage();
setupKeyPressesForInputElement(searchInput);
setupKeyPressesHandler();
handleNavigationButtonsHandler(focusFunction);
loadIconsDynamically();
handlingMiddleRightDivResizing();
createSearchHistoryDropDown();
