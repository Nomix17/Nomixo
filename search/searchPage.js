let MoviesRecommandationDiv = document.getElementById("div-middle-right-MoviesRecommandations");
let SeriesRecommandationDiv = document.getElementById("div-middle-right-SeriesRecommandations");
let FiguresRecommandationDiv = document.getElementById("div-middle-right-FiguresRecommandations");
let OtherRecommandationDiv = document.getElementById("div-middle-right-OtherRecommandations");

let searchInput = document.getElementById("input-searchForMovie");

const params = new URLSearchParams(window.location.search);
let searchKeyword = params.get("search");
const apiKey = window.electronAPI.getAPIKEY();

document.title = searchKeyword +" - Nomixo";
searchInput.value = searchKeyword; //setting the input value to the keyword that was searched
let searchQuery = searchKeyword.replaceAll(" ","%20");

async function loadData(){
  const apiKey = await window.electronAPI.getAPIKEY();
  loadSearchInformation(apiKey);
}

function loadSearchInformation(apiKey){
  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${searchQuery}`)
    .then(res => res.json())
    .then(data => {
      MoviesRecommandationDiv.innerHTML = "";
      SeriesRecommandationDiv.innerHTML = "";
      FiguresRecommandationDiv.innerHTML = "";
      OtherRecommandationDiv.innerHTML = "";
      insertResultsElement(data);

      if(MoviesRecommandationDiv.innerHTML == "") document.getElementById("MoviesRecommandationsContainer").remove();
      if(SeriesRecommandationDiv.innerHTML == "") document.getElementById("SeriesRecommandationsContainer").remove();
      if(FiguresRecommandationDiv.innerHTML == "") document.getElementById("FiguresRecommandationsContainer").remove();
      if(OtherRecommandationDiv.innerHTML == "") document.getElementById("OtherRecommandationsContainer").remove();
    
      if(data.results.length == 0) throw new Error(`Cannot Found Any Media Named: ${searchKeyword}`)

  }).catch(err=>{
    let middleDiv = document.getElementById("div-middle-right");
    let NotFoundDiv = document.createElement("div");
    let fullScreenWith = document.body.offsetWidth;
    let leftDivWidth = document.getElementById("div-middle-left").offsetWidth;

    NotFoundDiv.innerHTML = `<p>${err.message}</p>`
    NotFoundDiv.style = `display:flex;
                         align-items:center;
                         justify-content:center;
                         height:80%;`;

    NotFoundDiv.firstChild.style = `
                        margin-right: ${leftDivWidth}px;
                        font-size:20px;
                        font-weight: 700;
                        background-color:rgba(0,0,0,0);
                        color: rgba(255,255,255,0.6);`;

    middleDiv.appendChild(NotFoundDiv);
    console.log(err);
  });
}


function insertResultsElement(data){
  let searchResults = data.results;
  console.log(searchResults);
  searchResults.forEach(obj => {
    let Id = "Unknown";
    let Title = "Unknown";
    let Adult = "Unknown";
    let PosterImage = "Unknown";
    let MediaType = "Unknown";
    let isAnime = false;

    if(obj.hasOwnProperty("id")) Id = obj["id"];
    
    if(obj.hasOwnProperty("title")) Title = obj["title"];
    else Title = obj["name"];

    if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
    if(obj.hasOwnProperty("media_type")) MediaType = obj["media_type"];
 
    if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
    else if(obj.hasOwnProperty("profile_path") && obj["profile_path"] != null)  PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["profile_path"];
    else if(MediaType == "person") PosterImage = "../cache/ProfileNotFound.png"
    else PosterImage = "../cache/PosterNotFound.png"
    if((obj.hasOwnProperty("original_language")) && obj.hasOwnProperty("genre_ids")){
      let mediaIsFromJapan = false;
      if(obj.hasOwnProperty("origin_country"))
        mediaIsFromJapan = obj["origin_country"].includes("JP");
      else
        mediaIsFromJapan = obj["original_language"].includes("ja");

      let mediaIsAnimation = obj["genre_ids"].includes(16);
      isAnime = mediaIsFromJapan;
    }
    
    console.log(isAnime)

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
    if(MediaType.toLowerCase() == "movie") MoviesRecommandationDiv.append(movieDomElement);
    else if(MediaType.toLowerCase() == "tv") SeriesRecommandationDiv.append(movieDomElement);
    else if(MediaType.toLowerCase() == "person") FiguresRecommandationDiv.append(movieDomElement);
    else OtherRecommandationDiv.prepend(movieDomElement);
  });
}

loadData();

// resize the Movies Element Container when resizing the window
const resizeMoviesPostersContainers = ()=>{
  let middleLeftBarWidth = document.getElementById("div-middle-left").offsetWidth;
  let marginValue = 10;
  let newMoviesPostersContainerWidth = window.innerWidth - middleLeftBarWidth-80;
  MoviesRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  SeriesRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  FiguresRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
  OtherRecommandationDiv.setAttribute("style",`max-width:${newMoviesPostersContainerWidth};`);
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
    path ="./search/searchPage.html?search="+searchKeyword;
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

function OpenSettingsPage(){
  path = "./settingsPage/settingsPage.html"
  window.electronAPI.navigateTo(path);
}
