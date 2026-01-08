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

async function loadData(){
  const apiKey = await window.electronAPI.getAPIKEY();
  let wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  
  manageDropDowns();
  setDropdownValue(SelectSaveType, typeOfSave || "All");
  setDropdownValue(SelectMediaType, "all");
  syncDropdownWidths();
  
  let descriptionTitle = categoriDescription.querySelector("h1")
  if(descriptionTitle)
    descriptionTitle.innerText = typeOfSave;

  if(wholeLibraryInformation === undefined || wholeLibraryInformation.length === 0){
    let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty",false);
    RightmiddleDiv.appendChild(WarningElement);
  }else{
    let now = Date.now();
    await fetchMediaDataFromLibrary(apiKey,wholeLibraryInformation,SavedMedia,RightmiddleDiv);
    console.log("Library Media Elements where Created in: ",Date.now() - now + " ms")
    await loadCachedRightMiddleDivScrollValue();
    await loadDropDownCachedValue();
    filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));
  }

  globalLoadingGif.remove()
  RightmiddleDiv.style.opacity = 1;
  [SelectMediaType,SelectSaveType].forEach(selectElement=>{
    selectElement.addEventListener("dropdownChange", () => {
      let newTypeOfSave = getDropdownValue(SelectSaveType);
      let newMediaType = getDropdownValue(SelectMediaType);
      if(descriptionTitle)
        descriptionTitle.innerText = typeOfSave;
      filterMedia(newMediaType, newTypeOfSave);
    });
  });

  SelectSaveType.addEventListener("dropdownChange", () => {
    typeOfSave = getDropdownValue(SelectSaveType);
    if(descriptionTitle)
      descriptionTitle.innerText = typeOfSave;
    filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));
  });
}

const getCategorieFullName = (value) => {
  let option = SelectMediaType.querySelector(`.select-option[value="${getDropdownValue(SelectMediaType)}"]`);
  return option ? option.textContent : value;
}

function filterMedia(MediaTypeFilter,SaveTypeFilter){
  let displayedNumber = 0;
  for(item of SavedMedia.querySelectorAll(".div-MovieElement")){
    if((MediaTypeFilter === "all" || item.getAttribute("mediaType") === MediaTypeFilter) &&
      (item.getAttribute("saveType").includes(SaveTypeFilter) || SaveTypeFilter.toLowerCase() === "all")){
      displayedNumber++;
      item.style.display = "flex";
    }else{
      item.style.display = "none";
    }
  }

  if(displayedNumber === 0){
    let existingWarning = RightmiddleDiv.querySelector(".div-WarningMessage");
    if(!existingWarning){
      let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty",false);
      RightmiddleDiv.appendChild(WarningElement);
    }else{
      existingWarning.style.display = "flex";
    }
  }else{
    let WarningElement = RightmiddleDiv.querySelector(".div-WarningMessage");
    if(WarningElement){
      WarningElement.style.display = "none";
    }
  }

}

async function loadDropDownCachedValue(){

}

loadData();

setupKeyPressesForInputElement(searchInput);

setupKeyPressesHandler();

setLeftButtonStyle("btn-library");

loadIconsDynamically();

handlingMiddleRightDivResizing();
