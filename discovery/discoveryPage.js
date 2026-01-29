let data = new URLSearchParams(window.location.search);
let genreId = data.get("GenreId");
let MediaType = data.get("MediaType") === "All" ? "movie" : data.get("MediaType");

let RightmiddleDiv = document.getElementById("div-middle-right");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
let loadingGif = document.getElementById("lds-dual-ring-container");
let searchInput = document.getElementById("input-searchForMovie");
let SelectMediaType = document.getElementById("select-type");
let SelectGenre = document.getElementById("select-Genres");
let MediaSuggestions = document.getElementById("div-MediaSuggestions");

let LibraryInformation = [];

addSmoothTransition();
setTimeout(() => { try { globalLoadingGif.style.opacity = "1" } catch (err) { console.log(err) } }, 100);

async function fetchData(apiKey, genreId, ThisMediaType, page) {
  let url = "";

  if (genreId.toLowerCase() === "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;

  if (!LibraryInformation.length) LibraryInformation = await loadLibraryInfo();
  Promise.all([fetch(url).then(res => res.json())])
    .then(GenreData => {
      if(GenreData[0].total_results){
        insertMediaElements(GenreData[0].results, MediaSuggestions, ThisMediaType, LibraryInformation);
        loadingGif.style.display = "none";
      }else{
        throw new Error("No results found for this genre<br> try a different category");
      }
    })
    .catch(err=>{
      let WarningElement = DisplayWarningOrErrorForUser(err.message,false);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    });
}

function loadGenres(apiKey) {
  SelectGenre.innerHTML = '<div class="select-option" role="option" value="All">All</div>';

  let url = `https://api.themoviedb.org/3/genre/${MediaType}/list?api_key=${apiKey}`;
  if (MediaType === "All") url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
  
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      if (parseInt(data.status_code) === 7)
        throw new Error("We're having trouble loading data.</br>Please make sure your Authentication Key is valide!");

      let GenresData = data.genres;
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
      if(currentGenre)
        changeDescriptionTitleValue(currentGenre.name);

    })
    .catch(err => {
      setTimeout(() => {
        err.message = (err.message === "Failed to fetch") 
          ? "We're having trouble loading data.</br>Please Check your connection and refresh!" 
          : err.message;

        console.error(err);
        RightmiddleDiv.innerHTML = "";
        let WarningElement = DisplayWarningOrErrorForUser(err.message);
        RightmiddleDiv.appendChild(WarningElement);
        globalLoadingGif.remove();
        RightmiddleDiv.style.opacity = 1;
      }, 800);
    });
}

async function loadMediaFromAPI(apiKey){
  MediaSuggestions.innerHTML = "";
  fetchData(apiKey, genreId, MediaType, 2);
  fetchData(apiKey, genreId, MediaType, 1);
}

function changeDescriptionTitleValue(titleValue){
  let categoriDescription = document.querySelector(".div-categories-description");
  let descriptionTitle = categoriDescription ? categoriDescription.querySelector("h1") : null;
  if(descriptionTitle)
    descriptionTitle.innerText = titleValue;
}

function addDropDownsEventListener(){
  [SelectMediaType,SelectGenre].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      let newGenreId = getDropdownValue(SelectGenre);
      let newMediaType = getDropdownValue(SelectMediaType);
      openDiscoveryPage(newGenreId, newMediaType);
    });
  });
}

let numberOfLoadedPages = 2;
function detectWhenScrollsArriveAtTheEndOfAPage(apiKey){
  RightmiddleDiv.addEventListener('scroll', function () {
    let middleRightDivHeight = window.innerHeight - RightmiddleDiv.getBoundingClientRect().top;
    if (RightmiddleDiv.scrollTop + middleRightDivHeight + 30 >= RightmiddleDiv.scrollHeight) {
      loadingGif.style.display = "flex";
      numberOfLoadedPages += 2;
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, numberOfLoadedPages + 1);
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, numberOfLoadedPages);
    }
  });
}

async function loadCachedMediaData(cachedData){
  let containersData = cachedData?.containers_data;

  if(containersData){
    let lastLoadedPage = cachedData?.last_loaded_medias_page;
    numberOfLoadedPages = lastLoadedPage ?? 2;

    MediaSuggestions.innerHTML = "";

    let allMediaElements = [];
    let allToggleToLibButtons = [];
    for(let mediaContainer of containersData){
      if(mediaContainer.id){
        let containerDomElement = document.getElementById(mediaContainer.id);
        if(containerDomElement && mediaContainer?.HTMLContent) containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...Array.from(document.querySelectorAll(".div-MovieElement")))
        allToggleToLibButtons.push(...Array.from(document.querySelectorAll(".btn-toggle-in-library")));
      }
    }

    for(let mediaDomElement of allMediaElements){
      if(mediaDomElement){
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        const posterUrl = mediaDomElement.getAttribute("posterUrl");
        if(mediaId && mediaType){
          const posterContainer = mediaDomElement.querySelector(".img-MoviePosterContainer");
          const posterElement = mediaDomElement.querySelector(".img-MoviePoster");
          loadImageWithAnimation(posterContainer,posterElement,posterUrl);
          addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType)
        }
      }
    }

    for(let toggleToLibButton of allToggleToLibButtons){
      let thisMediaElement = toggleToLibButton.parentElement;
      if(thisMediaElement && toggleToLibButton) {
        const mediaId = thisMediaElement.getAttribute("mediaId");
        const mediaType = thisMediaElement.getAttribute("mediaType");
        addToggleToLibButtonEventListener(toggleToLibButton,mediaId,mediaType)
      }
    }

  }
}

async function loadCachedDropDownValue(cachedData){
  let dropDownsData = cachedData?.dropdowns_data;
  if(dropDownsData){
    for(let dropDownInfo of dropDownsData){
      if(dropDownInfo.id){
        let dropDownDomElement = document.getElementById(dropDownInfo.id);
        if(dropDownDomElement && dropDownInfo?.cachedValue){
          setDropdownValue(dropDownDomElement,dropDownInfo.cachedValue);
        }
      }
    }
  }
}

async function loadMedia(apiKey){
  let cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);

  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    loadCachedMediaData(cachedMediaInfo);
    loadCachedRightDivScrollValue(cachedMediaInfo);
    loadCachedDropDownValue(cachedMediaInfo);

  }else{
    loadMediaFromAPI(apiKey);
  }
}

async function initPage(){
  const apiKey = await window.electronAPI.getAPIKEY();

  await loadMedia(apiKey);
  await loadGenres(apiKey);

  dropDownInit();
  setDropdownValue(SelectMediaType, MediaType);
  addDropDownsEventListener();

  globalLoadingGif.remove();
  RightmiddleDiv.style.opacity = 1;

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
