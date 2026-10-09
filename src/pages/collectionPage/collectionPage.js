const RightmiddleDiv = document.getElementById("div-middle-right");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const tintEl = document.getElementById("div-collection-tint");
const tintImageEl = tintEl.querySelector(".tint-image");
const posterCardEl = document.getElementById("collection-poster-card");
const posterEl = document.getElementById("collection-poster");
const actionsEl = document.getElementById("collection-actions");
const addAllBtn = document.getElementById("btn-collection-addAll");
const addAllLabelEl = document.getElementById("collection-addAll-label");
const libraryStatusEl = document.getElementById("collection-library-status");
const collectionGridCountEl = document.getElementById("collection-grid-count");
const collectionTitleEl = document.getElementById("collection-title");
const collectionTitleLogoEl = document.getElementById("collection-title-logo");
const collectionOverviewEl = document.getElementById("collection-overview");

const gridDiv = document.getElementById("div-collection-grid");

function focusFunction(element) {
  element.focus();
}

async function loadCollection() {
  const params = new URLSearchParams(window.location.search);
  const collectionId = params.get("CollectionId");
  const apiKey = await window.electronAPI.getTMDBAPIKEY().then();

  try {
    if(!collectionId) throw new Error("No collection was specified.");

    const [CollectionData, CollectionImagesData, LibraryInformation] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/collection/${collectionId}?api_key=${apiKey}`).then(res=>res.json()),
      fetch(`https://api.themoviedb.org/3/collection/${collectionId}/images?api_key=${apiKey}`).then(res=>res.json()).catch(()=>null),
      loadLibraryInfo()
    ]);

    if(parseInt(CollectionData.status_code) === 34 || parseInt(CollectionData.status_code) === 7)
      throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");

    renderCollectionHero(CollectionData, CollectionImagesData);
    renderCollectionParts(CollectionData, LibraryInformation);
    renderCollectionMeta(CollectionData);

    globalLoadingGif.remove();
    await loadCachedRightMiddleDivScrollValue();
    updateTintProgress();
    RightmiddleDiv.classList.add("activate");

  } catch(err) {
    err.message =
      (err.message === "Failed to fetch")
      ? "We’re having trouble loading data.</br>Please Check your connection and refresh!"
      : err.message;

    setTimeout(()=>{
      RightmiddleDiv.innerHTML ="";
      const WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    },800);

    console.error(err);
  };
}

function pickBestLogo(logos) {
  if(!Array.isArray(logos) || !logos.length) return null;

  const byPreference = (a,b) => {
    const langScore = logo => logo?.["iso_639_1"] === "en" ? 2 : (logo?.["iso_639_1"] == null ? 1 : 0);
    const langDiff = langScore(b) - langScore(a);
    if(langDiff !== 0) return langDiff;
    return (b?.["vote_average"] ?? 0) - (a?.["vote_average"] ?? 0);
  };

  return [...logos].sort(byPreference)[0] ?? null;
}

function tmdbImage(size, path) {
  return normalizeRootUrl(("https://image.tmdb.org/t/p/"+size+"/"+path).replace(/([^:]\/)\/+/g, '$1'));
}

function renderCollectionHero(CollectionData, CollectionImagesData) {
  const backdropPath = CollectionData?.["backdrop_path"];
  const posterPath = CollectionData?.["poster_path"];

  const cardUrl = posterPath
    ? tmdbImage("w500", posterPath)
    : backdropPath
      ? tmdbImage("w780", backdropPath)
      : null;

  if(cardUrl) {
    posterEl.onload = () => { posterEl.style.display = "block"; };
    posterEl.onerror = () => { posterEl.style.display = "none"; posterCardEl.classList.add("no-art"); };
    posterEl.src = cardUrl;
  } else {
    posterCardEl.classList.add("no-art");
  }

  const tintPath = posterPath || backdropPath;
  if(tintPath)
    tintImageEl.style.backgroundImage = `url("${tmdbImage("w185", tintPath)}")`;
  else
    tintEl.style.display = "none";

  const bestLogo = pickBestLogo(CollectionImagesData?.["logos"]);
  const rawCollectionName = CollectionData?.["name"] ?? "Collection";
  const collectionName = rawCollectionName.replace(/\s*collection\s*$/i, "").trim() || rawCollectionName;

  if(bestLogo?.["file_path"]) {
    collectionTitleLogoEl.src = tmdbImage("w500", bestLogo["file_path"]);
    collectionTitleLogoEl.alt = collectionName;
    collectionTitleLogoEl.style.display = "block";
    collectionTitleLogoEl.onerror = () => {
      collectionTitleLogoEl.style.display = "none";
      collectionTitleEl.style.display = "block";
    };
    collectionTitleEl.style.display = "none";
  } else {
    collectionTitleLogoEl.style.display = "none";
    collectionTitleEl.style.display = "block";
  }

  collectionTitleEl.textContent = collectionName;
  collectionOverviewEl.textContent = CollectionData?.["overview"] ?? "";
  if(!CollectionData?.["overview"]) collectionOverviewEl.style.display = "none";

  document.title = `${collectionName} - Nomixo`;
}

function getYearSpan(parts) {
  const years = parts
    .map(part => part?.["release_date"])
    .filter(Boolean)
    .map(date => parseInt(String(date).slice(0, 4)))
    .filter(Number.isFinite);

  if(!years.length) return null;

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  return minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
}

function createMetaChip(text, withStar = false) {
  const chip = document.createElement("span");
  chip.className = "collection-chip";

  if(withStar) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M12 2.5l2.94 6.1 6.56.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6-4.8-4.6 6.56-.9L12 2.5z");
    svg.appendChild(path);
    chip.appendChild(svg);
  }

  chip.appendChild(document.createTextNode(text));
  return chip;
}

function getAverageRating(parts) {
  const ratings = parts
    .filter(part => part?.["vote_count"] > 0 && Number.isFinite(part?.["vote_average"]))
    .map(part => part["vote_average"]);

  if(!ratings.length) return null;
  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
}

function renderCollectionMeta(CollectionData) {
  const parts = Array.isArray(CollectionData?.["parts"]) ? CollectionData["parts"] : [];
  const movieCount = parts.length;
  const yearSpan = getYearSpan(parts);
  const averageRating = getAverageRating(parts);

  const collectionMetaEl = document.getElementById("collection-meta");
  collectionMetaEl.replaceChildren();

  if(yearSpan) collectionMetaEl.appendChild(createMetaChip(yearSpan));
  if(movieCount) collectionMetaEl.appendChild(createMetaChip(`${movieCount} movie${movieCount === 1 ? "" : "s"}`));
  if(averageRating) collectionMetaEl.appendChild(createMetaChip(averageRating.toFixed(1), true));
}

function renderCollectionParts(CollectionData, LibraryInformation) {
  const parts = Array.isArray(CollectionData?.["parts"]) ? CollectionData["parts"] : [];

  collectionGridCountEl.textContent = parts.length ? parts.length : "";

  if(parts.length) {
    insertMediaElements(parts, gridDiv, "movie", LibraryInformation);
    watchLibraryState();
  } else {
    const WarningElement = DisplayWarningOrErrorForUser("No movies were found in this collection.", false);
    RightmiddleDiv.appendChild(WarningElement);
  }
}

const TINT_FADE_DISTANCE = 420;
let tintFrame = null;

function updateTintProgress() {
  tintFrame = null;
  const progress = Math.min(1, Math.max(0, RightmiddleDiv.scrollTop / TINT_FADE_DISTANCE));
  tintEl.style.setProperty("--p", progress.toFixed(3));
}

function queueTintProgressUpdate() {
  if(tintFrame === null) tintFrame = requestAnimationFrame(updateTintProgress);
}

RightmiddleDiv.addEventListener("scroll", queueTintProgressUpdate, { passive: true });

function getLibraryToggles() {
  return [...gridDiv.querySelectorAll(".btn-toggle-in-library")];
}

function isInLibrary(toggleButton) {
  return toggleButton.getAttribute("pressed") === " ";
}

let libraryUpdateFrame = null;
let addingAll = false;

function updateLibraryState() {
  libraryUpdateFrame = null;
  const toggles = getLibraryToggles();

  if(!toggles.length) {
    actionsEl.hidden = true;
    return;
  }

  const total = toggles.length;
  const inLibrary = toggles.filter(isInLibrary).length;
  const complete = inLibrary === total;

  actionsEl.hidden = false;
  addAllBtn.classList.toggle("is-complete", complete);
  addAllBtn.classList.toggle("is-busy", addingAll);
  addAllBtn.disabled = complete || addingAll;
  addAllLabelEl.textContent = complete ? "All in library" : (addingAll ? "Adding…" : "Add all to library");
  libraryStatusEl.textContent = complete ? "" : `${inLibrary} of ${total} in your library`;
}

function queueLibraryUpdate() {
  if(libraryUpdateFrame === null) libraryUpdateFrame = requestAnimationFrame(updateLibraryState);
}

function watchLibraryState() {
  new MutationObserver(queueLibraryUpdate).observe(gridDiv, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["pressed"]
  });
  updateLibraryState();
}

addAllBtn.addEventListener("click", async () => {
  if(addingAll) return;
  addingAll = true;
  updateLibraryState();

  for(const toggleButton of getLibraryToggles()) {
    if(isInLibrary(toggleButton)) continue;
    toggleButton.click();
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  addingAll = false;
  updateLibraryState();
});

triggerLoadingGif();
loadCollection();
setupKeyPressesHandler();
handleNavigationButtonsHandler(focusFunction);
loadIconsDynamically();
handlingMiddleRightDivResizing();
