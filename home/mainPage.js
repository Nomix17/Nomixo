let RightmiddleDiv = document.getElementById("div-middle-right");
let continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
let popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
let popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
let searchInput = document.getElementById("input-searchForMovie");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

let LibraryInformation ;
let SelectedMediaDivIndex = -1;

setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

async function loadMovies(){

  const apiKey = await window.electronAPI.getAPIKEY().then();

  LibraryInformation = await loadLibraryInfo();
  let continueWatchingMediaFromLibrary = LibraryInformation.filter(item => item?.typeOfSave.includes("Currently Watching"));
  if(continueWatchingMediaFromLibrary.length)
    fetchMediaDataFromLibrary(apiKey,continueWatchingMediaFromLibrary,continueWatchingDiv,globalLoadingGif,RightmiddleDiv);
  else
    document.getElementById("continue-watching-categorie").style.display = "none";

  Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
    fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`).then(res=>res.json())
  ]).then(([MovieData,TVShowData])=>{
      popularMoviesDiv.innerHTML = "";
      popularSeriesDiv.innerHTML = "";
      if(MovieData.status_code == 7 && TVShowData.status_code == 7) throw new Error("We’re having trouble loading data.</br>Please make sure your Authentication Key is valide!");
      let MoviesSearchResults =  MovieData.results;
      let TVShowSearchResults = TVShowData.results;
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
      insertMediaElements(MoviesSearchResults,popularMoviesDiv,"movie",LibraryInformation);
      insertMediaElements(TVShowSearchResults,popularSeriesDiv,"tv",LibraryInformation);
      checkIfDivShouldHaveMoveToRightOrLeftButton([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv]);
  }).catch(err=>{
    err.message = (err.message == "Failed to fetch") ? "We’re having trouble loading data.</br>Please Check your connection and refresh!":err.message;
    console.error(err);
    setTimeout(()=>{
      RightmiddleDiv.innerHTML ="";
      let WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    },800);
  });

}



loadMovies();

setupKeyPressesHandler();

setLeftButtonStyle("btn-home");

setupKeyPressesForInputElement(searchInput); 

setupNavigationBtnHandler();

resizeMoviesPostersContainers([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv]);

loadIconsDynamically();

handlingMiddleRightDivResizing();
