window.addSmoothTransition = function(){
  setTimeout(()=>{
    document.body.style.opacity = "1";
  },81);
}

window.handlingMiddleRightDivResizing = ()=>{
  let rightMiddleDiv = document.getElementById("div-middle-right");
  resizingRightMiddleDiv(rightMiddleDiv);
  window.addEventListener("resize",() => {
    resizingRightMiddleDiv(rightMiddleDiv);
  });
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

function resizingRightMiddleDiv(rightMiddleDiv){
  if(rightMiddleDiv){
    let rightMiddleDivPosition = rightMiddleDiv.getBoundingClientRect().top;
    rightMiddleDiv.style.height = window.innerHeight - rightMiddleDivPosition  ;
  }
}

window.checkIfDivShouldHaveMoveToRightOrLeftButton = (MediaDivs) => {
  MediaDivs.forEach(MediaDiv => {
    if(MediaDiv.scrollWidth === MediaDiv.clientWidth)
       MediaDiv.parentElement.querySelectorAll(".movingArrowButton").forEach(btn => btn.style.display = "none");
    else
      MediaDiv.parentElement.querySelectorAll(".movingArrowButton").forEach(btn => btn.style.display = "flex");
  });
}

function creatingTheBaseOfNewMediaElement(Title, PosterImage, Id, ThisMediaType,imageLoadingAnimation=true){

  let mediaDomElement = document.createElement("div");
  let mediaPosterContainer = document.createElement("div");
  let mediaPosterElement = document.createElement("img");
  let mediaNameElement = document.createElement("div");

  mediaNameElement.innerHTML = `<p>${Title}</p>`;

  if(imageLoadingAnimation)
    loadImageWithAnimation(mediaPosterContainer,mediaPosterElement, PosterImage);
  else
    mediaPosterElement.src = normalizeRootUrl(PosterImage);

  mediaDomElement.classList.add("div-MovieElement");
  mediaDomElement.setAttribute("tabindex",0);
  mediaPosterElement.classList.add("img-MoviePoster");
  mediaPosterContainer.classList.add("img-MoviePosterContainer");
  mediaNameElement.classList.add("parag-MovieTitle");

  mediaDomElement.setAttribute("mediaId",Id);
  mediaDomElement.setAttribute("mediaType",ThisMediaType);

  mediaPosterContainer.appendChild(mediaPosterElement)
  mediaDomElement.appendChild(mediaPosterContainer);
  mediaDomElement.appendChild(mediaNameElement);

  addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,Id,ThisMediaType);

  addFloatingDivToDisplayFullTitle(mediaDomElement);

  return mediaDomElement;
}

function addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType){
  mediaDomElement.addEventListener("click",function() {
    if(mediaType === "person")
      openProfilePage(mediaId);
    else
      openDetailPage(mediaId,mediaType);
  });
}

function insertMediaElements(MediaSearchResults,MediaContainer,MediaType,LibraryInformation){
  if(!MediaSearchResults?.length) throw new Error("No data was Fetched");

  let tempArray = [];
  MediaSearchResults.forEach(obj => {
    let Id = obj?.["id"] ?? "Unknown";
    let Title = obj?.["title"] ?? obj?.["name"] ?? "Unknown";
    let Adult = obj?.["adult"] ?? "Unknown";
    let ThisMediaType = obj?.["media_type"] ?? MediaType;
    let PosterImage;

    if(!tempArray.includes(Title)){
      tempArray.push(Title); 
      
      if(obj?.["poster_path"]) PosterImage = ("https://image.tmdb.org/t/p/w500/"+obj["poster_path"]).replace(/([^:]\/)\/+/g, '$1');
      else if(obj?.["profile_path"])  PosterImage = ("https://image.tmdb.org/t/p/w500/"+obj["profile_path"]).replace(/([^:]\/)\/+/g, '$1');
      else if(ThisMediaType === "person") PosterImage = "../assets/ProfileNotFound.png"
      else PosterImage = "../assets/PosterNotFound.png"

      let mediaDomElement = creatingTheBaseOfNewMediaElement(Title, PosterImage, Id, ThisMediaType);
      let toggleInLibraryBtn = createToggleToLibraryButton(LibraryInformation, Id, ThisMediaType)

      if(ThisMediaType.toLowerCase() !== "person")
        mediaDomElement.appendChild(toggleInLibraryBtn);

      if(!Array.isArray(MediaContainer)){
        const mediaElementsLoaded = Array.from(MediaContainer.querySelectorAll(".div-MovieElement"));
        const mediaElementDoesntExistAlready = !(mediaElementsLoaded.some(element => element.innerHTML === mediaDomElement.innerHTML));
        if(mediaElementDoesntExistAlready)
          MediaContainer.appendChild(mediaDomElement);

      }else{
        if(ThisMediaType.toLowerCase() === "movie") MediaContainer[0].append(mediaDomElement);
        else if(ThisMediaType.toLowerCase() === "tv" || ThisMediaType.toLowerCase() === "anime" ) MediaContainer[1].append(mediaDomElement);
        else if(ThisMediaType.toLowerCase() === "person") MediaContainer[2].append(mediaDomElement);
        else MediaContainer[3].append(mediaDomElement);

      } 
    }
  });
}

function createToggleToLibraryButton(LibraryInformation, Id, ThisMediaType){
  let toggleInLibraryBtn = document.createElement("button"); 

  toggleInLibraryBtn.classList.add("btn-toggle-in-library");

  let mediaIsInLibrary = LibraryInformation.filter(libraryEntryPoint => 
    (libraryEntryPoint.MediaId.toString() === Id.toString()) &&
    (libraryEntryPoint.MediaType.toString() === ThisMediaType.toString())).length;

  if(mediaIsInLibrary) setAddToLibraryButtonToPressed(toggleInLibraryBtn);
  else setAddToLibraryButtonToNormal(toggleInLibraryBtn)

  addToggleToLibButtonEventListener(toggleInLibraryBtn,Id,ThisMediaType);
  return toggleInLibraryBtn;
}

function addToggleToLibButtonEventListener(thistoggleinlibrarybtn,mediaId,mediaType){
  if(thistoggleinlibrarybtn){
    thistoggleinlibrarybtn.addEventListener("click",(event)=>{
      ToggleInLibrary(mediaId.toString(),mediaType,"Watch Later")
      event.stopPropagation();
      event.stopImmediatePropagation();
    });
  }
}

function createMediaElementForLibrary(mediaData, mediaEntryPoint, IsInHomePage=false){
  const ThisMediaType = mediaEntryPoint?.MediaType;
  const ThisSaveType = mediaEntryPoint?.typeOfSave;
  const ThisSaveTime = mediaEntryPoint?.timeOfSave;

  let Id = mediaData?.["id"] ?? "Unknown";
  let Title = mediaData?.["title"] ?? mediaData?.["name"] ?? "Unknown";
  let Adult = mediaData?.["adult"] ?? "Unknown";

  let PosterImage =  
      mediaData?.["poster_path"] 
      ? "https://image.tmdb.org/t/p/w500/"+mediaData["poster_path"] 
      : "../assets/PosterNotFound.png";

  let imageLoadingAnimation = true;
  let movieDomElement = creatingTheBaseOfNewMediaElement(Title, PosterImage, Id, ThisMediaType,imageLoadingAnimation);
  let removeFromLibraryButton = createRemoveFromWatchingLaterButton(Id,ThisMediaType,IsInHomePage)

  movieDomElement.setAttribute("saveType",ThisSaveType);
  movieDomElement.setAttribute("saveTime",ThisSaveTime);

  movieDomElement.appendChild(removeFromLibraryButton);

  if(ThisSaveType.includes("Currently Watching")){
    let continueVideoButton = createContinueWatchingButton(mediaEntryPoint);
    movieDomElement.appendChild(continueVideoButton);
  }

  return movieDomElement;
}

function createContinueWatchingButton(mediaEntryPoint){
  let continueVideoButton = document.createElement("button");
  continueVideoButton.classList.add("continue-video-button");

  fetch('../assets/icons/playVideo.svg')
    .then(response => response.text())
    .then(svgText => {
      continueVideoButton.innerHTML = svgText;
      addContrastForPlayIcon();
    })
  .catch(err=>{
    console.error(err.message);
  });

  continueVideoButton.addEventListener("click",()=>{
    openMediaVideo(
      mediaEntryPoint.TorrentIdentification,
      mediaEntryPoint.MediaId,
      mediaEntryPoint.MediaType,
      mediaEntryPoint.downloadPath,
      mediaEntryPoint.fileName,
      mediaEntryPoint.Magnet,
      mediaEntryPoint.mediaImdbId,
      mediaEntryPoint.bgImagePath,
      {"seasonNumber":mediaEntryPoint.seasonNumber,
      "episodeNumber":mediaEntryPoint.episodeNumber}
    );

    event.preventDefault();
    event.stopPropagation();
  });
  return continueVideoButton;
}

function createRemoveFromWatchingLaterButton(Id,ThisMediaType,IsInHomePage){
  let removeFromLibraryButton = document.createElement("button"); 
  removeFromLibraryButton.innerHTML = xRemoveIcon;
  removeFromLibraryButton.classList.add("btn-remove-from-library");
  addEventListenerToRemoveFromLibraryButton(removeFromLibraryButton,Id,ThisMediaType,IsInHomePage)
  return removeFromLibraryButton;
}

function addEventListenerToRemoveFromLibraryButton(removeFromLibraryButton,Id,ThisMediaType,IsInHomePage = false){
  removeFromLibraryButton.addEventListener("click",(event)=>{
    let numberOfElementsLeftInLibrary = removeMediaFromLibrary(removeFromLibraryButton,Id,ThisMediaType);

    if(!numberOfElementsLeftInLibrary){
      if (!IsInHomePage) {
        addEmptyLibraryWarning(RightmiddleDiv)

      } else {
        let continueWatchingElement = document.getElementById("continue-watching-categorie");
        if(continueWatchingElement)
          continueWatchingElement.style.display = "none";
      }
    }

    event.stopPropagation();
    event.stopImmediatePropagation();
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
   <svg class="toggleButtonIcon" style="margin-left:7px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M64 0C28.7 0 0 28.7 0 64L0 480c0 11.5 6.2 22.2 16.2 27.8s22.3 5.5 32.2-.4L192 421.3 335.5 507.4c9.9 5.9 22.2 6.1 32.2 .4S384 491.5 384 480l0-416c0-35.3-28.7-64-64-64L64 0z"/>
  </svg> `;
  toggleInLibrary.setAttribute("pressed"," ");
}

window.ToggleInLibrary = async (mediaId,mediaType,typeOfSave) => {
  let toggleInLibraryElement = event.target;
  
  if (event !== undefined) {
    event.stopPropagation();
    event.preventDefault();
  }

  if(toggleInLibraryElement.hasAttribute("pressed")){
    setAddToLibraryButtonToNormal(toggleInLibraryElement);
    let MediaLibraryObjectIdentifiers = {
      MediaId:mediaId.toString(),
      MediaType:mediaType
    }
    window.electronAPI.removeMediaFromLibrary(MediaLibraryObjectIdentifiers);

  }else{
    setAddToLibraryButtonToPressed(toggleInLibraryElement);

    let libInfo = await loadLibraryInfo();
    let SearchedMediaElement = libInfo.filter(item => (item.MediaId === mediaId && item.MediaType === mediaType));
    let MediaElementDoesExist = SearchedMediaElement.length > 0;
    let MediaLibraryObject;

    const currentEpochTime = Date.now().toString();

    if(MediaElementDoesExist){
      MediaLibraryObject = SearchedMediaElement[0];
      MediaLibraryObject.typeOfSave.push(typeOfSave);
      MediaLibraryObject.timefSave = currentEpochTime;
    }else{
      MediaLibraryObject = {
        MediaId:mediaId.toString(),
        MediaType:mediaType,
        timeOfSave:currentEpochTime,
        typeOfSave:[typeOfSave],
        episodesWatched:[],
        lastPlaybackPosition:0,
        timeWatched:0
      }
    }

    window.electronAPI.addMediaToLibrary(MediaLibraryObject);
  }

}

function createTorrentElement(torrentBasicInfo, torrentAdvancedInfo) {
  let [Quality, Title, Size, SeedersNumber] = torrentBasicInfo;
  const TorrentElement = document.createElement("div");
  TorrentElement.classList.add("div-TorrentMedia");
  TorrentElement.setAttribute("tabindex", "0");
  TorrentElement.style.marginBottom = "5px";

  const qualityDiv = document.createElement("div");
  qualityDiv.classList.add("div-MediaQuality");

  const qualityP = document.createElement("p");
  qualityP.textContent = Quality;
  qualityDiv.appendChild(qualityP);

  const descriptionDiv = document.createElement("div");
  descriptionDiv.classList.add("div-MediaDescription");

  const titleP = document.createElement("p");
  titleP.textContent = Title;

  const infoDiv = document.createElement("div");
  infoDiv.classList.add("torrent-info-div");

  const storageIcon = document.createElement("div");
  storageIcon.classList.add("div-storageImage");

  const seedIcon = document.createElement("div");
  seedIcon.classList.add("div-seedImage");

  const sizeText = document.createTextNode(` ${Size} \u00A0\u00A0`);
  const seedText = document.createTextNode(` ${SeedersNumber}`);

  infoDiv.appendChild(storageIcon);
  infoDiv.appendChild(sizeText);
  infoDiv.appendChild(seedIcon);
  infoDiv.appendChild(seedText);

  descriptionDiv.appendChild(titleP);
  descriptionDiv.appendChild(infoDiv);

  TorrentElement.appendChild(qualityDiv);
  TorrentElement.appendChild(descriptionDiv);

  addTorrentElementEventListener(TorrentElement,torrentAdvancedInfo);

  return TorrentElement;
}

function addTorrentElementEventListener(TorrentElement, torrentsInfo) {
  let [MediaId, MediaType, fileName, MagnetLink, IMDB_ID,
       backgroundImage, episodeInfo, Size, Quality, Title] = torrentsInfo;

  TorrentElement.addEventListener("click",()=>{
    openMediaVideo(undefined,MediaId,MediaType,undefined,fileName,MagnetLink,IMDB_ID,backgroundImage,episodeInfo);
  });
 
  // right click handeling
  TorrentElement.addEventListener("mousedown",(event)=>{
    if (event.button === 2) {
      let mediaTitle = document.getElementById("h1-MovieTitle").innerText;
      let mediaReleaseYear = document.getElementById("p-movieYearOfRelease").innerText;
      let DownloadTargetInfo = {
        IMDB_ID:IMDB_ID, Title:mediaTitle, Size:Size,
        Quality:Quality, Year:mediaReleaseYear, MagnetLink:MagnetLink,
        fileName:fileName,dirName:Title, MediaId:MediaId, MediaType:MediaType,
        seasonNumber:episodeInfo.seasonNumber,episodeNumber:episodeInfo.episodeNumber
      };
      setupDownloadDivEvents(DownloadTargetInfo);
      handleRightClicksForTorrentElement(DownloadTargetInfo);
    }
  });
}

async function loadLibraryInfo(){
  try{
    const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch((err)=>console.error(err.message));
    if(wholeLibraryInformation == undefined){
      console.log("No matches in the library");
      return [];
    }
    return wholeLibraryInformation;
  }catch(err){
    console.error(err.message);
    return undefined;
  }
}

window.setLeftButtonStyle = (buttonId) => {
  let targetedButton = document.getElementById(buttonId);
  let buttonIcon = targetedButton.querySelector(".icon");
  buttonIcon.style.fill = "rgba(var(--icon-hover-color))";
}

window.setupKeyPressesForInputElement = (searchInput)=>{
  searchInput.addEventListener("keypress",(event)=>{
    if(event.key === "Enter") openSearchPage();
  });
}

let dontGoBack = false;
window.setupKeyPressesHandler = () =>{
  window.addEventListener("keydown",(event)=>{
    if(event.key === "Escape"){
      if(dontGoBack)
        dontGoBack = false;
      else
        window.electronAPI.goBack(document.URL);
    }
    if (event.key === "Tab" ||
        event.metaKey ||
        // event.ctrlKey ||
        event.altKey) event.preventDefault();
  });
}

function handleNavigationButtonsHandler(focusFunction) {

  document.addEventListener("keydown", (event) => {
    const arrowKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
    if(arrowKeys.includes(event.key)) {
      event.preventDefault();

      const focusable = [...document.querySelectorAll("[tabindex='0']")];
      let index = focusable.indexOf(document.activeElement);

      if (index < 0) {
        let currentlyHovered = document.querySelector("[tabindex='0']:hover");
        let hoveredElementIndex = focusable.indexOf(currentlyHovered);
        if(hoveredElementIndex)
          index = hoveredElementIndex;
        else 
          return;
      }
      
      let offset = 0;
      if (event.key === "ArrowRight")  offset = 1;

      if (event.key === "ArrowLeft") offset = -1;

      if (event.key === "ArrowUp")
        offset = -1 * getElementOnTopOffset(index, focusable);
      

      if (event.key === "ArrowDown")
        offset = getElementOnBottomOffset(index, focusable);

      const nextHover = focusable[index + offset];
      if (nextHover) {
        focusFunction(nextHover);
      }

    } else {
      if (event.key === "Enter") {
        document.activeElement.click();
      }
    }
  });
}

function getElementOnTopOffset(currentElementIndex, focusableElements) {
  const currentElement = focusableElements?.[currentElementIndex];
  let topOffset = 1;
  
  if (currentElement) {
    const currentElementXPos = currentElement.getBoundingClientRect().right;
    for(let i = 1 ;; i++) {
      const elementPrevElement = focusableElements?.[currentElementIndex - i];

      if (elementPrevElement) {
        let xPosition = elementPrevElement.getBoundingClientRect().right;

        if (xPosition  !== currentElementXPos) {
          topOffset ++;
          
        } else {
          return topOffset
        }

      } else {
        return currentElementIndex;
      }
    }
  }

  return -1 * topOffset; 
}

function getElementOnBottomOffset(currentElementIndex, focusableElements) {
  const currentElement = focusableElements?.[currentElementIndex];
  let bottomOffset = 1;
  
  if (currentElement) {
    const currentElementXPos = currentElement.getBoundingClientRect().right;
    for(let i = 1 ;; i++) {
      const elementNextElement = focusableElements?.[currentElementIndex + i];

      if (elementNextElement) {
        let xPosition = elementNextElement.getBoundingClientRect().right;

        if (xPosition  !== currentElementXPos) {
          bottomOffset ++;
          
        } else {
          return bottomOffset;
        }

      } else {
        return focusableElements.length-1 - currentElementIndex;
      }
    }
  }
 
  return bottomOffset
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

window.DisplayWarningOrErrorForUser = (warningMessage,addRefreshButton = true) => {
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
  if(addRefreshButton)
    WarningDiv.appendChild(RefreshButton);

  return WarningDiv;
}

window.loadIconsDynamically = ()=>{
  document.addEventListener("DOMContentLoaded", ()=>{
    handleFullScreenIcon();
    handleGoBackIcon();
  });

  fetch('../assets/icons/storage.svg')
    .then(response => response.text())
    .then(svgText => {
      document.querySelectorAll('.div-storageImage').forEach(element=>element.innerHTML = svgText);
    })
    .catch(err=>{
      console.error(err.message);
    });
  fetch('../assets/icons/seeds.svg')
    .then(response => response.text())
    .then(svgText => {
      document.querySelectorAll('.div-seedImage').forEach(element=>element.innerHTML = svgText);
    })
    .catch(err=>{
      console.error(err.message);
    });
}

function goBack(){
  window.electronAPI.goBack(document.URL);
}

function backToHome(){
  return navigate("./home/mainPage.html");
}

function openDiscoveryPage(genreId, MediaType){
  return navigate(`./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`);
}

function OpenLibaryPage(typeOfSave = "All"){
  return navigate(`./libraryPage/libraryPage.html?typeOfSave=${typeOfSave}`);
}

function OpenDownloadPage(){
  return navigate("./downloadPage/downloadPage.html");
}

function OpenSettingsPage(){
  return navigate("./settingsPage/settingsPage.html");
}

function openProfilePage(personId){
  return navigate(`./personDetails/personDetails.html?personId=${personId}`);
}

function openDetailPage(movieId, mediaType){
  return navigate(`./movieDetail/movieDetail.html?MovieId=${movieId}&MediaType=${mediaType}`);
}

function openSearchPage(){
  const searchKeyword = searchInput.value.trim();
  if(!searchKeyword) return;
  return navigate(`./search/searchPage.html?search=${searchKeyword}`);
}

async function navigate(newPath){
  const cachedData = await getCurrentPageCacheData();
  const fromPath = document.URL;
  window.electronAPI.navigateTo(newPath, fromPath, cachedData);
}

function openMediaVideo( TorrentIdentification, MediaId, MediaType, downloadPath, fileName, MagnetLink, IMDB_ID, backgroundImage, episodeInfo){
  const b64MagnetLink = btoa(MagnetLink);
  const episodeNumber = episodeInfo?.episodeNumber;
  const seasonNumber  = episodeInfo?.seasonNumber;

  return navigate(
    `./videoPlayer/videoPlayer.html?` +
    `MagnetLink=${b64MagnetLink}` +
    `&downloadPath=${downloadPath}` +
    `&fileName=${fileName}` +
    `&TorrentIdentification=${TorrentIdentification}` +
    `&MediaId=${MediaId}` +
    `&MediaType=${MediaType}` +
    `&ImdbId=${IMDB_ID}` +
    `&bgPath=${backgroundImage}` +
    `&episodeNumber=${episodeNumber}` +
    `&seasonNumber=${seasonNumber}`
  );
}


// #########################################################################

function getCurrentPageCacheData(){
  let currentPage = document.URL;
  switch(true){

    case (currentPage.includes("discoveryPage")):
      return getDiscoveryPageCacheData();
    
    case (currentPage.includes("libraryPage")):
      return getLibraryPageCacheData();

    case(currentPage.includes("personDetails")):
      return getProfilePageCacheData();

    case (currentPage.includes("movieDetail")):
      return getMovieDetailPageCacheData();

    case (currentPage.includes("searchPage")):
      return getSearchPageCacheData();
    
    case (currentPage.includes("downloadPage")):
      return getDownloadCacheData();

    default:
      return getRightMiddleDivScrollValue();
  }
}

function getRightMiddleDivScrollValue(){
  let RightMiddleDiv = document.getElementById("div-middle-right");
  if(!RightMiddleDiv) return {};
  return {
    "right_middle_div_top_scroll_value":RightMiddleDiv.scrollTop
  };
}

async function getDiscoveryPageCacheData(){
  let mediaSuggestionsContainer = document.getElementById("div-MediaSuggestions");
  let containersData = await getContainersHTML([mediaSuggestionsContainer]);
  let cacheData = {
    page:"discovery",
    "containers_data": containersData,
    "last_loaded_medias_page":numberOfLoadedPages,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

async function getLibraryPageCacheData(){
  let savedMediaContainer = document.getElementById("div-SavedMedia");
  let pageDropDowns = document.querySelectorAll(".select-dropdown");
  let containersData = savedMediaContainer ? await getContainersHTML([savedMediaContainer]) : null;
  let dropDownsData = pageDropDowns ? await getDropDownCacheValue(Array.from(pageDropDowns)) : null;
  let cacheData = {
    page:"library",
    "containers_data": containersData,
    "dropdowns_data":dropDownsData,
    "saved_media_container_html":savedMediaContainer.innerHTML,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

async function getContainersHTML(containersList){
  let containersData = Array.from(containersList).map(container=> ({"id":container.id,"HTMLContent":container.innerHTML}));
  return containersData;
}

async function getDropDownCacheValue(dropDowns){
  let dropDownsData = Array.from(dropDowns).map(dropDown => ({"id":dropDown.id,"cachedValue":getDropdownValue(dropDown)}));
  return dropDownsData;
}

async function getProfilePageCacheData(){
  let mediaSuggestionsContainer = document.getElementById("div-MediaSuggestions");
  let containersData = await getContainersHTML([mediaSuggestionsContainer]);
  let personInformationElement = document.getElementById("div-Person-description");
  let personInformationHTML = personInformationElement ? personInformationElement.innerHTML : null;
  let cacheData = {
    page:"profile",
    "containers_data": containersData,
    "person_information": personInformationHTML,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

function getMovieDetailPageCacheData(){
  return "################################## Movie Detail Page";
}

function getDownloadCacheData(){
  let downloadElementsContainers = document.querySelector(".download-categorie-container");
  return {
    page:"download",
    "download_container_top_scroll_value":downloadElementsContainers.scrollTop
  }
}

function getSearchPageCacheData(){
  return "################################## Search Page";
}

async function loadCachedRightMiddleDivScrollValue(){
  let cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(cachedData){
    console.log("Loading Cached Information");
    let RightmiddleDivScrollTopValue = cachedData.right_middle_div_top_scroll_value;
    let RightmiddleDiv = document.getElementById("div-middle-right");
    RightmiddleDiv.scrollTop = RightmiddleDivScrollTopValue;
  }
}

// #########################################################################

function normalizeRootUrl(input) {
  try{
    const url = new URL(input);
    url.pathname = url.pathname.replace(/\/+/g, "/");

    if (url.pathname === "") {
      url.pathname = "/";
    }

    return url.href;
  }catch{
    return input;
  }
}

function removeAllArgsFromPath(path) {
  const url = new URL(path, "http://localhost");
  return url.pathname;
}

async function fullscreenClicked(){
  let isFullScreen = await window.electronAPI.toggleFullscreen();
  let fullscreenImageElement = document.getElementById("img-fullscreen");
  if(isFullScreen  == undefined) return;
  fullscreenImageElement.src = isFullScreen ? "../assets/icons/unfullscreen.png" : "../assets/icons/fullscreen.png";
}

window.displayMessage = (messageContent="hello")=>{
  let messageDiv = document.getElementById("messageDiv");
  messageDiv.style.right = 20;
  messageDiv.style.transition = "opacity 100ms";
  messageDiv.style.opacity = 1;

  messageDiv.querySelector("p").innerHTML = messageContent;
  setTimeout(()=>{
    messageDiv.style.transition = "opacity 1000ms";
    messageDiv.style.opacity = 0;
  },2000);
  
  setTimeout(()=>{
    messageDiv.style.right = "-120%";
  },2500);
}

window.MOST_POPULAR_LANGUAGES = [
  "English", "Spanish",
  "Arabic", "Chinese (Simplified)",
  "Chinese (Traditional)", "Hindi",
  "Portuguese (BR)", "Portuguese",
  "French", "German",
  "Japanese", "Korean",
  "Italian"
]

window.fetchMediaDataFromLibrary = (apiKey,wholeLibraryInformation,SavedMedia,RightmiddleDiv,IsInHomePage=false)=>{
  const promises = wholeLibraryInformation.map(mediaEntryPoint =>{
    let MediaId = mediaEntryPoint.MediaId;
    let MediaType = mediaEntryPoint.MediaType;
    let searchQuery = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;

    return fetch(searchQuery)
      .then(res=>res.json())
      .then(data => {
        if(data.status_code === 7) throw new Error("We’re having trouble loading data</br>Please make sure your Authentication Key is valide!");
        SavedMedia.appendChild(createMediaElementForLibrary(data,mediaEntryPoint,IsInHomePage));
        checkIfDivShouldHaveMoveToRightOrLeftButton([SavedMedia]);
      })
      .catch(err=>{
        err.message = (err.message === "Failed to fetch") ? "We’re having trouble loading data</br>Please Check your connection and refresh!":err.message;
        setTimeout(()=>{
          RightmiddleDiv.innerHTML ="";
          let WarningElement = DisplayWarningOrErrorForUser(err.message);
          WarningElement.style.paddingBottom = "1000px;";
          RightmiddleDiv.appendChild(WarningElement);
          RightmiddleDiv.style.opacity = 1;
        },800);
      });
  });

  return Promise.all(promises);
}

function addContrastForPlayIcon(){
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue('--icon-hover-color').trim();
  const [r,g,b] = value.split(",").slice(0,3).map(Number);
  const luminance = 0.2126*r + 0.7152*g + 0.0722*b;
  const fillColor = luminance > 180 ? "#ffffff" : "rgba(10,10,10,1)";
  const bgColor = luminance < 180 ? "#ffffff" : "rgba(10,10,10,1)";
  document.querySelectorAll(".continue-video-icon").forEach(item => {item.style.fill = fillColor});
  document.querySelectorAll(".continue-video-button").forEach(item=> {item.style.backgroundColor = bgColor});
}


function removeMediaFromLibrary(removeFromLibraryButton,mediaId,mediaType){
  let MediaLibraryObject = {
    MediaId:mediaId.toString(),
    MediaType:mediaType
  }

  let MediaElementsContainer = removeFromLibraryButton.parentElement;
  let SaveDiv = MediaElementsContainer.parentElement;
  MediaElementsContainer.style.opacity = 0;
  MediaElementsContainer.remove();

  let numberOfElementsLeftInLibrary = SaveDiv ? SaveDiv.querySelectorAll(".div-MovieElement").length : 0;

  window.electronAPI.removeMediaFromLibrary(MediaLibraryObject);
  return numberOfElementsLeftInLibrary;
}

function addEmptyLibraryWarning(warningContainer){
  let existingWarning = warningContainer.querySelector(".div-WarningMessage");
  if(!existingWarning){
    let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty",false);
    warningContainer.appendChild(WarningElement);
  }else{
    existingWarning.style.display = "flex";
  }
}

function hideEmptyLibraryWarning(warningContainer){
  let WarningElement = warningContainer.querySelector(".div-WarningMessage");
  if(WarningElement){
    WarningElement.style.display = "none";
  }
}

window.videoIcon = `
  <svg class="videoIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
    <path d="M96 64c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L96 64zM464 336l73.5 58.8c4.2 3.4 9.4 5.2 14.8 5.2 13.1 0 23.7-10.6 23.7-23.7l0-240.6c0-13.1-10.6-23.7-23.7-23.7-5.4 0-10.6 1.8-14.8 5.2L464 176 464 336z"/>
  </svg>
`;

window.xRemoveIcon = `            
  <svg class="closeButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" preserveAspectRatio="none">
    <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/>
  </svg>`;

window.playIcon = `
  <svg class="playIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z"/>
  </svg>
`;

window.pauseIcon = `
  <svg class="pauseIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
    <path d="M48 32C21.5 32 0 53.5 0 80L0 432c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48L48 32zm224 0c-26.5 0-48 21.5-48 48l0 352c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48l-64 0z"/>
  </svg>
`;

window.closedTrashIcon = `
  <svg class="trashIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path class="trash-lid" d="M136.7 5.9C141.1-7.2 153.3-16 167.1-16l113.9 0c13.8 0 26 8.8 30.4 21.9L320 32 416 32c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 8.7-26.1z"/>

    <path d="M32 144l384 0 0 304c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-304zm88 64c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24z"/>
  </svg>
`;

window.twoBarsIcon = `
  <svg class="twoBarsIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M32 288c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 288zm0-128c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 160z"/>
  </svg>
`;

window.threeBarsIcon = `
  <svg class="threeBarsIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/>
  </svg>
`;

window.addFloatingDivToDisplayFullTitle = (MediaElement)=>{
  const paragraph = MediaElement?.querySelector('p');

  if (paragraph) {
    const floatingDiv = document.createElement('div');
    floatingDiv.className = 'floating-tooltip';
    floatingDiv.textContent = paragraph.textContent;
    floatingDiv.className = "floatingDiv";
    document.body.appendChild(floatingDiv);

    let displayFloatingDiv = true;

    paragraph.addEventListener('mouseenter', (e) => {
      displayFloatingDiv=true;
      const isOverflowing = paragraph.scrollWidth > paragraph.clientWidth || paragraph.scrollHeight > paragraph.clientHeight;
      setTimeout(()=>{
        if(displayFloatingDiv){
          floatingDiv.style.opacity = '1';
        }
      },500);
    });

    paragraph.addEventListener('mousemove', (e) => {
      const rect = paragraph.getBoundingClientRect();
      const tooltipRect = floatingDiv.getBoundingClientRect();

      floatingDiv.style.left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX + 'px';
      floatingDiv.style.top = rect.top + tooltipRect.height - 8 + window.scrollY + 'px';
    });

    paragraph.addEventListener('mouseleave', () => {
      displayFloatingDiv = false;
      floatingDiv.style.opacity = '0';
    });
  }
}


async function getPosterPath(imdbId, apiKey) {
  const response = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&external_source=imdb_id`);
  const jsonResponse = await response.json();
  const poster =
    jsonResponse.movie_results[0]?.poster_path ||
    jsonResponse.tv_results[0]?.poster_path ||
    jsonResponse.tv_episode_results[0]?.still_path ||
    null;

  return poster ?? null;
}

function loadImageWithAnimation(imageContainer, imageElement, imagePath, alternativeImage = "../assets/PosterNotFound.png") {
  return new Promise((resolve) => {
    if (!imagePath) {
      imageElement.src = alternativeImage;
      resolve(false);
      return;
    }
    
    imageElement.style.display = 'none';
    imageElement.style.transition = 'opacity 0.3s ease';
    imageContainer.classList.add("flashing-Div");
    
    const img = new Image();
    img.onload = () => {
      imageElement.src = normalizeRootUrl(imagePath);
      imageElement.style.display = 'block';
      imageElement.style.opacity = '0';
      imageElement.style.opacity = '1';

      imageContainer.classList.remove("flashing-Div");
      resolve(true);
    };
    img.onerror = () => {
      imageElement.src = alternativeImage;
      imageElement.style.display = 'block';
      imageElement.style.opacity = '1';
      imageContainer.classList.remove("flashing-Div");
      resolve(false);
    };
    img.src = imagePath;
  });
}

window.handleFullScreenIcon = ()=>{
  let FullScreenIcon = "../assets/icons/fullscreen.png";
  let UnFullScreenIcon = "../assets/icons/unfullscreen.png";

  let fullscreenButton = document.getElementById("img-fullscreen");
  if (!window.screenTop && !window.screenY) 
    fullscreenButton?.setAttribute("src",UnFullScreenIcon);
  else
    fullscreenButton?.setAttribute("src",FullScreenIcon);
  
}
async function handleGoBackIcon(){
  let goBackButton = document.querySelector("#btn-goBack");
  let goBackIcon = goBackButton.querySelector("svg");
  let canGoBack = await window.electronAPI.canGoBack();
  if(canGoBack){
    goBackIcon.style.opacity = "1";
    goBackButton.style.cursor = "cursor";
  }else{
    goBackIcon.style.opacity = "0.1";
    goBackButton.style.cursor = "auto";
    goBackButton.style.backgroundColor = "transparent";
    goBackButton.addEventListener("mouseenter",()=>{goBackButton.style.backgroundColor = "transparent"});
  }
}

function putTextIntoDiv(Div,textContent){
  let textDiv = document.createElement("div");
  let text = document.createElement("span");

  textDiv.id = "div-text";
  text.id = "span-text";
  text.innerText = textContent;

  textDiv.append(text); 
  Div.append(textDiv);
}

async function loadingAllSubs(id,episodeNumber,seasonNumber){
  try{
    let url;
    if (episodeNumber && seasonNumber) {
      url = `https://sub.wyzie.ru/search?id=${id}&season=${episodeNumber}&episode=${seasonNumber}`;
    } else {
      url = `https://sub.wyzie.ru/search?id=${id}`;
    }
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    return data;

  }catch(err){
    console.error(err);
    return [];
  }
}

function manageDropDowns() {
  const customSelects = document.querySelectorAll('.custom-select');
  
  customSelects.forEach(select => {
    const trigger = select.querySelector('.select-trigger');
    const dropdown = select.querySelector('.select-dropdown');
    const options = select.querySelectorAll('.select-option');
    
    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);
    
    newTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = select.classList.contains('is-open');
      
      customSelects.forEach(s => s.classList.remove('is-open'));
      
      if (!isOpen) {
        select.classList.add('is-open');
        newTrigger.setAttribute('aria-expanded', 'true');
      }
    });
    
    options.forEach(option => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('value');
        const text = option.textContent;
        
        newTrigger.textContent = text;
        
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        dropdown.setAttribute('data-value', value);
        
        select.classList.remove('is-open');
        newTrigger.setAttribute('aria-expanded', 'false');
        
        const changeEvent = new CustomEvent('dropdownChange', { detail: { value, text } });
        dropdown.dispatchEvent(changeEvent);
      });
    });
    
    newTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        newTrigger.click();
      }
    });
  });
  
  document.addEventListener('click', () => {
    customSelects.forEach(select => {
      select.classList.remove('is-open');
      const trigger = select.querySelector('.select-trigger');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });
}

function syncDropdownWidths() {
  const customSelects = document.querySelectorAll('.custom-select');
  customSelects.forEach(select => {
    const trigger = select.querySelector('.select-trigger');
    const dropdown = select.querySelector('.select-dropdown');
    
    // Temporarily show dropdown to measure it
    dropdown.style.display = 'block';
    dropdown.style.opacity = '0';
    dropdown.style.pointerEvents = 'none';

    // Get the dropdown width
    const dropdownWidth = dropdown.offsetWidth;

    // Set trigger width to match
    trigger.style.width = dropdownWidth + 'px';
    
    // Hide dropdown again
    dropdown.style.display = '';
    dropdown.style.opacity = '';
    dropdown.style.pointerEvents = '';
  });
}

function setDropdownValue(dropdown, value) {
  const option = dropdown.querySelector(`.select-option[value="${value}"]`);
  if (option) {
    const customSelect = dropdown.closest('.custom-select');
    const trigger = customSelect.querySelector('.select-trigger');
    trigger.textContent = option.textContent;
    dropdown.setAttribute('data-value', value);
    dropdown.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
  }
}

function getDropdownValue(dropdown) {
  return dropdown.getAttribute('data-value') || dropdown.querySelector('.select-option').getAttribute('value');
}

function dropDownInit(){
  manageDropDowns();
  setTimeout(syncDropdownWidths, 100);
}

function base64Id(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


function createMediaDownloadElement(mediaLibEntryPoint, formatedDownloadInfo) {
  const { downloadStatus, displayTitle, progress, totalSize, currentSize } = formatedDownloadInfo;

  let MediaDownloadElement = document.createElement("div");

  const leftDiv = document.createElement("div");
  leftDiv.className = "left-div";

  const posterDiv = document.createElement("div");
  posterDiv.className = "poster-div";

  const posterImg = document.createElement("img");
  posterImg.className = "poster-img";

  posterDiv.appendChild(posterImg);
  posterDiv.addEventListener("click", () => {
    openDetailPage(mediaLibEntryPoint?.MediaId, mediaLibEntryPoint?.MediaType);
  });

  const rightDiv = document.createElement("div");
  rightDiv.className = "download-movie-right-div";

  const middleDiv = document.createElement("div");
  middleDiv.className = "download-movie-middle-div";

  const titleP = document.createElement("p");
  titleP.className = "movie-title-p";
  titleP.textContent = displayTitle;

  const progressDiv = document.createElement("div");
  progressDiv.className = "progress-div";

  const progressBarDiv = document.createElement("div");
  progressBarDiv.className = "progress-bar-div";

  const insideDiv = document.createElement("div");
  insideDiv.className = "inside";
  insideDiv.style.width = `${isNaN(progress) ? 0 : progress}%`;

  progressBarDiv.appendChild(insideDiv);
  progressDiv.appendChild(progressBarDiv);

  const percentageP = document.createElement("p");
  percentageP.className = "percentage";
  percentageP.textContent = isNaN(progress) ? "0%" : progress + "%";

  progressDiv.appendChild(percentageP);

  const sizeDiv = document.createElement("div");
  sizeDiv.className = "movie-size-div";

  const downloadedSizeP = document.createElement("p");
  downloadedSizeP.className = "downloaded-size";
  downloadedSizeP.textContent = isNaN(currentSize) ? "---" : currentSize + " GB";

  const totalSizeP = document.createElement("p");
  totalSizeP.className = "total-size";
  totalSizeP.textContent = isNaN(totalSize) ? "---" : totalSize + " GB";

  sizeDiv.appendChild(downloadedSizeP);
  sizeDiv.appendChild(totalSizeP);

  const buttonsDiv = document.createElement("div");
  buttonsDiv.className = "download-buttons-div";

  const togglePauseBtn = document.createElement("button");
  togglePauseBtn.className = "toggle-pause-button";
  togglePauseBtn.innerHTML =
    downloadStatus === "Downloading" || downloadStatus === "Loading"
      ? pauseIcon
      : playIcon;

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "cancel-button";
  cancelBtn.innerHTML = xRemoveIcon;

  const speedP = document.createElement("p");
  speedP.className = "download-speed-p";

  leftDiv.appendChild(posterDiv);

  buttonsDiv.appendChild(togglePauseBtn);
  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(speedP);

  middleDiv.appendChild(titleP);
  middleDiv.appendChild(progressDiv);
  middleDiv.appendChild(sizeDiv);
  middleDiv.appendChild(buttonsDiv);

  MediaDownloadElement.appendChild(leftDiv);
  MediaDownloadElement.appendChild(middleDiv);
  MediaDownloadElement.appendChild(rightDiv);

  return MediaDownloadElement;
}

async function loadCachedRightDivScrollValue(cachedData){
  let RightmiddleDiv = document.getElementById("div-middle-right");
  let RightmiddleDivScrollTopValue = cachedData?.right_middle_div_top_scroll_value;
  if(RightmiddleDivScrollTopValue)
    RightmiddleDiv.scrollTop = RightmiddleDivScrollTopValue;
}

const welcomeMessages = [
  "Enjoy the Show",
  "Settle In and Enjoy",
  "Happy Watching",
  "Lights, Camera, Action!",
  "Let's Watch Something Great",
  "The Show Begins",
  "Welcome to Your Theater",
  "Sit Back and Relax",
  "Let's Make It a Movie Night",
  "Grab Your Popcorn",

  // cinema reference 
  "You mustn't be afraid to dream a little bigger, darling.",
  "Do you want to take a leap of faith?",
  "There's no place like home",
  "May the Force be with you",
  "Are you watching closely?"
];

