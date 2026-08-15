const RightmiddleDiv = document.getElementById("div-middle-right");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const heroDiv = document.getElementById("div-collection-hero");
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

function renderCollectionHero(CollectionData, CollectionImagesData) {
  const backdropPath = CollectionData?.["backdrop_path"];
  const posterPath = CollectionData?.["poster_path"];
  const backdropImage = backdropPath
    ? ("https://image.tmdb.org/t/p/original/"+backdropPath).replace(/([^:]\/)\/+/g, '$1')
    : posterPath
      ? ("https://image.tmdb.org/t/p/original/"+posterPath).replace(/([^:]\/)\/+/g, '$1')
      : null;

  if(backdropImage)
    heroDiv.style.backgroundImage = `url("${normalizeRootUrl(backdropImage)}")`;
  else
    heroDiv.classList.add("no-backdrop");

  const bestLogo = pickBestLogo(CollectionImagesData?.["logos"]);
  const rawCollectionName = CollectionData?.["name"] ?? "Collection";
  const collectionName = rawCollectionName.replace(/\s*collection\s*$/i, "").trim() || rawCollectionName;

  if(bestLogo?.["file_path"]) {
    const logoImage = ("https://image.tmdb.org/t/p/w500/"+bestLogo["file_path"]).replace(/([^:]\/)\/+/g, '$1');
    collectionTitleLogoEl.src = normalizeRootUrl(logoImage);
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

function renderCollectionMeta(CollectionData) {
  const parts = Array.isArray(CollectionData?.["parts"]) ? CollectionData["parts"] : [];
  const movieCount = parts.length;
  const yearSpan = getYearSpan(parts);

  const metaPieces = [];
  if(yearSpan) metaPieces.push(yearSpan);
  if(movieCount) metaPieces.push(`${movieCount} movie${movieCount === 1 ? "" : "s"}`);

  const collectionMetaEl = document.getElementById("collection-meta");
  collectionMetaEl.textContent = metaPieces.join("  ·  ");
}

function renderCollectionParts(CollectionData, LibraryInformation) {
  const parts = Array.isArray(CollectionData?.["parts"]) ? CollectionData["parts"] : [];

  if(parts.length)
    insertMediaElements(parts, gridDiv, "movie", LibraryInformation);
  else {
    const WarningElement = DisplayWarningOrErrorForUser("No movies were found in this collection.", false);
    RightmiddleDiv.appendChild(WarningElement);
  }
}

triggerLoadingGif();
loadCollection();
setupKeyPressesHandler();
handleNavigationButtonsHandler(focusFunction);
loadIconsDynamically();
handlingMiddleRightDivResizing();
