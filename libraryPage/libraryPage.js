let RightmiddleDiv = document.getElementById("div-middle-right");
let SelectMediaType = document.getElementById("select-type");
let SelectSaveType = document.getElementById("select-save");
let SavedMedia = document.getElementById("div-SavedMedia");
let categoriDescription = document.querySelector(".div-categories-description");
let searchInput = document.getElementById("input-searchForMovie");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const data = new URLSearchParams(window.location.search);
let typeOfSave = data.get("typeOfSave");

addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

async function loadDataFromLibrary(apiKey){
  let wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  
  if(wholeLibraryInformation === undefined || wholeLibraryInformation.length === 0){
    addEmptyLibraryWarning(RightmiddleDiv);
  }else{
    await fetchMediaDataFromLibrary(apiKey,wholeLibraryInformation,SavedMedia,RightmiddleDiv);
  }
}

const getCategorieFullName = (value) => {
  let option = SelectMediaType.querySelector(`.select-option[value="${getDropdownValue(SelectMediaType)}"]`);
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
      let newTypeOfSave = getDropdownValue(SelectSaveType);
      let newMediaType = getDropdownValue(SelectMediaType);
      changeDescriptionTitleValue(newTypeOfSave);
      let numberOfDisplayedElements = filterMedia(newMediaType, newTypeOfSave);
      if(!numberOfDisplayedElements)
        addEmptyLibraryWarning(RightmiddleDiv);
      else
        hideEmptyLibraryWarning(RightmiddleDiv);
    });
  });
}

function changeDescriptionTitleValue(newTypeOfSave=typeOfSave){
  let descriptionTitle = categoriDescription.querySelector("h1")
  if(descriptionTitle)
    descriptionTitle.innerText = newTypeOfSave;
}

async function loadCachedMediaData(cachedData){
  let containersData = cachedData?.containers_data;

  if(containersData){
    let lastLoadedPage = cachedData?.last_loaded_medias_page;

    SavedMedia.innerHTML = "";

    let allMediaElements = [];
    let allXremoveFromLibButtons = [];
    for(let mediaContainer of containersData){
      if(mediaContainer.id){
        let containerDomElement = document.getElementById(mediaContainer.id);
        if(containerDomElement && mediaContainer?.HTMLContent) containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...Array.from(document.querySelectorAll(".div-MovieElement")))
        allXremoveFromLibButtons.push(...Array.from(document.querySelectorAll(".btn-remove-from-library")));
      }
    }

    for(let mediaDomElement of allMediaElements){
      if(mediaDomElement){
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        if(mediaId && mediaType)
          addEventListenerToMediaDomElementToOpenDetailPage(mediaDomElement,mediaId,mediaType)
      }
    }

    for(let removeFromLibButton of allXremoveFromLibButtons){
      let thisMediaElement = removeFromLibButton.parentElement;
      if(thisMediaElement && removeFromLibButton) {
        const mediaId = thisMediaElement.getAttribute("mediaId");
        const mediaType = thisMediaElement.getAttribute("mediaType");
        addEventListenerToRemoveFromLibraryButton(removeFromLibButton,mediaId,mediaType)
      }
    }

  }
}

async function loadCachedDropDownValue(cachedData){
  let dropDownsData = cachedData?.dropdowns_data;
  if(dropDownsData){
    for(let dropDownInfo of dropDownsData){
      if(dropDownInfo.id){
        let dropDownDomElement = document.getElementById(dropDownInfo.id);
        if(dropDownDomElement && dropDownInfo?.cachedValue){
          setDropdownValue(dropDownDomElement,dropDownInfo.cachedValue);
        }
      }
    }
  }
}

async function loadMedia(){
  let cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const apiKey = await window.electronAPI.getAPIKEY();

  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    loadCachedMediaData(cachedMediaInfo);
    loadCachedRightDivScrollValue(cachedMediaInfo);
    loadCachedDropDownValue(cachedMediaInfo);
  }else{
    loadDataFromLibrary(apiKey);
  }
}

async function initPage(){
  changeDescriptionTitleValue();

  dropDownInit();
  setDropdownValue(SelectSaveType, typeOfSave || "All");
  setDropdownValue(SelectMediaType, "all");
  addDropDownsEventListener();

  await loadMedia();

  filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));

  globalLoadingGif.remove()
  RightmiddleDiv.style.opacity = 1;
}

initPage();
setupKeyPressesForInputElement(searchInput);
setupKeyPressesHandler();
setLeftButtonStyle("btn-library");
loadIconsDynamically();
handlingMiddleRightDivResizing();
