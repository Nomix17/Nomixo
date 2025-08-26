let continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
let popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
let popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
let searchInput = document.getElementById("input-searchForMovie");
let continueWatchingArray = [];
let LibraryInformation ;


if(continueWatchingArray.length === 0) document.querySelector(".div-categories-description").remove();

async function loadMovies(){

  const apiKey = await window.electronAPI.getAPIKEY().then();

  LibraryInformation = await loadLibraryInfo();

  Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
    fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`).then(res=>res.json())
  ]).then(([MovieData,TVShowData])=>{
      continueWatchingDiv.innerHTML = "";
      popularMoviesDiv.innerHTML = "";
      popularSeriesDiv.innerHTML = "";
   
      let MoviesSearchResults =  MovieData.results;
      let TVShowSearchResults = TVShowData.results;
      console.log(MoviesSearchResults);
      insertMediaElements(MoviesSearchResults,popularMoviesDiv,"movie",LibraryInformation);
      insertMediaElements(TVShowSearchResults,popularSeriesDiv,"tv",LibraryInformation);

  }).catch(err=>{
    if(err == "TypeError: results is undefined"){
      popularMoviesDiv.innerHTML = "<big>Cannot Found a Movie Named: "+ searchKeyword +"</big>";
      popularSeriesDiv.innerHTML = "<big>Cannot Found a Serie Named: "+ searchKeyword +"</big>";
      OtherRecommandationDiv.innerHTML = "<big>Cannot Find Any Piece of Media Named: "+searchKeyword +"</big>";
    } 
    console.log(err);
  });
}



loadMovies();

addSmoothTransition();

setupKeyPressesHandler();

setupWindowResizingHandler();

setLeftButtonStyle("btn-home");

setupKeyPressesForInputElement(searchInput); 

resizeMoviesPostersContainers([popularMoviesDiv,popularSeriesDiv, continueWatchingDiv]);

