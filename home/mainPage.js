let continueWatchingDiv = document.getElementById("div-middle-right-continueWatching");
let popularMoviesDiv = document.getElementById("div-middle-right-popularMovies");
let popularSeriesDiv = document.getElementById("div-middle-right-popularSeries");
let searchInput = document.getElementById("input-searchForMovie");
let continueWatchingArray = [];
if(continueWatchingArray.length === 0) document.querySelector(".div-categories-description").remove();

async function loadMovies(){

  const apiKey = await window.electronAPI.getAPIKEY().then();

  Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`).then(res=>res.json()),
    fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`).then(res=>res.json())
  ]).then(([MovieData,TVShowData])=>{
      continueWatchingDiv.innerHTML = "";
      popularMoviesDiv.innerHTML = "";
      popularSeriesDiv.innerHTML = "";
   
      let MoviesSearchResults =  MovieData.results;
      let TVShowSearchResults = TVShowData.results;

      insertMovieElements(MoviesSearchResults);
      insertSerieElement(TVShowSearchResults);

  }).catch(err=>{
    if(err == "TypeError: results is undefined"){
      popularMoviesDiv.innerHTML = "<big>Cannot Found a Movie Named: "+ searchKeyword +"</big>";
      popularSeriesDiv.innerHTML = "<big>Cannot Found a Serie Named: "+ searchKeyword +"</big>";
      OtherRecommandationDiv.innerHTML = "<big>Cannot Find Any Piece of Media Named: "+searchKeyword +"</big>";
    } 
    console.log(err);
  });
}

loadMovies()

// resize the Movies Element Containers when resizing the page
const resizeMoviesPostersContainers = ()=>{
  let middleLeftBarWidth = document.getElementById("div-middle-left").offsetWidth;
  let marginValue = 10;
  let newMoviesPostersContainerWidth = window.innerWidth - middleLeftBarWidth-80;
  continueWatchingDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  popularMoviesDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  popularSeriesDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
};

resizeMoviesPostersContainers();
window.addEventListener("resize",resizeMoviesPostersContainers);
window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

// when pressing enter to search 
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});



function insertMovieElements(MoviesSearchResults){
  MoviesSearchResults.reverse().forEach(obj => {
    let Id = "Unknown";
    let Title = "Unknown";
    let Adult = "Unknown";
    let PosterImage = "Unknown";
    let MediaType = "movie";
    
    if(obj.hasOwnProperty("id")) Id = obj["id"];
    
    if(obj.hasOwnProperty("title")) Title = obj["title"];
    else Title = obj["name"];

    if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
    
    if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
    else PosterImage = "../cache/PosterNotFound.png"

    
    let movieDomElement = document.createElement("div");
    let moviePosterElement = document.createElement("img");
    let movieNameElement = document.createElement("p");

    movieNameElement.innerText = Title;
    moviePosterElement.src = PosterImage;
    
    movieDomElement.classList.add("div-MovieElement");
    moviePosterElement.classList.add("img-MoviePoster");
    movieNameElement.classList.add("parag-MovieTitle");

    movieDomElement.appendChild(moviePosterElement);
    movieDomElement.appendChild(movieNameElement); 

    movieDomElement.addEventListener("click",function() {openDetailPage(Id,MediaType)});
    if(MediaType.toLowerCase() == "movie") popularMoviesDiv.prepend(movieDomElement);
  });
}


function insertSerieElement(TVShowSearchResults){
      TVShowSearchResults.reverse().forEach(obj => {
      let Id = "Unknown";
      let Title = "Unknown";
      let Adult = "Unknown";
      let PosterImage = "Unknown";
      let MediaType = "tv";
      
      if(obj.hasOwnProperty("id")) Id = obj["id"];
      
      if(obj.hasOwnProperty("title")) Title = obj["title"];
      else Title = obj["name"];

      if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
     
      if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null)  PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
      else PosterImage = "../cache/PosterNotFound.png"

      
      let movieDomElement = document.createElement("div");
      let moviePosterElement = document.createElement("img");
      let movieNameElement = document.createElement("p");

      movieNameElement.innerText = Title;
      moviePosterElement.src = PosterImage;
      
      movieDomElement.classList.add("div-MovieElement");
      moviePosterElement.classList.add("img-MoviePoster");
      movieNameElement.classList.add("parag-MovieTitle");

      movieDomElement.appendChild(moviePosterElement);
      movieDomElement.appendChild(movieNameElement); 

      movieDomElement.addEventListener("click",function() {openDetailPage(Id,MediaType)});
      if(MediaType.toLowerCase() == "tv") popularSeriesDiv.prepend(movieDomElement);
    });
}




// open a Movie details page when pressing a movie element
function openDetailPage(movieId,mediaType){
  let path = "./movieDetail/movieDetail.html?MovieId="+movieId+"&MediaType="+mediaType;
  window.electronAPI.navigateTo(path);
}


// on click functions
function openSearchPage(){
  let searchKeyword = searchInput.value;
  if(searchKeyword !=""){
    let path ="./search/searchPage.html?search="+searchKeyword;
    window.electronAPI.navigateTo(path);
  }
}

function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function backToHome(){
  let path = "./home/mainPage.html";
  window.electronAPI.navigateTo(path);
}
function openDiscoveryPage(genreId, MediaType){
  let path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}

