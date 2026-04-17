// ################################### CONSTANTS & STATIC DATA ###################################

const MOST_POPULAR_LANGUAGES = [
  "English", "Spanish",
  "Arabic", "Chinese (Simplified)",
  "Chinese (Traditional)", "Hindi",
  "Portuguese (BR)", "Portuguese",
  "French", "German",
  "Japanese", "Korean",
  "Italian"
];

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


// ################################### SVG ICONS ###################################

const videoIcon = `
  <svg class="videoIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
    <path d="M96 64c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l256 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L96 64zM464 336l73.5 58.8c4.2 3.4 9.4 5.2 14.8 5.2 13.1 0 23.7-10.6 23.7-23.7l0-240.6c0-13.1-10.6-23.7-23.7-23.7-5.4 0-10.6 1.8-14.8 5.2L464 176 464 336z"/>
  </svg>
`;

const xRemoveIcon = `            
  <svg class="closeButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" preserveAspectRatio="none">
    <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/>
  </svg>`;

const playIcon = `
  <svg class="playIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z"/>
  </svg>
`;

const pauseIcon = `
  <svg class="pauseIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
    <path d="M48 32C21.5 32 0 53.5 0 80L0 432c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48L48 32zm224 0c-26.5 0-48 21.5-48 48l0 352c0 26.5 21.5 48 48 48l64 0c26.5 0 48-21.5 48-48l0-352c0-26.5-21.5-48-48-48l-64 0z"/>
  </svg>
`;

const closedTrashIcon = `
  <svg class="trashIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path class="trash-lid" d="M136.7 5.9C141.1-7.2 153.3-16 167.1-16l113.9 0c13.8 0 26 8.8 30.4 21.9L320 32 416 32c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 8.7-26.1z"/>

    <path d="M32 144l384 0 0 304c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-304zm88 64c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24l0 192c0 13.3 10.7 24 24 24s24-10.7 24-24l0-192c0-13.3-10.7-24-24-24z"/>
  </svg>
`;

const reloadIcon = `
    <svg id="refreshButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M436.7 74.7L448 85.4 448 32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-128 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l47.9 0-7.6-7.2c-.2-.2-.4-.4-.6-.6-75-75-196.5-75-271.5 0s-75 196.5 0 271.5 196.5 75 271.5 0c8.2-8.2 15.5-16.9 21.9-26.1 10.1-14.5 30.1-18 44.6-7.9s18 30.1 7.9 44.6c-8.5 12.2-18.2 23.8-29.1 34.7-100 100-262.1 100-362 0S-25 175 75 75c99.9-99.9 261.7-100 361.7-.3z"/>
    </svg>`;

const twoBarsIcon = `
  <svg class="twoBarsIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M32 288c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 288zm0-128c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 160z"/>
  </svg>
`;

const threeBarsIcon = `
  <svg class="threeBarsIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/>
  </svg>
`;

const menuThreePoints = `
  <svg class="menuThreePoints" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
    <path d="M96 320C96 289.1 121.1 264 152 264C182.9 264 208 289.1 208 320C208 350.9 182.9 376 152 376C121.1 376 96 350.9 96 320zM264 320C264 289.1 289.1 264 320 264C350.9 264 376 289.1 376 320C376 350.9 350.9 376 320 376C289.1 376 264 350.9 264 320zM488 264C518.9 264 544 289.1 544 320C544 350.9 518.9 376 488 376C457.1 376 432 350.9 432 320C432 289.1 457.1 264 488 264z"/>
  </svg>
`;

const saveToLib = `
  <svg class="toggleButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
    <path d="M0 64C0 28.7 28.7 0 64 0L320 0c35.3 0 64 28.7 64 64l0 417.1c0 25.6-28.5 40.8-49.8 26.6L192 412.8 49.8 507.7C28.5 521.9 0 506.6 0 481.1L0 64zM64 48c-8.8 0-16 7.2-16 16l0 387.2 117.4-78.2c16.1-10.7 37.1-10.7 53.2 0L336 451.2 336 64c0-8.8-7.2-16-16-16L64 48z"/>
  </svg>
`;

const savedToLib = `
  <svg class="toggleButtonIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
    <path d="M64 0C28.7 0 0 28.7 0 64L0 480c0 11.5 6.2 22.2 16.2 27.8s22.3 5.5 32.2-.4L192 421.3 335.5 507.4c9.9 5.9 22.2 6.1 32.2 .4S384 491.5 384 480l0-416c0-35.3-28.7-64-64-64L64 0z"/>
  </svg>
`;

const checkIcon = `
  <svg class="checkIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z"/>
  </svg>
`;

const editIcon = `
  <svg class="editIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L368 46.1 465.9 144 490.3 119.6c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L432 177.9 334.1 80 172.4 241.7zM96 64C43 64 0 107 0 160L0 416c0 53 43 96 96 96l256 0c53 0 96-43 96-96l0-96c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7-14.3 32-32 32L96 448c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L96 64z"/>
  </svg>
`;

const upArrowIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-icon lucide-arrow-up"><path d="m5 12 7-7 7 7"/>
    <path d="M12 19V5"/>
  </svg>
`;

const downArrowIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-icon lucide-arrow-down">
    <path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>
  </svg>
`;

// ################################### NAVIGATION ###################################

function goBack(){
  window.electronAPI.goBack(document.URL);
}

function backToHome(){
  return navigate("../pages/homePage/homePage.html");
}

function openDiscoveryPage(genreId = "All", MediaType = "All" , SortBase = "Default"){
  return navigate(`../pages/discoveryPage/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}&SortBase=${SortBase}`);
}

function OpenLibaryPage(typeOfSave = "All"){
  return navigate(`../pages/libraryPage/libraryPage.html?typeOfSave=${typeOfSave}`);
}

function OpenDownloadPage(){
  return navigate("../pages/downloadPage/downloadPage.html");
}

function OpenSettingsPage(){
  return navigate("../pages/settingsPage/settingsPage.html");
}

function openProfilePage(personId){
  return navigate(`../pages/profilePage/profilePage.html?personId=${personId}`);
}

function openDetailPage(movieId, mediaType){
  return navigate(`../pages/mediaDetailPage/mediaDetailPage.html?MovieId=${movieId}&MediaType=${mediaType}`);
}

function openSearchPage(){
  const searchKeyword = searchInput.value.trim();
  if(!searchKeyword) return;
  return navigate(`../pages/searchPage/searchPage.html?search=${searchKeyword}`);
}

async function navigate(newPath){
  const cachedData = await getCurrentPageCacheData();
  const fromPath = document.URL;
  window.electronAPI.navigateTo(newPath, fromPath, cachedData);
}

function openMediaVideo(
  TorrentIdentification,
  MediaId,
  MediaType,
  downloadPath,
  fileName,
  MagnetLink,
  ImdbId,
  bgPath,
  episodeInfo,
  playerType
) {
  const {episodeNumber, seasonNumber} = episodeInfo ?? {};

  const params = new URLSearchParams({
    MagnetLink: btoa(MagnetLink), downloadPath,
    fileName, TorrentIdentification,
    MediaId, MediaType,
    ImdbId, bgPath,
    episodeNumber, seasonNumber,
    playerType
  });

  return navigate(`../pages/playerPage/playerPage.html?${params}`);
}


// ################################### PAGE CACHING ###################################

function getCurrentPageCacheData(){
  const currentPage = document.URL;
  switch(true){

    case (currentPage.includes("discoveryPage")):
      return getDiscoveryPageCacheData();
    
    case (currentPage.includes("libraryPage")):
      return getLibraryPageCacheData();

    case(currentPage.includes("profilePage")):
      return getProfilePageCacheData();

    case (currentPage.includes("mediaDetailPage")):
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
  const RightMiddleDiv = document.getElementById("div-middle-right");
  if(!RightMiddleDiv) return {};
  return {
    "right_middle_div_top_scroll_value":RightMiddleDiv.scrollTop
  };
}

async function getDiscoveryPageCacheData(){
  const mediaSuggestionsContainer = document.getElementById("div-MediaSuggestions");
  const containersData = await getContainersHTML([mediaSuggestionsContainer]);
  const cacheData = {
    page:"discovery",
    "containers_data": containersData,
    "last_loaded_medias_page":numberOfLoadedPages,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

async function getLibraryPageCacheData(){
  const savedMediaContainer = document.getElementById("div-SavedMedia");
  const pageDropDowns = document.querySelectorAll(".select-dropdown");
  const containersData = savedMediaContainer ? await getContainersHTML([savedMediaContainer]) : null;
  const dropDownsData = pageDropDowns ? await getDropDownCacheValue(Array.from(pageDropDowns)) : null;
  const cacheData = {
    page:"library",
    "containers_data": containersData,
    "dropdowns_data":dropDownsData,
    "saved_media_container_html":savedMediaContainer.innerHTML,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

async function getContainersHTML(containersList){
  const containersData = Array.from(containersList)
    .map(container=> 
      ({"id":container.id,"HTMLContent":container.innerHTML})
    );
  return containersData;
}

async function getDropDownCacheValue(dropDowns){
  const dropDownsData = Array.from(dropDowns)
    .map(dropDown => 
      ({"id":dropDown.id,"cachedValue":getDropdownValue(dropDown)})
    );
  return dropDownsData;
}

async function getProfilePageCacheData(){
  const mediaSuggestionsContainer = document.getElementById("div-MediaSuggestions");
  const containersData = await getContainersHTML([mediaSuggestionsContainer]);
  const personInformationElement = document.getElementById("div-Person-description");
  const personInformationHTML = personInformationElement ? personInformationElement.innerHTML : null;
  const cacheData = {
    page:"profile",
    "containers_data": containersData,
    "person_information": personInformationHTML,
    ...getRightMiddleDivScrollValue(),
  };

  return cacheData;
}

function getMovieDetailPageCacheData(){
  return "##################### Coming Soon #####################";
}

function getDownloadCacheData(){
  const downloadElementsContainers = document.querySelector(".download-categorie-container");
  return {
    page:"download",
    "download_container_top_scroll_value":downloadElementsContainers.scrollTop
  };
}

function getSearchPageCacheData(){
  return "##################### Coming Soon #####################";
}

async function loadCachedRightMiddleDivScrollValue(){
  const cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(cachedData){
    console.log("Loading Cached Information");
    const RightmiddleDivScrollTopValue = cachedData.right_middle_div_top_scroll_value;
    const RightmiddleDiv = document.getElementById("div-middle-right");
    RightmiddleDiv.scrollTop = RightmiddleDivScrollTopValue;
  }
}

async function loadCachedRightDivScrollValue(cachedData){
  const RightmiddleDiv = document.getElementById("div-middle-right");
  const RightmiddleDivScrollTopValue = cachedData?.right_middle_div_top_scroll_value;
  if(RightmiddleDivScrollTopValue)
    RightmiddleDiv.scrollTop = RightmiddleDivScrollTopValue;
}

async function loadCachedDropDownValue(cachedData) {
  for(const {id, cachedValue}  of cachedData?.dropdowns_data ?? []) {
    if(!id) continue;
    const dropDownDomElement = document.getElementById(id);
    if(dropDownDomElement && cachedValue) {
      setDropdownValue(dropDownDomElement,cachedValue);
    }
  }
}

// ################################### LAYOUT & RESIZE ###################################

function addSmoothTransition() {
  setTimeout(()=>{
    document.body.style.opacity = "1";
  },81);
}

function handlingMiddleRightDivResizing() {
  const rightMiddleDiv = document.getElementById("div-middle-right");
  resizingRightMiddleDiv(rightMiddleDiv);
  window.addEventListener("resize",() => {
    resizingRightMiddleDiv(rightMiddleDiv);
  });
}

function resizingRightMiddleDiv(rightMiddleDiv){
  if(rightMiddleDiv){
    const rightMiddleDivPosition = rightMiddleDiv.getBoundingClientRect().top;
    rightMiddleDiv.style.height = window.innerHeight - rightMiddleDivPosition  ;
  }
}

function resizeMoviesPostersContainers(divsToResize) {
  CalculateMoviePostersContainer(divsToResize);
  checkIfDivShouldHaveMoveToRightOrLeftButton(divsToResize);
  window.addEventListener("resize",() => {
    CalculateMoviePostersContainer(divsToResize);
    checkIfDivShouldHaveMoveToRightOrLeftButton(divsToResize);
  });
};

function CalculateMoviePostersContainer(divsToResize){
  const middleLeftBarWidth = document.getElementById("div-middle-left").offsetWidth;
  const marginValue = 40;
  const newMoviesPostersContainerWidth = window.innerWidth - middleLeftBarWidth-marginValue;
  divsToResize.forEach(div => {
    div.style = `max-width:${newMoviesPostersContainerWidth}`;
  });
}

function checkIfDivShouldHaveMoveToRightOrLeftButton(MediaDivs) {
  MediaDivs.forEach(MediaDiv => {
    if(MediaDiv.scrollWidth === MediaDiv.clientWidth)
       MediaDiv.parentElement.querySelectorAll(".movingArrowButton").forEach(btn => btn.style.display = "none");
    else
      MediaDiv.parentElement.querySelectorAll(".movingArrowButton").forEach(btn => btn.style.display = "flex");
  });
}


// ################################### KEYBOARD & INPUT HANDLING ###################################

let dontGoBack = false;
function setupKeyPressesHandler() {
  window.addEventListener("keydown",(event)=>{
    if (event.key === "Escape") {
      if(dontGoBack) {
        dontGoBack = false;
      } else {
        window.electronAPI.goBack(document.URL);
      }
    
    } else if (event.key === "Tab" || event.metaKey || event.altKey) {// event.ctrlKey
      event.preventDefault();

    } else if (event.key === "/") {
      const searchInput = document.getElementById("input-searchForMovie");
      if (searchInput) {
        searchInput.focus();
        event.preventDefault();
      }
    }
  });
}

function setupKeyPressesForInputElement(searchInput) {
  searchInput.addEventListener("keypress",(event)=>{
    if(event.key === "Enter") openSearchPage();
  });
}

function handleNavigationButtonsHandler(focusFunction) {

  document.addEventListener("keydown", (event) => {
    const tag = event.target;
    if (tag.tagName === "INPUT" || tag.tagName === "TEXTAREA" || tag.isContentEditable)  
      return;

    const arrowKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
    if(arrowKeys.includes(event.key)) {
      event.preventDefault();

      const focusable = [...document.querySelectorAll("[tabindex='0']")];
      let index = focusable.indexOf(document.activeElement);

      if (index < 0) {
        const currentlyHovered = document.querySelector("[tabindex='0']:hover");
        const hoveredElementIndex = focusable.indexOf(currentlyHovered);
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
        const xPosition = elementPrevElement.getBoundingClientRect().right;

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
 
  return bottomOffset;
}

function setupNavigationBtnHandler() {
  const moveRightBtns = document.querySelectorAll(".moveMovieElementsToTheRightBtn");
  const moveLeftBtns = document.querySelectorAll(".moveMovieElementsToTheLeftBtn");
  moveRightBtns.forEach(btn => {
    btn.addEventListener("click",()=>{
      const btnDivParent = btn.parentElement;
      const MediaDiv = btnDivParent.querySelector(".div-hidingScrollBar");
      MediaDiv.scrollTo({
        top:0,
        left:MediaDiv.scrollLeft + 600,
        behavior:"smooth"
      });
    });
  });
  moveLeftBtns.forEach(btn => {
    btn.addEventListener("click",()=>{
      const btnDivParent = btn.parentElement;
      const MediaDiv = btnDivParent.querySelector(".div-hidingScrollBar");
      MediaDiv.scrollTo({
        top:0,
        left:MediaDiv.scrollLeft - 600,
        behavior:"smooth"
      });
    });
  });
}


// ################################### MEDIA ELEMENT CREATION ###################################

function creatingTheBaseOfNewMediaElement(Title, PosterImage, Id, ThisMediaType,imageLoadingAnimation=true){
  const mediaDomElement = document.createElement("div");
  const mediaPosterContainer = document.createElement("div");
  const mediaPosterElement = document.createElement("img");
  const mediaNameElement = document.createElement("div");

  mediaNameElement.innerHTML = `<p>${Title}</p>`;

  PosterImage = normalizeRootUrl(PosterImage);
  if(imageLoadingAnimation)
    loadImageWithAnimation(mediaPosterContainer,mediaPosterElement, PosterImage);
  else
    mediaPosterElement.src = PosterImage;

  mediaDomElement.classList.add("div-MovieElement");
  mediaDomElement.setAttribute("tabindex",0);
  mediaPosterElement.classList.add("img-MoviePoster");
  mediaPosterContainer.classList.add("img-MoviePosterContainer");
  mediaNameElement.classList.add("parag-MovieTitle");

  mediaDomElement.setAttribute("mediaId",Id);
  mediaDomElement.setAttribute("mediaType",ThisMediaType);
  mediaDomElement.setAttribute("posterUrl",PosterImage);

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

  const tempArray = [];
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
      else if(ThisMediaType === "person") PosterImage = "../../../assets/ProfileNotFound.svg"
      else PosterImage = "../../../assets/PosterNotFound.svg"

      const mediaDomElement = creatingTheBaseOfNewMediaElement(Title, PosterImage, Id, ThisMediaType);
      const toggleInLibraryBtn = createToggleToLibraryButton(LibraryInformation, Id, ThisMediaType,Title,PosterImage)

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

async function createMediaElementForLibrary(mediaEntryPoint, apiKey, IsInHomePage=false){
  const ThisMediaId = mediaEntryPoint?.MediaId;
  const ThisMediaType = mediaEntryPoint?.MediaType;
  const ThisSaveType = mediaEntryPoint?.typeOfSave;
  const ThisSaveTime = mediaEntryPoint?.timeOfSave;
  let ThisMediaTitle = mediaEntryPoint?.Title;
  let PosterImage = mediaEntryPoint?.posterUrl;

  if (mediaEntryPoint?.posterUrl == null || mediaEntryPoint?.Title == null) {
    const mediaInfo = await getMediaInfo(ThisMediaId, ThisMediaType, apiKey);
    PosterImage =  
        mediaInfo?.["poster_path"] 
        ? "https://image.tmdb.org/t/p/w500/"+mediaInfo["poster_path"] 
        : "../../../assets/PosterNotFound.svg";

    PosterImage = normalizeRootUrl(PosterImage);
    ThisMediaTitle =  mediaInfo?.["name"] ?? mediaInfo?.["title"];
    const targetIdentification = {MediaId:ThisMediaId,MediaType:ThisMediaType};
    updateLibraryElement(targetIdentification,{posterUrl:PosterImage, Title:ThisMediaTitle});
  }

  const imageLoadingAnimation = true;
  const movieDomElement = creatingTheBaseOfNewMediaElement(ThisMediaTitle, PosterImage, ThisMediaId, ThisMediaType,imageLoadingAnimation);
  const removeFromLibraryButton = createRemoveFromWatchingLaterButton(ThisMediaId,ThisMediaType,IsInHomePage)

  movieDomElement.setAttribute("saveType",ThisSaveType);
  movieDomElement.setAttribute("saveTime",ThisSaveTime);
  movieDomElement.setAttribute("posterUrl",PosterImage);

  movieDomElement.appendChild(removeFromLibraryButton);

  if(ThisSaveType.includes("Currently Watching")){
    const continueVideoButton = createContinueWatchingButton(mediaEntryPoint);
    movieDomElement.appendChild(continueVideoButton);
  }

  return movieDomElement;
}

function fetchMediaDataFromLibrary (apiKey,wholeLibraryInformation,SavedMedia,RightmiddleDiv,IsInHomePage=false) {
  return Promise.all (
    wholeLibraryInformation.map(async (mediaEntryPoint) =>{
      try {
        const libElement = await createMediaElementForLibrary(mediaEntryPoint,apiKey,IsInHomePage);
        SavedMedia.appendChild(libElement);
        checkIfDivShouldHaveMoveToRightOrLeftButton([SavedMedia]);

      } catch(err) {
        console.error(err);
        err.message = (err.message === "Failed to fetch")
          ? "We're having trouble loading data</br>Please Check your connection and refresh!":err.message;

        setTimeout(()=>{
          RightmiddleDiv.innerHTML ="";
          const WarningElement = DisplayWarningOrErrorForUser(err.message);
          WarningElement.style.paddingBottom = "1000px;";
          RightmiddleDiv.appendChild(WarningElement);
          RightmiddleDiv.style.opacity = 1;
        },800);

      }
    })
  );
}

function createMediaDownloadElement(mediaLibEntryPoint, formatedDownloadInfo) {
  const { downloadStatus, displayTitle, progress, totalSize, currentSize } = formatedDownloadInfo;

  const MediaDownloadElement = document.createElement("div");

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

function createTorrentElement(torrentBasicInfo, torrentAdvancedInfo) {
  const [Quality, Title, Size, SeedersNumber] = torrentBasicInfo;
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
  addFloatingDivToDisplayFullTitle(TorrentElement, ".div-MediaDescription p");

  return TorrentElement;
}

function addTorrentElementEventListener(TorrentElement, torrentsInfo) {
  const [MediaId, MediaType, fileName, MagnetLink, IMDB_ID,
       backgroundImage, episodeInfo, Size, Quality, Title] = torrentsInfo;

  TorrentElement.addEventListener("click",()=>{
    openMediaVideo(undefined,MediaId,MediaType,undefined,fileName,MagnetLink,IMDB_ID,backgroundImage,episodeInfo);
  });
 
  // right click handeling
  TorrentElement.addEventListener("mousedown",(event)=>{
    if (event.button === 2) {
      const mediaTitle = document.getElementById("h1-MovieTitle").innerText;
      const mediaReleaseYear = document.getElementById("p-movieYearOfRelease").innerText;
      const DownloadTargetInfo = {
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

function createContinueWatchingButton(mediaEntryPoint){
  const continueVideoButton = document.createElement("button");
  continueVideoButton.classList.add("continue-video-button");

  fetch('../../../assets/icons/playVideo.svg')
    .then(response => response.text())
    .then(svgText => {
      continueVideoButton.innerHTML = svgText;
      addContrastForPlayIcon();
    })
  .catch(err=>{
    console.error(err.message);
  });
  continueWatchingEventListener(continueVideoButton,mediaEntryPoint)

  return continueVideoButton;
}

async function continueWatchingEventListener(continueVideoButton,mediaEntryPoint) {
  if(mediaEntryPoint.findInLib === true) {
    const mediaLibraryEntryPointIdentifier = {
      MediaId:mediaEntryPoint.mediaId,
      MediaType:mediaEntryPoint.mediaType
    };
    mediaEntryPoint = await window.electronAPI.loadMediaLibraryInfo(mediaLibraryEntryPointIdentifier);
    mediaEntryPoint = mediaEntryPoint[0];
  }

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
}

function addContrastForPlayIcon() {
  const root = document.documentElement;
  const primaryColor = getComputedStyle(root).getPropertyValue('--primary-color').trim();
  const [r,g,b] = primaryColor.split(",").slice(0,3).map(Number);
  const avgColor = (r + g + b) / 3;
  const fillColor = avgColor > 100 ? "black" : "white";
  const bgColor = `rgba(${primaryColor})`;

  document.querySelectorAll(".continue-video-button").forEach(item=> {item.style.backgroundColor = bgColor});
  document.querySelectorAll(".continue-video-icon").forEach(item => {item.style.fill = fillColor});
}


// ################################### LIBRARY MANAGEMENT ###################################

async function loadLibraryInfo(identification=undefined){
  try{
    const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo(identification).catch((err)=>console.error(err.message));
    if(wholeLibraryInformation == null){
      console.log("No matches in the library");
      return [];
    }
    return wholeLibraryInformation;
  }catch(err){
    console.error(err.message);
    return undefined;
  }
}

async function updateLibraryElement(targetIdentification,updateValues) {
  const MediaId = targetIdentification.MediaId;
  const MediaType = targetIdentification.MediaType;
  let MediaLibraryObject = await loadLibraryInfo(targetIdentification);
  if(MediaLibraryObject != null && MediaLibraryObject.length){
    MediaLibraryObject = {...MediaLibraryObject[0],...updateValues}; 
    await window.electronAPI.removeMediaFromLibrary(targetIdentification);
    window.electronAPI.addMediaToLibrary(MediaLibraryObject);
  }
}

async function ToggleInLibrary(toggleInLibraryElement, mediaId, mediaType, Title, posterUrl, typeOfSave, setAsPressed) {
  if (toggleInLibraryElement.hasAttribute("pressed") && !setAsPressed) {
    setAddToLibraryButtonToNormal(toggleInLibraryElement);
    const MediaLibraryObjectIdentifiers = {
      MediaId: mediaId.toString(),
      MediaType: mediaType
    };
    window.electronAPI.removeMediaFromLibrary(MediaLibraryObjectIdentifiers);

  } else {
    setAddToLibraryButtonToPressed(toggleInLibraryElement);
    const libInfo = await loadLibraryInfo();
    const SearchedMediaElement = libInfo.filter(item => (item.MediaId === mediaId && item.MediaType === mediaType));
    const MediaElementDoesExist = SearchedMediaElement.length > 0;
    let MediaLibraryObject;
    const currentEpochTime = Date.now().toString();
    if (MediaElementDoesExist) {
      MediaLibraryObject = SearchedMediaElement[0];
      MediaLibraryObject.typeOfSave = [typeOfSave];
      MediaLibraryObject.timeOfSave = currentEpochTime;
    } else {
      MediaLibraryObject = {
        MediaId: mediaId.toString(),
        MediaType: mediaType,
        timeOfSave: currentEpochTime,
        typeOfSave: [typeOfSave],
        Title: Title,
        posterUrl: posterUrl,
        episodesWatched: [],
        lastPlaybackPosition: 0,
        timeWatched: 0
      };
    }
    window.electronAPI.addMediaToLibrary(MediaLibraryObject);
  }
}

function removeMediaFromLibrary(removeFromLibraryButton,mediaId,mediaType){
  const MediaLibraryObject = {
    MediaId:mediaId.toString(),
    MediaType:mediaType
  }

  const MediaElementsContainer = removeFromLibraryButton.parentElement;
  const SaveDiv = MediaElementsContainer.parentElement;
  MediaElementsContainer.style.opacity = 0;
  MediaElementsContainer.remove();

  const numberOfElementsLeftInLibrary = SaveDiv ? SaveDiv.querySelectorAll(".div-MovieElement").length : 0;

  window.electronAPI.removeMediaFromLibrary(MediaLibraryObject);
  return numberOfElementsLeftInLibrary;
}

function createToggleToLibraryButton(LibraryInformation, Id, ThisMediaType,Title,posterUrl){
  const toggleInLibraryBtn = document.createElement("button"); 

  toggleInLibraryBtn.classList.add("btn-toggle-in-library");

  const mediaIsInLibrary = LibraryInformation.filter(libraryEntryPoint => 
    (libraryEntryPoint.MediaId.toString() === Id.toString()) &&
    (libraryEntryPoint.MediaType.toString() === ThisMediaType.toString())).length;

  if(mediaIsInLibrary) setAddToLibraryButtonToPressed(toggleInLibraryBtn);
  else setAddToLibraryButtonToNormal(toggleInLibraryBtn)

  addToggleToLibButtonEventListener(toggleInLibraryBtn,Id,ThisMediaType,Title,posterUrl);
  return toggleInLibraryBtn;
}

function addToggleToLibButtonEventListener(thistoggleinlibrarybtn, mediaId, mediaType, Title, posterUrl) {
  if (thistoggleinlibrarybtn) {
    thistoggleinlibrarybtn.addEventListener("click", (event) => {
      const btn = event.currentTarget;
      ToggleInLibrary(btn, mediaId.toString(), mediaType, Title, posterUrl, "Watch Later");
      event.stopPropagation();
      event.stopImmediatePropagation();
    });
  }
}

function setAddToLibraryButtonToNormal(toggleInLibrary) {
  toggleInLibrary.innerHTML = saveToLib;
  toggleInLibrary.removeAttribute("pressed");
}

function setAddToLibraryButtonToPressed(toggleInLibrary) {
  toggleInLibrary.innerHTML = savedToLib;
  toggleInLibrary.setAttribute("pressed"," ");
}

function createRemoveFromWatchingLaterButton(Id,ThisMediaType,IsInHomePage){
  const removeFromLibraryButton = document.createElement("button"); 
  removeFromLibraryButton.innerHTML = xRemoveIcon;
  removeFromLibraryButton.classList.add("btn-remove-from-library");
  addEventListenerToRemoveFromLibraryButton(removeFromLibraryButton,Id,ThisMediaType,IsInHomePage)
  return removeFromLibraryButton;
}

function addEventListenerToRemoveFromLibraryButton(removeFromLibraryButton,Id,ThisMediaType,IsInHomePage = false){
  removeFromLibraryButton.addEventListener("click",(event)=>{
    const numberOfElementsLeftInLibrary = removeMediaFromLibrary(removeFromLibraryButton,Id,ThisMediaType);

    if(!numberOfElementsLeftInLibrary){
      if (!IsInHomePage) {
        addEmptyLibraryWarning(RightmiddleDiv)

      } else {
        const continueWatchingElement = document.getElementById("continue-watching-categorie");
        if(continueWatchingElement)
          continueWatchingElement.style.display = "none";
      }
    }

    event.stopPropagation();
    event.stopImmediatePropagation();
  });
}


// ################################### API / DATA FETCHING ###################################

async function getMediaInfo(MediaId, MediaType, apiKey) {
  const searchQuery = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;
  const res = await fetch(searchQuery);
  const mediaData = await res.json();
  if(mediaData.status_code === 7)
    throw new Error("We're having trouble loading data</br>Please make sure your Authentication Key is valide!");

  return mediaData;
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

async function loadingAllSubs(id,episodeNumber,seasonNumber){
  try{
    const params = new URLSearchParams({
      id,
      ...((episodeNumber && seasonNumber) && { season: seasonNumber, episode: episodeNumber })
    });
    const WYZIE_API_KEY = await window.electronAPI.getWyzieAPIKey();
    const requestUrl = `https://sub.wyzie.ru/search?${params}&key=${WYZIE_API_KEY}`;
    const res = await fetch(requestUrl);
    
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


// ################################### UI COMPONENTS & FEEDBACK ###################################

function DisplayWarningOrErrorForUser(warningMessage,addRefreshButton = true) {
  const WarningDiv = document.createElement("div");
  const WarningMessage = document.createElement("span");
  const RefreshButton = document.createElement("button");

  WarningDiv.className = "div-WarningMessage";
  WarningMessage.className = "span-WarningMessage";
  RefreshButton.className = "btn-refreshAfterWarningMessage";

  WarningMessage.innerHTML = warningMessage;
  RefreshButton.innerHTML = reloadIcon;

  const leftDiv = document.getElementById("div-middle-left");
  const leftDivWidth = leftDiv? leftDiv.offsetWidth : 0;

  WarningDiv.style.marginRight = `${leftDivWidth}px`;

  RefreshButton.addEventListener("click",()=>{window.location.reload()});

  WarningDiv.appendChild(WarningMessage);
  if(addRefreshButton)
    WarningDiv.appendChild(RefreshButton);

  return WarningDiv;
}

function addEmptyLibraryWarning(warningContainer){
  const existingWarning = warningContainer.querySelector(".div-WarningMessage");
  if(!existingWarning){
    const WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty",false);
    warningContainer.appendChild(WarningElement);
  }else{
    existingWarning.style.display = "flex";
  }
}

function hideEmptyLibraryWarning(warningContainer){
  const WarningElement = warningContainer.querySelector(".div-WarningMessage");
  if(WarningElement){
    WarningElement.style.display = "none";
  }
}

function displayMessage(messageContent="hello") {
  const messageDiv = document.getElementById("messageDiv");
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

function addFloatingDivToDisplayFullTitle (MediaElement, elementToTrackQuerySelector="p") {
  const paragraph = MediaElement?.querySelector(elementToTrackQuerySelector);
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

function putTextIntoDiv(Div,textContent){
  const textDiv = document.createElement("div");
  const text = document.createElement("span");

  textDiv.id = "div-text";
  text.id = "span-text";
  text.innerText = textContent;

  textDiv.append(text); 
  Div.append(textDiv);
}

function setLeftButtonStyle(buttonId) {
  const buttonIcon = document.querySelector(`#${buttonId} .icon`);
  buttonIcon.style.fill = "rgba(var(--icon-hover-color))";
}


// ################################### ICONS & ASSET LOADING ###################################

function loadIconsDynamically() {
  document.addEventListener("DOMContentLoaded", ()=>{
    handleFullScreenIcon();
    handleGoBackIcon();
  });

  fetch('../../../assets/icons/storage.svg')
    .then(response => response.text())
    .then(svgText => {
      document.querySelectorAll('.div-storageImage').forEach(element=>element.innerHTML = svgText);
    })
    .catch(err=>{
      console.error(err.message);
    });
  fetch('../../../assets/icons/seeds.svg')
    .then(response => response.text())
    .then(svgText => {
      document.querySelectorAll('.div-seedImage').forEach(element=>element.innerHTML = svgText);
    })
    .catch(err=>{
      console.error(err.message);
    });
}

function loadImageWithAnimation(imageContainer, imageElement, imagePath, alternativeImage = "../../../assets/PosterNotFound.svg") {
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

function handleFullScreenIcon() {
  const FullScreenIcon = "../../../assets/icons/fullscreen.png";
  const UnFullScreenIcon = "../../../assets/icons/unfullscreen.png";

  const fullscreenButton = document.getElementById("img-fullscreen");
  if (!window.screenTop && !window.screenY) 
    fullscreenButton?.setAttribute("src",UnFullScreenIcon);
  else
    fullscreenButton?.setAttribute("src",FullScreenIcon);
}

async function handleGoBackIcon(){
  const goBackButton = document.querySelector("#btn-goBack");
  const goBackIcon = goBackButton.querySelector("svg");
  const canGoBack = await window.electronAPI.canGoBack();
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

async function fullscreenClicked(){
  const isFullScreen = await window.electronAPI.toggleFullscreen();
  const fullscreenImageElement = document.getElementById("img-fullscreen");
  if(isFullScreen == null) return;
  fullscreenImageElement.src = isFullScreen ? "../../../assets/icons/unfullscreen.png" : "../../../assets/icons/fullscreen.png";
}


// ################################### DROPDOWN COMPONENTS ###################################

function dropDownInit(){
  manageDropDowns();
  syncDropdownWidths();
  // setTimeout(syncDropdownWidths, 100);
}

function manageDropDowns() {
  const customSelects = document.querySelectorAll('.custom-select:not(#custon-save-dropdown)');
  
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
  const customSelects = document.querySelectorAll('.custom-select:not(.noResize)');
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
  return dropdown.getAttribute('data-value') ||
    dropdown.querySelector('.select-option').getAttribute('value');
}

function manageSaveDropDowns() {
  const saveDropDown = document.getElementById('custon-save-dropdown');
  
  const trigger = saveDropDown.querySelector('.select-trigger');
  const dropdown = saveDropDown.querySelector('.select-dropdown');
  const options = saveDropDown.querySelectorAll('.select-option');
  
  const newTrigger = trigger.cloneNode(true);
  trigger.parentNode.replaceChild(newTrigger, trigger);
  
  newTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = saveDropDown.classList.contains('is-open');
    
    saveDropDown.classList.remove('is-open');
    
    if (!isOpen) {
      saveDropDown.classList.add('is-open');
      newTrigger.setAttribute('aria-expanded', 'true');
    }
  });
  
  options.forEach(option => {
    option.addEventListener('click', () => {
      const value = option.getAttribute('value');
      const text = option.textContent;

      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      
      dropdown.setAttribute('data-value', value);
      
      saveDropDown.classList.remove('is-open');
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
 
  document.addEventListener('click', () => {
    saveDropDown.classList.remove('is-open');
    const trigger = saveDropDown.querySelector('.select-trigger');
    trigger.setAttribute('aria-expanded', 'false');
  });
}


// ################################### UTILITIES ###################################

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

function base64Id(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
