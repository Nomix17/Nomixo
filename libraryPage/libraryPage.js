let SelectMediaType = document.getElementById("select-type");
let SavedMedia = document.getElementById("div-SavedMedia")
SelectMediaType.value = "all";

function fetchMediaData(apiKey,wholeLibraryInformation){
  wholeLibraryInformation.forEach(mediaEntryPoint =>{
    let MediaId = mediaEntryPoint.MediaId;
    let MediaType = mediaEntryPoint.MediaType;
    if(SelectMediaType.value == MediaType || SelectMediaType.value == "all"){
      let searchQuery = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;

      fetch(searchQuery)
        .then(res=>res.json())
        .then(data => SavedMedia.appendChild(createMediaElement(data,MediaType)));
    }
  });
}

function createMediaElement(mediaData, ThisMediaType){
      let Id = "Unknown";
      let Title = "Unknown";
      let Adult = "Unknown";
      let PosterImage = "Unknown";
      let MediaType = "Unknown";

      if(mediaData.hasOwnProperty("id")) Id = mediaData["id"];
      
      if(mediaData.hasOwnProperty("title")) Title = mediaData["title"];
      else Title = mediaData["name"];

      if(mediaData.hasOwnProperty("adult")) Adult = mediaData["adult"];
     
      if(mediaData.hasOwnProperty("poster_path") && mediaData["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w342/"+mediaData["poster_path"];
      else PosterImage = "../cache/PosterNotFound.png"
      if(mediaData.hasOwnProperty("media_type") && mediaData["media_type"] != null) MediaType = mediaData["media_type"];

      
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

      movieDomElement.addEventListener("click",function() {openDetailPage(Id,ThisMediaType)});
      return movieDomElement;
}

async function loadData(){
  // SavedMedia.innerHTML ="";
  const apiKey = await window.electronAPI.getAPIKEY();
  const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  if(wholeLibraryInformation == undefined){
    let EmptyLibraryElement = document.createElement("span");
    EmptyLibraryElement.innerText = "Your Library is Empty";
    SavedMedia.appendChild(EmptyLibraryElement);
    return;
  }
  
  let loadingGifDiv =  document.getElementById("div-loadingGifDiv");
  loadingGifDiv.innerHTML = "";
  fetchMediaData(apiKey,wholeLibraryInformation);

  SelectMediaType.addEventListener("change",()=>{
    MediaType = SelectMediaType.value;
    SavedMedia.innerHTML ="";
    fetchMediaData(apiKey,wholeLibraryInformation);
  });
}

loadData();

let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});


// on click functions
function openSearchPage(){
  let searchKeyword = document.getElementById("input-searchForMovie").value;
  path ="./search/searchPage.html?search="+searchKeyword;
  window.electronAPI.navigateTo(path);
}
function openDetailPage(movieId,mediaType){
  path = "./movieDetail/movieDetail.html?MovieId="+movieId+"&MediaType="+mediaType;
  window.electronAPI.navigateTo(path);
}
function backToHome(){
  path = "./home/mainPage.html"
  window.electronAPI.navigateTo(path);
}

function openDiscoveryPage(genreId, MediaType){
  let path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}

function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function OpenSettingsPage(){
  path = "./settingsPage/settingsPage.html"
  window.electronAPI.navigateTo(path);
}
