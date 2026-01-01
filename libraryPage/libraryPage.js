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
  categoriDescription.querySelector("h1").innerText = `${typeOfSave}`;

  const apiKey = await window.electronAPI.getAPIKEY();
  let wholeLibraryInformation = await window.electronAPI.loadMediaLibraryInfo().catch(err=>console.error(err));
  
  manageDropDowns();
  setDropdownValue(SelectSaveType, typeOfSave || "All");
  setDropdownValue(SelectMediaType, "all");
  syncDropdownWidths();
  

  if(wholeLibraryInformation === undefined || wholeLibraryInformation.length === 0){
    let WarningElement = DisplayWarningOrErrorForUser("Your Library is Empty");
    RightmiddleDiv.appendChild(WarningElement);
    globalLoadingGif.remove();
  }else{
    await fetchMediaDataFromLibrary(apiKey,wholeLibraryInformation,SavedMedia,globalLoadingGif,RightmiddleDiv);
    await loadCachedRightMiddleDivScrollValue();
    await loadDropDownCachedValue();
    filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));
  }

  RightmiddleDiv.style.opacity = 1;
  SelectMediaType.addEventListener("dropdownChange", () => {
    typeOfSave = getDropdownValue(SelectSaveType);
    categoriDescription.querySelector("h1").innerText = `${typeOfSave}`;
    filterMedia(getDropdownValue(SelectMediaType), getDropdownValue(SelectSaveType));
  });

  SelectSaveType.addEventListener("dropdownChange", () => {
    typeOfSave = getDropdownValue(SelectSaveType);
    categoriDescription.querySelector("h1").innerText = `${typeOfSave}`;
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

function getDropdownValue(dropdown) {
  return dropdown.getAttribute('data-value') || dropdown.querySelector('.select-option').getAttribute('value');
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

async function loadDropDownCachedValue(){

}

loadData();

setupKeyPressesForInputElement(searchInput);

setupKeyPressesHandler();

setLeftButtonStyle("btn-library");

loadIconsDynamically();

handlingMiddleRightDivResizing();
