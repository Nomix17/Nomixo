let MoviesRecommandationDiv = document.getElementById("div-middle-right-MoviesRecommandations");
let SeriesRecommandationDiv = document.getElementById("div-middle-right-SeriesRecommandations");
let OtherRecommandationDiv = document.getElementById("div-middle-right-OtherRecommandations");
let searchInput = document.getElementById("input-searchForMovie");

const params = new URLSearchParams(window.location.search);
let searchKeyword = params.get("search");
const apiKey = "api_Key";

document.title = searchKeyword +" - Nomixo";
searchInput.value = searchKeyword; //setting the input value to the keyword that was searched

let searchQuery = searchKeyword.replaceAll(" ","%20");
fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${searchQuery}`)
  .then(res => res.json())
  .then(data => {
    MoviesRecommandationDiv.innerHTML = "";
    SeriesRecommandationDiv.innerHTML = "";
    OtherRecommandationDiv .innerHTML = "";
    insertResultsElement(data);
}).catch(err=>{
  if(err == "TypeError: results is undefined"){
    MoviesRecommandationDiv.innerHTML = "<big>Cannot Found a Movie Named: "+ searchKeyword +"</big>";
    SeriesRecommandationDiv.innerHTML = "<big>Cannot Found a Serie Named: "+ searchKeyword +"</big>";
    OtherRecommandationDiv.innerHTML = "<big>Cannot Find Any Piece of Media Named: "+searchKeyword +"</big>";
  }
  console.log(err);
});



// resize the Movies Element Container when resizing the window
const resizeMoviesPostersContainers = ()=>{
  let middleLeftBarWidth = document.getElementById("div-middle-left").offsetWidth;
  let marginValue = 10;
  let newMoviesPostersContainerWidth = window.innerWidth - middleLeftBarWidth-80;
  MoviesRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  SeriesRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
};

resizeMoviesPostersContainers();
window.addEventListener("resize",resizeMoviesPostersContainers);
window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

// handle enter key press when using the search input
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});




function insertResultsElement(data){
  let searchResults = data.results;
  searchResults.reverse().forEach(obj => {
    let Id = "Unknown";
    let Title = "Unknown";
    let Adult = "Unknown";
    let PosterImage = "Unknown";
    let MediaType = "Unknown";
    if(obj.hasOwnProperty("id")) Id = obj["id"];
    
    if(obj.hasOwnProperty("title")) Title = obj["title"];
    else Title = obj["name"];

    if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
     
    if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
    else if(obj.hasOwnProperty("profile_path") && obj["profile_path"] != null)  PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["profile_path"];
    else PosterImage = "../cache/PosterNotFound.png"

    if(obj.hasOwnProperty("media_type")) MediaType = obj["media_type"];
    
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

    movieDomElement.addEventListener("click",function(){openMovieDetails(Id,MediaType)});
    if(MediaType.toLowerCase() == "movie") MoviesRecommandationDiv.prepend(movieDomElement);
    else if(MediaType.toLowerCase() == "tv") SeriesRecommandationDiv.prepend(movieDomElement);
    else OtherRecommandationDiv.prepend(movieDomElement);
  });
}


//on click functions 
// open a Movie details page when pressing a movie element
function openMovieDetails(Id,mediaType){
  let path;
  if(mediaType == "person") path = "./personDetails/personDetails.html?personId="+Id;
  else path = "./movieDetail/movieDetail.html?MovieId="+Id+"&MediaType="+mediaType;
  window.electronAPI.navigateTo(path);
}

// open the search page when pressing the search button
function openSearchPage(){
  let path;
  let searchKeyword = searchInput.value;
  if(searchKeyword !=""){
    path ="searchPage.html?search="+searchKeyword;
    window.electronAPI.navigateTo(path);
  }
} 

// go back to home when pressing home button 
function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function backToHome(){
  path = "./home/mainPage.html"
  window.electronAPI.navigateTo(path);

}

function openDiscoveryPage(genreId, MediaType){
  path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}
