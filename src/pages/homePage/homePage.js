const RightmiddleDiv = document.getElementById("div-middle-right");
const continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
const popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
const popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
const trendingDiv = document.getElementById("div-middle-right-trending");
const collectionsDiv = document.getElementById("div-middle-right-collections");
const searchInput = document.getElementById("input-searchForMovie");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const COLLECTION_IDS = [
  10, 1241, 435259, 119, 121938, 84, 645, 87359, 9485, 328,
  10194, 2150, 8354, 86066, 544669, 14740, 77816, 89137, 386382, 87118,
  137697, 468222, 137696, 2344, 528, 8091, 399, 1575, 553717, 5039,
  1570, 945, 8945, 264, 295, 263, 120794, 8537, 556, 125574,
  531241, 573436, 86311, 131292, 131296, 131295, 284433, 422834, 529892, 618529,
  748, 453993, 448150, 558216, 9744, 114431, 8650, 1709, 173710, 535313,
  1539140, 1733, 86055, 2980, 89151, 2366, 91361, 9735, 8581, 2602,
  656, 313086, 228446, 41437, 8864, 17255, 12263, 1960, 111751, 10455,
  8917, 256322, 521226, 131635, 33514, 283579, 295130, 420, 179919, 115575,
  151, 115570, 1006, 2806, 86119, 4246, 9338, 37139, 51509, 86117,
  937, 130440, 31562, 404609, 135483, 126125, 2883, 304, 90863, 14890,
  85861, 10456, 102322, 391860, 2467, 2326, 735, 17235, 9818, 726871,
  87096, 468552, 573693, 987044, 724848, 531242, 1582, 708816, 720879, 1434561,
  531315, 489724, 185103, 94602, 464577, 325470, 529, 899158, 488924, 595693,
  94032, 762512, 86027, 153010, 33085, 531330, 1022790, 1241984, 1451277, 1451578,
  1084247, 404825, 1268789, 531799, 97461, 531331, 87236, 106768, 97459, 527439,
  9888, 85943, 495527, 306031, 86092, 87253, 458558, 86083, 86058, 86024,
  8936, 50457, 344830, 328247, 96665, 3167, 43072, 945475, 11716, 86860,
  86115, 125577, 167613, 3169, 99727, 9435, 114783, 86486, 86110, 508783,
  8580, 722961, 93791, 352789, 266672, 179892, 382685, 722971, 403374, 192492
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
