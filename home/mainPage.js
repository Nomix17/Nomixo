const RightmiddleDiv = document.getElementById("div-middle-right");
const continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
const popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
const popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
const searchInput = document.getElementById("input-searchForMovie");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

setTimeout(()=>{
  try {
    globalLoadingGif.style.opacity = "1"
  } catch(err) {
    console.log(err)
  }
},100);

async function loadMovies(){
  const apiKey = await window.electronAPI.getAPIKEY().then();
  const LibraryInformation = await loadLibraryInfo();

  try {
    const [MovieData,TVShowData,_] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
      fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
      manageLibraryData(apiKey,LibraryInformation)
    ]);
    if(parseInt(MovieData.status_code) === 7 && parseInt(TVShowData.status_code) === 7)
      throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
    const MoviesSearchResults =  MovieData.results;
    const TVShowSearchResults = TVShowData.results;

    insertMediaElements(MoviesSearchResults,popularMoviesDiv,"movie",LibraryInformation);
    insertMediaElements(TVShowSearchResults,popularSeriesDiv,"tv",LibraryInformation);
    checkIfDivShouldHaveMoveToRightOrLeftButton([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv]);

    globalLoadingGif.remove();
    RightmiddleDiv.style.opacity = 1;

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

loadMovies();

setupKeyPressesHandler();
handleNavigationButtonsHandler(focusFunction);
setLeftButtonStyle("btn-home");
setupKeyPressesForInputElement(searchInput); 
setupNavigationBtnHandler();
resizeMoviesPostersContainers([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv]);
loadIconsDynamically();
handlingMiddleRightDivResizing();
