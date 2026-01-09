let RightmiddleDiv = document.getElementById("div-middle-right");
let data = new URLSearchParams(window.location.search);
let personId = data.get("personId");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

let LibraryInformation;

addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

async function getPersonInfo(apiKey){
  return fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}`)
  .then(PersonData => PersonData.json())
  .then(PersonInfo =>{
    let Name = PersonInfo.name;
    let ProfilePic = PersonInfo.profile_path
    let Department = PersonInfo.known_for_department;
    let Biography = PersonInfo.biography;
    let ImdbId = PersonInfo.imdb_id; 
    document.title = Name +" - Discovery"; 

    let personInformation = [Name, ProfilePic, Department, Biography, ImdbId];

    insertPersonInformation(personInformation);

    return Department;

  }).catch((err) => {
    err.message = (err.message === "Failed to fetch") 
      ? "We're having trouble loading data.</br>Please Check your connection and refresh!"
      : err.message;

    setTimeout(()=>{
      RightmiddleDiv.innerHTML ="";
      let WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    },800);

    console.error(err);
    return null;
  })
}

function insertPersonInformation(personInformation){
  let [Name, ProfilePic, Department, Biography, ImdbId] = personInformation;

  let personNameElement = document.getElementById("para-personName");
  let personProfileElementContainer = document.getElementById("div-left-Person-description");
  let personProfileElement = document.getElementById("img-personProfilePic");
  let personDepartmentElement = document.getElementById("para-personDepartment");
  let personBioElement = document.getElementById("bio-content");

  let personFullBioDiv = document.getElementById("full-bio-div");
  let personProfileFullBioElement = personFullBioDiv.querySelector("#img-personProfilePic-full-bio");
  let personNameFullBioElement = personFullBioDiv.querySelector("#full-bio-person-name");
  let personFullBioParagraphElement = personFullBioDiv.querySelector("#full-bio-paragraph");

  let imagePath = ProfilePic == null ? "../assets/ProfileNotFound.png" : "https://image.tmdb.org/t/p/w500/"+ProfilePic;

  personNameElement.innerText = Name;
  personNameFullBioElement.innerText = Name;
  personDepartmentElement.innerText = "Department : "+Department;
  personBioElement.innerText = Biography;
  personFullBioParagraphElement.innerText = Biography;

  if(!Biography || Biography.trim() === "")
    hideBiography();
  else
    document.getElementById("biography-placeholder").style.display = "none"

  loadImageWithAnimation(personProfileElementContainer, personProfileElement, imagePath);
  personProfileFullBioElement.src = imagePath;
}

function hideBiography(){
  const rightDescriptionDiv = document.getElementById("div-right-Person-description")
  document.querySelector(".bio-wrapper").style.display = "none"

}

function addDescriptionButtonsEventListener(){
  const bioReadMoreBtn = document.getElementById('bio-read-more');
  const bioOverlay = document.getElementById('full-bio-overlay');
  const closeBtn = bioOverlay?.querySelector('.close-btn');
  
  if (bioReadMoreBtn) {
    bioReadMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      bioOverlay.classList.add('active');
      dontGoBack = true;
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      bioOverlay.classList.remove('active');
      dontGoBack = false;
    });
  }
  
  if (bioOverlay) {
    bioOverlay.addEventListener('click', (e) => {
      if (e.target === bioOverlay) {
        bioOverlay.classList.remove('active');
        dontGoBack = false;
      }
    });
  }
  
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      bioOverlay.classList.remove('active');
    }
  });
}

async function fetchData(apiKey, personjob){
  LibraryInformation = await loadLibraryInfo();
  await fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}`).then(res=>res.json())
    .then(MediaData => insertPersonFamousWorkIntoSuggestionDiv(MediaData, personjob,LibraryInformation));
  await loadCachedRightMiddleDivScrollValue();
  globalLoadingGif.remove();
  RightmiddleDiv.style.opacity = 1;
}

function insertPersonFamousWorkIntoSuggestionDiv(MediaData, personJob,LibraryInformation){
  let GeneraleWorkData;
  let CrewData = MediaData.crew;
  let CastData = MediaData.cast;
  if(personJob === "Acting") GeneraleWorkData = [...CastData,...CrewData];
  else  GeneraleWorkData = [...CrewData,...CastData];

  insertMediaElements(GeneraleWorkData,MediaSuggestions,undefined,LibraryInformation);
}

async function loadCachedMediaData(cachedData){
  let containersData = cachedData?.containers_data;

  if(containersData){
    MediaSuggestions.innerHTML = "";

    let allMediaElements = [];
    let allToggleToLibButtons = [];
    for(let mediaContainer of containersData){
      if(mediaContainer.id){
        let containerDomElement = document.getElementById(mediaContainer.id);
        if(containerDomElement && mediaContainer?.HTMLContent) containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...Array.from(document.querySelectorAll(".div-MovieElement")))
        allToggleToLibButtons.push(...Array.from(document.querySelectorAll(".btn-toggle-in-library")));
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

    for(let toggleToLibButton of allToggleToLibButtons){
      let thisMediaElement = toggleToLibButton.parentElement;
      if(thisMediaElement && toggleToLibButton) {
        const mediaId = thisMediaElement.getAttribute("mediaId");
        const mediaType = thisMediaElement.getAttribute("mediaType");
        addToggleToLibButtonEventListener(toggleToLibButton,mediaId,mediaType)
      }
    }

  }
}

function loadCachedPersonInfo(cachedMediaInfo){
  let personCachedInformation = cachedMediaInfo.person_information;
  let personInformationDomElement = document.getElementById("div-Person-description")
  if(personCachedInformation && personInformationDomElement){
    personInformationDomElement.innerHTML = personCachedInformation
    let personBioElement = document.getElementById("para-personBiography");
  }
}

async function loadMedia(apiKey){
  let cachedMediaInfo = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);

  if(cachedMediaInfo){
    console.log("Loading Cached Information");
    loadCachedMediaData(cachedMediaInfo);
    loadCachedRightDivScrollValue(cachedMediaInfo);
    loadCachedPersonInfo(cachedMediaInfo);
  }else{
    let personDepartment = await getPersonInfo(apiKey,personId)
    if(personDepartment)
      await fetchData(apiKey,personId,personDepartment); 
  }
  addDescriptionButtonsEventListener();
}

async function initPage(){
  const apiKey = await window.electronAPI.getAPIKEY();
  loadMedia(apiKey);
  globalLoadingGif.remove();
  RightmiddleDiv.style.opacity = 1;
}

initPage();
setupKeyPressesHandler();
loadIconsDynamically();
handlingMiddleRightDivResizing();
let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key === "Enter") openSearchPage();
});
