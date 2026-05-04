let data = new URLSearchParams(window.location.search);
const genreId = data.get("GenreId");
const MediaType = data.get("MediaType") === "All" ? "movie" : data.get("MediaType");
const SortBase = data.get("SortBase") === "Default" ? "popularity.desc" : data.get("SortBase"); 

const RightmiddleDiv = document.getElementById("div-middle-right");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");
const loadingGif = document.getElementById("lds-dual-ring-container");
const searchInput = document.getElementById("input-searchForMovie");
const MediaSuggestions = document.getElementById("div-MediaSuggestions");

const SelectMediaType = document.getElementById("select-type");
const SelectGenre = document.getElementById("select-Genres");
const SelectSortBase = document.getElementById("select-sort");

setTimeout(() => {
  try {
    globalLoadingGif.style.opacity = "1" 
  } catch (err) {
    console.log(err) 
  } 
}, 100);

async function fetchData(apiKey, genreId, ThisMediaType, page) {
  const resolvedSortBy = 
    MediaType === "tv"
      ? SortBase.replace("primary_release_date", "first_air_date")
      : SortBase;

  const params = new URLSearchParams({
    api_key: apiKey,
    page:page,
    sort_by: resolvedSortBy,
    include_adult:false,
    "vote_count.gte": 2,
    ...( genreId.toLowerCase() !== "all" && {with_genres: genreId}),
  });
  const requestUrl = `https://api.themoviedb.org/3/discover/${ThisMediaType}?${params}`;

  const LibraryInformation = await loadLibraryInfo();
  try {
    const [GenreData] = await Promise.all([fetch(requestUrl).then(res => res.json())]);
    if (GenreData?.total_results) {
      insertMediaElements(GenreData.results, MediaSuggestions, ThisMediaType, LibraryInformation);
      loadingGif.style.display = "none";
    } else {
      throw new Error("No results found for this genre<br> try a different category");
    }
  } catch (err) {
    const WarningElement = DisplayWarningOrErrorForUser(err.message, false);
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
    RightmiddleDiv.classList.add("activate");
  }
}

async function loadGenres(apiKey) {
  SelectGenre.innerHTML = '<div class="select-option" role="option" value="All">All</div>';
  const requestUrl = `https://api.themoviedb.org/3/genre/${MediaType}/list?api_key=${apiKey}`;
  try {
    const [data] = await Promise.all([fetch(requestUrl).then(res => res.json())]);

    if (parseInt(data.status_code) === 7)
      throw new Error("We're having trouble loading data.</br>Please make sure your Authentication Key is valide!");

    const GenresData = data.genres;
    GenresData.forEach(GenreObj => {
      let optionElement = document.createElement("div");
      optionElement.className = "select-option";
      optionElement.setAttribute('role', 'option');
      optionElement.setAttribute('value', GenreObj.id);
      optionElement.textContent = GenreObj.name;
      SelectGenre.appendChild(optionElement);
    });
    
    setDropdownValue(SelectGenre, genreId);

    const currentGenre = GenresData.find(GObj => Number(GObj.id) === Number(genreId));
    if(currentGenre) changeDescriptionTitleValue(currentGenre.name);

  } catch(err) {
    setTimeout(() => {
      err.message = (err.message === "Failed to fetch") 
        ? "We're having trouble loading data.</br>Please Check your connection and refresh!" 
        : err.message;

      RightmiddleDiv.innerHTML = "";
      const WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.classList.add("activate");
    }, 800);
    console.error(err);
  };
}

async function loadMediaFromAPI(apiKey){
  MediaSuggestions.innerHTML = "";
  fetchData(apiKey, genreId, MediaType, 2);
  fetchData(apiKey, genreId, MediaType, 1);
}

function changeDescriptionTitleValue(titleValue){
  const descriptionTitle = document.querySelector(".div-categories-description h1");
  if(descriptionTitle)
    descriptionTitle.innerText = titleValue;
}

function addDropDownsEventListener(){
  [SelectMediaType, SelectGenre, SelectSortBase].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      const newGenreId = getDropdownValue(SelectGenre);
      const newMediaType = getDropdownValue(SelectMediaType);
      const sortBase = getDropdownValue(SelectSortBase);
      openDiscoveryPage(newGenreId, newMediaType, sortBase);
    });
  });
}

let numberOfLoadedPages = 2;
function detectWhenScrollsArriveAtTheEndOfAPage(apiKey){
  RightmiddleDiv.addEventListener('scroll', function () {
    const middleRightDivHeight = window.innerHeight - RightmiddleDiv.getBoundingClientRect().top;
    if (RightmiddleDiv.scrollTop + middleRightDivHeight + 30 >= RightmiddleDiv.scrollHeight) {
      loadingGif.style.display = "flex";
      numberOfLoadedPages += 2;
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, numberOfLoadedPages + 1);
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, numberOfLoadedPages);
    }
  });
}

async function loadCachedMediaData(cachedData){
  const containersData = cachedData?.containers_data;
  if(containersData) {
    MediaSuggestions.innerHTML = "";
    const lastLoadedPage = cachedData?.last_loaded_medias_page;
    numberOfLoadedPages = lastLoadedPage ?? 2;
    const allMediaElements = [];
    const allToggleToLibButtons = [];
    for(const mediaContainer of containersData) {
      if(mediaContainer.id) {
        const containerDomElement = document.getElementById(mediaContainer.id);
        if(!containerDomElement || !mediaContainer?.HTMLContent) continue;
        containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...containerDomElement.querySelectorAll(".div-MovieElement"));
        allToggleToLibButtons.push(...containerDomElement.querySelectorAll(".btn-toggle-in-library"));
      }
    }

    for(const mediaDomElement of allMediaElements) {
      if(mediaDomElement) {
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        const posterUrl = mediaDomElement.getAttribute("posterUrl");
        if(mediaId && mediaType) {
          const posterContainer = mediaDomElement.querySelector(".img-MoviePosterContainer");
          const posterElement = mediaDomElement.querySelector(".img-MoviePoster");
          loadImageWithAnimation(posterContainer,posterElement,posterUrl);
          addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType)
          addFloatingDivToDisplayFullTitle(mediaDomElement);
        }
      }
    }

    for(let toggleToLibButton of allToggleToLibButtons) {
      const thisMediaElement = toggleToLibButton?.parentElement;
      if(!thisMediaElement) continue;
      addToggleToLibButtonEventListener(
        toggleToLibButton,
        thisMediaElement.getAttribute("mediaId"),
        thisMediaElement.getAttribute("mediaType"),
      );
    }
  }
}

async function loadMedia(apiKey){
  const cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    await loadCachedMediaData(cachedMediaInfo);
    await loadCachedRightDivScrollValue(cachedMediaInfo);
    await loadCachedDropDownValue(cachedMediaInfo);
  }else{
    loadMediaFromAPI(apiKey);
  }
}

async function initPage(){
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
  await loadMedia(apiKey);
  await loadGenres(apiKey);

  dropDownInit();
  setDropdownValue(SelectMediaType, MediaType);
  setDropdownValue(SelectSortBase, SortBase);
  addDropDownsEventListener();

  globalLoadingGif.remove();
  RightmiddleDiv.classList.add("activate");

  detectWhenScrollsArriveAtTheEndOfAPage(apiKey);
}

function focusFunction(element) {
  element.focus();
}

initPage();
setupKeyPressesForInputElement(searchInput);
handleNavigationButtonsHandler(focusFunction);
setupKeyPressesHandler();
setLeftButtonStyle("btn-discover");
loadIconsDynamically();
handlingMiddleRightDivResizing();
