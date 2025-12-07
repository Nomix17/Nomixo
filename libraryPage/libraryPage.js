let RightmiddleDiv = document.getElementById("div-middle-right");
let SelectMediaType = document.getElementById("select-type");
let SelectSaveType = document.getElementById("select-save");
let SavedMedia = document.getElementById("div-SavedMedia");
let categoriDescription = document.querySelector(".div-categories-description");
let searchInput = document.getElementById("input-searchForMovie");
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

const data = new URLSearchParams(window.location.search);
let typeOfSave = data.get("typeOfSave");

SelectMediaType.value = "all";
SelectSaveType.value = typeOfSave;
addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

async function loadData(){
  const apiKey = await window.electronAPI.getAPIKEY();
  let wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  RightmiddleDiv.style.opacity = 1;

  if(wholeLibraryInformation == undefined || wholeLibraryInformation.length == 0){
    let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty");
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
  }else{
    await fetchMediaDataFromLibrary(apiKey,wholeLibraryInformation,SavedMedia,globalLoadingGif,RightmiddleDiv);
    filterMedia(SelectMediaType.value,SelectSaveType.value)
  }

  [SelectMediaType,SelectSaveType].forEach(selectElement => {
    selectElement.addEventListener("change",()=>{
      typeOfSave = SelectSaveType.value;
      categoriDescription.querySelector("h1").innerText = `${SelectSaveType.value}`;
      filterMedia(SelectMediaType.value,SelectSaveType.value);
    });
  });
 
 
  categoriDescription.querySelector("h1").innerText = `${SelectSaveType.value}`;
}

const getCategorieFullName = (value) => {
  let MediaCategorie = SelectMediaType.querySelector(`option[value="${SelectMediaType.value}"]`).text;
  return MediaCategorie; 
}

function filterMedia(MediaTypeFilter,SaveTypeFilter){
  let displayedNumber = 0;
  for(item of SavedMedia.querySelectorAll(".div-MovieElement")){
    if((MediaTypeFilter == "all" || item.getAttribute("mediaType") == MediaTypeFilter) &&
      (item.getAttribute("saveType").includes(SaveTypeFilter) || SaveTypeFilter.toLowerCase() == "all")){
      displayedNumber++;
      item.style.display = "flex";
    }else{
      item.style.display = "none";
    }
  }

  if(displayedNumber == 0){
    let existingWarning = RightmiddleDiv.querySelector(".div-WarningMessage");
    if(!existingWarning){
      let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty");
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

loadData();

setupKeyPressesForInputElement(searchInput);

setupKeyPressesHandler();

setLeftButtonStyle("btn-library");

loadIconsDynamically();

handlingMiddleRightDivResizing();
