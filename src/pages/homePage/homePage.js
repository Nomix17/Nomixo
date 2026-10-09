const RightmiddleDiv = document.getElementById("div-middle-right");
const continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
const popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
const popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
const trendingDiv = document.getElementById("div-middle-right-trending");
const collectionsDiv = document.getElementById("div-middle-right-collections");
const searchInput = document.getElementById("input-searchForMovie");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const COLLECTION_IDS = [
  10, 1241, 119, 121938, 86311, 131292, 131295, 131296, 531241, 284433,
  645, 87359, 328, 2344, 263, 8091, 528, 84, 9485, 295,
  10194, 2150, 404609, 131635, 264, 8354, 86066, 748, 173710, 1575
];
const COLLECTIONS_TO_SHOW = 12;
const TIME_BEFORE_REFRESH_COLLECTION = 8; //h

function suffleArray(array) {
  const result = [...array];
  let state = Math.floor(Date.now() / (TIME_BEFORE_REFRESH_COLLECTION * 60 * 60 * 1000));
  state = Math.imul(state, 2654435761) >>> 0;
  const getRandom = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(getRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function fetchCollections(apiKey) {
  const ids = suffleArray(COLLECTION_IDS).slice(0, COLLECTIONS_TO_SHOW + 4);
  const settled = await Promise.allSettled(
    ids.map(id =>
      fetch(`https://api.themoviedb.org/3/collection/${id}?api_key=${apiKey}`).then(res => res.json())
    )
  );
  return settled
    .filter(r => r.status === "fulfilled" && r.value?.id && (r.value.backdrop_path || r.value.poster_path))
    .map(r => r.value)
    .slice(0, COLLECTIONS_TO_SHOW);
}

function renderCollections(collections) {
  if (!collections.length) {
    document.getElementById("collections-categorie").style.display = "none";
    return;
  }
  const fragment = document.createDocumentFragment();
  collections.forEach(el => fragment.appendChild(createCollectionCard(el)));
  collectionsDiv.appendChild(fragment);
}

async function loadMovies() {
  const apiKey = await window.electronAPI.getTMDBAPIKEY().then();
  const LibraryInformation = await loadLibraryInfo();

  try {
    const [MovieData,TVShowData,TrendingData,Collections,_] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
      fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
      fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${apiKey}`).then(res=>res.json()).catch(() => ({ results: [] })),
      fetchCollections(apiKey).catch(() => []),
      manageLibraryData(apiKey,LibraryInformation)
    ]);
    if(parseInt(MovieData.status_code) === 7 && parseInt(TVShowData.status_code) === 7)
      throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
    const MoviesSearchResults =  MovieData.results;
    const TVShowSearchResults = TVShowData.results;

    insertMediaElements(MoviesSearchResults,popularMoviesDiv,"movie",LibraryInformation);
    insertMediaElements(TVShowSearchResults,popularSeriesDiv,"tv",LibraryInformation);

    renderedMedia.clear();
    const trendingResults = (TrendingData.results ?? []).filter(item => item.media_type !== "person");
    try {
      insertMediaElements(trendingResults,trendingDiv,"movie",LibraryInformation);
    } catch {
      document.getElementById("trending-categorie").style.display = "none";
    }
    renderCollections(Collections);

    checkIfDivShouldHaveMoveToRightOrLeftButton([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv, trendingDiv, collectionsDiv]);

    globalLoadingGif.remove();
    RightmiddleDiv.classList.add("activate");

  } catch(err) {
    err.message = 
      (err.message === "Failed to fetch") 
      ? "We’re having trouble loading data.</br>Please Check your connection and refresh!"
      : err.message;

    setTimeout(() => {
      RightmiddleDiv.innerHTML ="";
      const WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.classList.add("activate");
    },800);

    console.error(err);
  };
}

async function manageLibraryData(apiKey,LibraryInformation){
  const continueWatchingMediaFromLibrary = LibraryInformation
    .filter(item =>
      item?.typeOfSave.includes("Currently Watching")
    );

  if(continueWatchingMediaFromLibrary.length) {
    fetchMediaDataFromLibrary(
      apiKey,
      continueWatchingMediaFromLibrary,
      continueWatchingDiv,
      RightmiddleDiv,
      true
    );
  } else {
    document.getElementById("continue-watching-categorie").style.display = "none";
  }
}

function focusFunction(element) {
  element.focus();
}

function keyboardPressesHandling() {
  setupKeyPressesHandler();
  handleNavigationButtonsHandler(focusFunction);
  setupKeyPressesForInputElement(searchInput); 
}

handleSplashScreen();
triggerLoadingGif();
loadMovies();
resizeMoviesPostersContainers([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv, trendingDiv, collectionsDiv]);
loadIconsDynamically();
handlingMiddleRightDivResizing();
createSearchHistoryDropDown();
setupNavigationBtnHandler();
