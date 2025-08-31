window.addSmoothTransition = function(){
  setTimeout(()=>{
    document.body.style.opacity = "1";
  },81);
}

window.resizeMoviesPostersContainers = (divsToResize)=>{
  CalculateMoviePostersContainer(divsToResize);
  checkIfDivShouldHaveMoveToRightOrLeftButton(divsToResize);
  window.addEventListener("resize",() => {
    CalculateMoviePostersContainer(divsToResize);
    checkIfDivShouldHaveMoveToRightOrLeftButton(divsToResize);
  });
};

function CalculateMoviePostersContainer(divsToResize){
  let middleLeftBarWidth = document.getElementById("div-middle-left").offsetWidth;
  let marginValue = 40;
  let newMoviesPostersContainerWidth = window.innerWidth - middleLeftBarWidth-marginValue;
  divsToResize.forEach(div => {
    div.style = `max-width:${newMoviesPostersContainerWidth}`;
  });
}

window.checkIfDivShouldHaveMoveToRightOrLeftButton = (MediaDivs) => {
  MediaDivs.forEach(MediaDiv => {
    if(MediaDiv.scrollWidth == MediaDiv.clientWidth)
      MediaDiv.parentElement.querySelectorAll("button").forEach(btn => btn.style.display = "none");
    else
      MediaDiv.parentElement.querySelectorAll("button").forEach(btn => btn.style.display = "flex");
  });
}

window.insertMediaElements = function(MediaSearchResults,MediaContainer,MediaType,LibraryInformation){
  let tempArray = [];
  if(MediaSearchResults == undefined || MediaSearchResults.length == 0) throw new Error("No data was Fetched");
  MediaSearchResults.forEach(obj => {
    let Id = "Unknown";
    let Title = "Unknown";
    let Adult = "Unknown";
    let PosterImage = "Unknown";
    let NewMediaType = MediaType;

    if(obj.hasOwnProperty("id")) Id = obj["id"];
    
    if(obj.hasOwnProperty("title")) Title = obj["title"];
    else Title = obj["name"];

    if(!tempArray.includes(Title)){
      tempArray.push(Title); 
      if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
      
      if(obj.hasOwnProperty("media_type") && obj["media_type"] != null) NewMediaType = obj["media_type"];

      if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
      else if(obj.hasOwnProperty("profile_path") && obj["profile_path"] != null)  PosterImage = "https://image.tmdb.org/t/p/w500/"+obj["profile_path"];
      else if(NewMediaType == "person") PosterImage = "../cache/ProfileNotFound.png"
      else PosterImage = "../cache/PosterNotFound.png"
      
      let mediaDomElement = document.createElement("div");
      let moviePosterElement = document.createElement("img");
      let toggleInLibraryBtn = document.createElement("button"); 
      let movieNameElement = document.createElement("p");

      movieNameElement.innerText = Title;
      moviePosterElement.src = PosterImage;
      
      mediaDomElement.classList.add("div-MovieElement");
      moviePosterElement.classList.add("img-MoviePoster");
      toggleInLibraryBtn.classList.add("btn-toggle-in-library");
      movieNameElement.classList.add("parag-MovieTitle");

      let mediaIsInLibrary = LibraryInformation.filter(libraryEntryPoint => libraryEntryPoint.MediaId == Id && libraryEntryPoint.MediaType == NewMediaType).length?2:0;
      if(mediaIsInLibrary) setAddToLibraryButtonToPressed(toggleInLibraryBtn);
      else setAddToLibraryButtonToNormal(toggleInLibraryBtn)

      mediaDomElement.appendChild(moviePosterElement);
      if(NewMediaType.toLowerCase() != "person") mediaDomElement.appendChild(toggleInLibraryBtn);
      mediaDomElement.appendChild(movieNameElement);

      toggleInLibraryBtn.addEventListener("click",function() {ToggleInLibrary(Id,NewMediaType,toggleInLibraryBtn)});
      mediaDomElement.addEventListener("click",function() {openDetailPage(Id,NewMediaType)});

      if(MediaContainer.length == undefined){
        MediaContainer.appendChild(mediaDomElement);
      }else{
        if(NewMediaType.toLowerCase() == "movie") MediaContainer[0].append(mediaDomElement);
        else if(NewMediaType.toLowerCase() == "tv" || NewMediaType.toLowerCase() == "anime" ) MediaContainer[1].append(mediaDomElement);
        else if(NewMediaType.toLowerCase() == "person") MediaContainer[2].append(mediaDomElement);
        else MediaContainer[3].append(mediaDomElement);
      } 
    }
  });
}


window.setAddToLibraryButtonToNormal = (toggleInLibrary) => {
  toggleInLibrary.innerHTML = `<svg class="toggleButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                 <use href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/regular/bookmark.svg"></use>
                               </svg>`;
  toggleInLibrary.removeAttribute("pressed");
}

window.setAddToLibraryButtonToPressed = (toggleInLibrary) => {
  toggleInLibrary.innerHTML = `            
   <svg class="toggleButtonIcon" style="margin-left:3px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M64 0C28.7 0 0 28.7 0 64L0 480c0 11.5 6.2 22.2 16.2 27.8s22.3 5.5 32.2-.4L192 421.3 335.5 507.4c9.9 5.9 22.2 6.1 32.2 .4S384 491.5 384 480l0-416c0-35.3-28.7-64-64-64L64 0z"/>
  </svg> `;
  toggleInLibrary.setAttribute("pressed"," ");
}

window.ToggleInLibrary = (mediaId,mediaType,parentDiv) => {
  let toggleInLibraryElement = event.target;
  if(toggleInLibraryElement.hasAttribute("pressed")){
    setAddToLibraryButtonToNormal(toggleInLibraryElement);
    let MediaLibraryObject = {
      MediaId:mediaId,
      MediaType:mediaType
    }
    window.electronAPI.removeMediaFromLibrary(MediaLibraryObject);
  }else{
    setAddToLibraryButtonToPressed(toggleInLibraryElement);
    let MediaLibraryObject = {
      MediaId:mediaId,
      MediaType:mediaType,
      episodesWatched:[],
      lastPlaybackPosition:0,
      timeWatched:0
    }
    window.electronAPI.addMediaToLibrary(MediaLibraryObject);
  }
  event.stopPropagation();
}

async function loadLibraryInfo(){
  const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  if(wholeLibraryInformation == undefined){
    return [];
  }
  return wholeLibraryInformation;
}

window.setLeftButtonStyle = (buttonId) => {
  let targetedButton = document.getElementById(buttonId);
  let buttonIcon = targetedButton.querySelector(".icon");
  buttonIcon.style.fill = "rgba(var(--icon-hover-color))";
}

window.setupKeyPressesForInputElement = (searchInput)=>{
  searchInput.addEventListener("keypress",(event)=>{
    if(event.key == "Enter") openSearchPage();
  });
}

window.setupKeyPressesHandler = () =>{
  window.addEventListener("keydown",(event)=>{
    if(event.key == "Escape") window.electronAPI.goBack();
    if (event.key == "Tab" ||
        event.key == "Super" ||
        event.key == "Alt" ) event.preventDefault();
  });
}

window.setupNavigationBtnHandler = ()=>{
  let moveRightBtns = document.querySelectorAll(".moveMovieElementsToTheRightBtn");
  let moveLeftBtns = document.querySelectorAll(".moveMovieElementsToTheLeftBtn");
  moveRightBtns.forEach(btn => {
    btn.addEventListener("click",()=>{
      let btnDivParent = btn.parentElement;
      let MediaDiv = btnDivParent.querySelector(".div-hidingScrollBar");
      MediaDiv.scrollTo({
        top:0,
        left:MediaDiv.scrollLeft + 600,
        behavior:"smooth"
      });
    });
  });
  moveLeftBtns.forEach(btn => {
    btn.addEventListener("click",()=>{
      let btnDivParent = btn.parentElement;
      let MediaDiv = btnDivParent.querySelector(".div-hidingScrollBar");
      MediaDiv.scrollTo({
        top:0,
        left:MediaDiv.scrollLeft - 600,
        behavior:"smooth"
      });
    });
  });
}

window.DisplayWarningOrErrorForUser = (warningMessage) => {
  let WarningDiv = document.createElement("div");
  let WarningMessage = document.createElement("span");
  let RefreshButton = document.createElement("button");

  WarningDiv.className = "div-WarningMessage";
  WarningMessage.className = "span-WarningMessage";
  RefreshButton.className = "btn-refreshAfterWarningMessage";

  WarningMessage.innerHTML = warningMessage;
  RefreshButton.innerHTML = `
    <svg id="refreshButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M436.7 74.7L448 85.4 448 32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-128 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l47.9 0-7.6-7.2c-.2-.2-.4-.4-.6-.6-75-75-196.5-75-271.5 0s-75 196.5 0 271.5 196.5 75 271.5 0c8.2-8.2 15.5-16.9 21.9-26.1 10.1-14.5 30.1-18 44.6-7.9s18 30.1 7.9 44.6c-8.5 12.2-18.2 23.8-29.1 34.7-100 100-262.1 100-362 0S-25 175 75 75c99.9-99.9 261.7-100 361.7-.3z"/>
    </svg>`

  let leftDiv = document.getElementById("div-middle-left");
  let leftDivWidth = leftDiv? leftDiv.offsetWidth : 0;

  WarningDiv.style.marginRight = `${leftDivWidth}px`;

  RefreshButton.addEventListener("click",()=>{window.location.reload()});

  WarningDiv.appendChild(WarningMessage);
  if(!(window.location.href.includes("searchPage") || window.location.href.includes("libraryPage")))
    WarningDiv.appendChild(RefreshButton);

  return WarningDiv;
}
function goBack(){
  window.electronAPI.goBack();
}

function backToHome(){
  path = "./home/mainPage.html"
  window.electronAPI.navigateTo(path);
}

function openDiscoveryPage(genreId, MediaType){
  let path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}

function OpenLibaryPage(){
  path = "./libraryPage/libraryPage.html"
  window.electronAPI.navigateTo(path);
}

function OpenSettingsPage(){
  path = "./settingsPage/settingsPage.html"
  window.electronAPI.navigateTo(path);
}

function openDetailPage(movieId,mediaType){
  let path = "./movieDetail/movieDetail.html?MovieId="+movieId+"&MediaType="+mediaType;
  window.electronAPI.navigateTo(path);
}

function openSearchPage(){
  let searchKeyword = searchInput.value;
  if(searchKeyword.trim() !=""){
    let path ="./search/searchPage.html?search="+searchKeyword;
    window.electronAPI.navigateTo(path);
  }
}

function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}
