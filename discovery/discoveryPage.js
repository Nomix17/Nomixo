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

setDropdownValue(SelectMediaType, MediaType);

addSmoothTransition();
setTimeout(() => { try { globalLoadingGif.style.opacity = "1" } catch (err) { console.log(err) } }, 100);

async function fetchData(apiKey, genreId, ThisMediaType, page) {
  let url = "";
  ThisMediaType = getDropdownValue(SelectMediaType);

  if (genreId.toLowerCase() === "all") url = `https://api.themoviedb.org/3/${ThisMediaType}/popular?api_key=${apiKey}&page=${page}`;
  else url = `https://api.themoviedb.org/3/discover/${ThisMediaType}?api_key=${apiKey}&with_genres=${genreId}&page=${page}`;

  if (!LibraryInformation.length) LibraryInformation = await loadLibraryInfo();
  Promise.all([fetch(url).then(res => res.json())])
    .then(GenreData => {
      if(GenreData[0].total_results){
        insertMediaElements(GenreData[0].results, MediaSuggestions, ThisMediaType, LibraryInformation);
        MediaSuggestions.appendChild(globalLoadingGif);
        globalLoadingGif.remove();
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
  SelectGenre.innerHTML = "";
  MediaType = getDropdownValue(SelectMediaType);
  
  SelectGenre.innerHTML = '<div class="select-option" role="option" value="All">All</div>';
  
  let url = `https://api.themoviedb.org/3/genre/${MediaType}/list?api_key=${apiKey}`;
  if (MediaType === "All") url = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
  
  return fetch(url)
    .then(res => res.json())
    .then(data => {
      if (parseInt(data.status_code) === 7) throw new Error("We're having trouble loading data.</br>Please make sure your Authentication Key is valide!");
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
      RightmiddleDiv.style.opacity = 1;
    })
    .catch(err => {
      setTimeout(() => {
        err.message = (err.message === "Failed to fetch") ? "We're having trouble loading data.</br>Please Check your connection and refresh!" : err.message;
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


async function loadCachedMedia(cachedData,LibraryInformation){
  let RightmiddleDivScrollTopValue = cachedData.right_middle_div_top_scroll_value;
  let MediaElementsInformation = cachedData.suggested_media_elements;
  let lastLoadedPage = cachedData.last_loaded_medias_page;

  pageLoaded = lastLoadedPage ?? 2;

  MediaSuggestions.innerHTML = "";
  insertMediaElements(MediaElementsInformation,MediaSuggestions,"movie",LibraryInformation);

  globalLoadingGif.remove();
  RightmiddleDiv.style.opacity = 1;
  RightmiddleDiv.scrollTop = RightmiddleDivScrollTopValue;
}

async function loadMedia(){
  let cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const apiKey = await window.electronAPI.getAPIKEY();

  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    loadCachedMedia(cachedMediaInfo,LibraryInformation)
  }else{
    loadMediaFromAPI(apiKey);
  }

  await loadGenres(apiKey);

  dropDownInit();

  [SelectMediaType,SelectGenre].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      let newGenreId = getDropdownValue(SelectGenre);
      let newMediaType = getDropdownValue(SelectMediaType);
      openDiscoveryPage(newGenreId, newMediaType);
    });
  });

  detectWhenScrollsArriveAtTheEndOfAPage(apiKey);
}

let pageLoaded = 2;
function detectWhenScrollsArriveAtTheEndOfAPage(apiKey){
  RightmiddleDiv.addEventListener('scroll', function () {
    let middleRightDivHeight = window.innerHeight - RightmiddleDiv.getBoundingClientRect().top;
    if (RightmiddleDiv.scrollTop + middleRightDivHeight + 30 >= RightmiddleDiv.scrollHeight) {
      loadingGif.style.display = "flex";
      pageLoaded += 2;
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, pageLoaded + 1);
      fetchData(apiKey, getDropdownValue(SelectGenre), MediaType, pageLoaded);
    }
  });
}

loadMedia();

setupKeyPressesForInputElement(searchInput);
setupKeyPressesHandler();
setLeftButtonStyle("btn-discover");
loadIconsDynamically();
handlingMiddleRightDivResizing();
