const RightmiddleDiv = document.getElementById("div-middle-right");
const SelectMediaType = document.getElementById("select-type");
const SelectSaveType = document.getElementById("select-save");
const SelectSortType = document.getElementById("select-sort");
const SavedMedia = document.getElementById("div-SavedMedia");
const categoriDescription = document.querySelector(".div-categories-description");
const searchInput = document.getElementById("input-searchForMovie");
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const data = new URLSearchParams(window.location.search);
const typeOfSave = data.get("typeOfSave");

setTimeout(()=>{
  try {
    globalLoadingGif.style.opacity = "1"
  } catch(err) {
    console.log(err)
  }
},100);

async function loadDataFromLibrary(apiKey){
  const wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  
  if(wholeLibraryInformation == null || wholeLibraryInformation.length === 0){
    addEmptyLibraryWarning(RightmiddleDiv);
  }else{
    await fetchMediaDataFromLibrary(apiKey,wholeLibraryInformation,SavedMedia,RightmiddleDiv);
  }
}

const getCategorieFullName = (value) => {
  const option = SelectMediaType.querySelector(`.select-option[value="${getDropdownValue(SelectMediaType)}"]`);
  return option ? option.textContent : value;
}

function filterMedia(MediaTypeFilter,SaveTypeFilter){
  let numberOfDisplayedElements = 0;
  for(item of SavedMedia.querySelectorAll(".div-MovieElement")){
    if(
      (MediaTypeFilter.toLowerCase() === "all" || item.getAttribute("mediaType") === MediaTypeFilter) &&
      (SaveTypeFilter.toLowerCase() === "all" || item.getAttribute("saveType").includes(SaveTypeFilter))
    ){
      numberOfDisplayedElements ++;
      item.style.display = "flex";
    }else{
      item.style.display = "none";
    }
  }

  return numberOfDisplayedElements;
}

async function addDropDownsEventListener(){
  [SelectMediaType,SelectSaveType].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      const newTypeOfSave = getDropdownValue(SelectSaveType);
      const newMediaType = getDropdownValue(SelectMediaType);
      changeDescriptionTitleValue(newTypeOfSave);
      const numberOfDisplayedElements = filterMedia(newMediaType, newTypeOfSave);
      if(!numberOfDisplayedElements)
        addEmptyLibraryWarning(RightmiddleDiv);
      else
        hideEmptyLibraryWarning(RightmiddleDiv);
    });
  });

  SelectSortType.addEventListener("dropdownChange",()=>{
    const sortType = getDropdownValue(SelectSortType);
    sortMediaELements(SortingCriteria[sortType]);
  });

}

const SortingCriteria = {
  alphabetical: 0,
  newest: 1,
  oldest: 2
};

function sortMediaELements(sortingType = SortingCriteria.alphabetical) {
  const mediaElements = Array.from(SavedMedia.children);
  switch (sortingType) {
    case SortingCriteria.alphabetical:{
      mediaElements.sort((a,b) => {
        const aTitle = a.querySelector(".parag-MovieTitle p").textContent || "";
        const bTitle = b.querySelector(".parag-MovieTitle p").textContent || "";
        return aTitle.localeCompare(bTitle);
      });
      break;
    }

    case SortingCriteria.newest:{
      mediaElements.sort((a,b) => {
        const aSaveTime = Number(a.getAttribute("saveTime")) || 0;
        const bSaveTime = Number(b.getAttribute("saveTime")) || 0;
        return bSaveTime - aSaveTime;
      });

      break;
    }

    case SortingCriteria.oldest:{
      mediaElements.sort((a,b) => {
        const aSaveTime = Number(a.getAttribute("saveTime")) || 0;
        const bSaveTime = Number(b.getAttribute("saveTime")) || 0;
        return aSaveTime - bSaveTime;
      });
      break;
    }
  }

  mediaElements.forEach(ele => {SavedMedia.appendChild(ele)});
}


function changeDescriptionTitleValue(newTypeOfSave=typeOfSave){
  const descriptionTitle = categoriDescription.querySelector("h1")
  if(descriptionTitle)
    descriptionTitle.innerText = newTypeOfSave;
}

async function loadCachedMediaData(cachedData){
  const containersData = cachedData?.containers_data;
  if(containersData){
    SavedMedia.innerHTML = "";
    const allMediaElements = [];
    const allXremoveFromLibButtons = [];
    const allContinueWatchingButton = [];
    for(const mediaContainer of containersData){
      if(mediaContainer.id){
        const containerDomElement = document.getElementById(mediaContainer.id);
        if(!containerDomElement || !mediaContainer?.HTMLContent) continue;
        containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...document.querySelectorAll(".div-MovieElement"));
        allXremoveFromLibButtons.push(...document.querySelectorAll(".btn-remove-from-library"));
        allContinueWatchingButton.push(...document.querySelectorAll(".continue-video-button"));
      }
    }
    
    // recreate MediaElement Event Listeners
    for(const mediaDomElement of allMediaElements){
      if(mediaDomElement){
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        const posterUrl = mediaDomElement.getAttribute("posterUrl");
        if(mediaId && mediaType){
          const posterContainer = mediaDomElement.querySelector(".img-MoviePosterContainer");
          const posterElement = mediaDomElement.querySelector(".img-MoviePoster");
          loadImageWithAnimation(posterContainer,posterElement,posterUrl);
          addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType)
          addFloatingDivToDisplayFullTitle(mediaDomElement);
        }
      }
    }

    // recreate xremove Btns Event Listeners
    for(const removeFromLibButton of allXremoveFromLibButtons){
      const thisMediaElement = removeFromLibButton?.parentElement;
      if(!thisMediaElement) continue;
      addEventListenerToRemoveFromLibraryButton(
        removeFromLibButton,
        thisMediaElement.getAttribute("mediaId"),
        thisMediaElement.getAttribute("mediaType")
      )
    }

    // recreate continue watching Btns Event Listeners
    for(const continueWatchingBtn of allContinueWatchingButton){
      const thisMediaElement = continueWatchingBtn?.parentElement;
      if(!thisMediaElement) continue;
      continueWatchingEventListener(
        continueWatchingBtn,
        {
          mediaId:thisMediaElement.getAttribute("mediaId"),
          mediaType:thisMediaElement.getAttribute("mediaType"),
          findInLib:true
        }
      )
    }
  }
}

async function loadMedia(){
  const cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const apiKey = await window.electronAPI.getTMDBAPIKEY();

  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    loadCachedMediaData(cachedMediaInfo);
    loadCachedRightDivScrollValue(cachedMediaInfo);
    loadCachedDropDownValue(cachedMediaInfo);
  }else{
    await loadDataFromLibrary(apiKey);
    sortMediaELements(SortingCriteria.newest)
  }
}

async function initPage(){
  changeDescriptionTitleValue();

  dropDownInit();
  setDropdownValue(SelectMediaType, "all");
  setDropdownValue(SelectSaveType, typeOfSave || "All");
  setDropdownValue(SelectSortType,"newest");
  addDropDownsEventListener();

  await loadMedia();

  filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));

  globalLoadingGif.remove()
  RightmiddleDiv.style.opacity = 1;
}

function focusFunction(element) {
  element.focus();
}

initPage();
setupKeyPressesForInputElement(searchInput);
setupKeyPressesHandler();
handleNavigationButtonsHandler(focusFunction);
setLeftButtonStyle("btn-library");
loadIconsDynamically();
handlingMiddleRightDivResizing();
