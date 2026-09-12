const RightmiddleDiv = document.getElementById("div-middle-right");
const data = new URLSearchParams(window.location.search);
const personId = data.get("personId");
const MediaSuggestions = document.getElementById("div-MediaSuggestions")
const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

globalLoadingGif.style.opacity = "1"
async function getPersonInfo(apiKey) {

  const LibraryInformationPromise = loadLibraryInfo();
  return fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&append_to_response=combined_credits`)
  .then(PersonData => PersonData.json())
  .then(async PersonInfo => {
    const Name = PersonInfo.name;
    const ProfilePic = PersonInfo.profile_path
    const Department = PersonInfo.known_for_department;
    const Biography = PersonInfo.biography;
    const ImdbId = PersonInfo.imdb_id; 
    document.title = Name +" - Discovery"; 

    const personInformation = [Name, ProfilePic, Department, Biography, ImdbId];

    insertPersonInformation(personInformation);

    const libraryInfo = await LibraryInformationPromise;
    insertPersonFamousWorkIntoSuggestionDiv(PersonInfo.combined_credits, Department, libraryInfo);
    loadCachedRightMiddleDivScrollValue();

  }).catch((err) => {
    err.message = (err.message === "Failed to fetch") 
      ? "We're having trouble loading data.</br>Please Check your connection and refresh!"
      : err.message;

    setTimeout(()=>{
      RightmiddleDiv.innerHTML ="";
      const WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.classList.add("activate");
    },800);

    console.error(err);
    return null;
  })
}

function insertPersonInformation(personInformation) {
  const [Name, ProfilePic, Department, Biography, ImdbId] = personInformation;

  const personNameElement = document.getElementById("para-personName");
  const personProfileElementContainer = document.getElementById("div-left-Person-description");
  const personProfileElement = document.getElementById("img-personProfilePic");
  const personDepartmentElement = document.getElementById("para-personDepartment");
  const personBioElement = document.getElementById("bio-content");

  const personFullBioDiv = document.getElementById("full-bio-div");
  const personProfileFullBioElement = personFullBioDiv.querySelector("#img-personProfilePic-full-bio");
  const personNameFullBioElement = personFullBioDiv.querySelector("#full-bio-person-name");
  const personFullBioParagraphElement = personFullBioDiv.querySelector("#full-bio-paragraph");

  const imagePath = ProfilePic == null ? "../../../assets/ProfileNotFound.svg" : "https://image.tmdb.org/t/p/w500/"+ProfilePic;

  personNameElement.innerText = Name;
  personNameFullBioElement.innerText = Name;
  personDepartmentElement.innerText = "Department : "+Department;
  personBioElement.innerText = Biography;
  personFullBioParagraphElement.innerText = Biography;

  personNameElement.addEventListener("click",()=>{
    const imdbLink = `https://www.imdb.com/name/${ImdbId}/`;
    console.log(`Opening IMDB link: ${imdbLink}`);
    window.electronAPI.openExternalLink(imdbLink);
  });

  if(!Biography || Biography.trim() === "")
    hideBiography();
  else
    document.getElementById("biography-placeholder").style.display = "none"

  loadImageWithAnimation(personProfileElementContainer, personProfileElement, imagePath);
  personProfileFullBioElement.src = imagePath;
}

function hideBiography() {
  document.querySelector(".bio-wrapper").style.display = "none"
}

function addDescriptionButtonsEventListener() {
  const bioReadMoreBtn = document.getElementById('bio-read-more');
  const bioOverlay = document.getElementById('full-bio-overlay');
  const closeBtn = bioOverlay?.querySelector('.floating-x-remove-btn');
  
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

async function insertPersonFamousWorkIntoSuggestionDiv(credits, personJob, libraryInfo) {
  const GeneraleWorkData = 
    (personJob === "Acting") 
      ? [...credits.cast,...credits.crew] 
      : [...credits.crew,...credits.cast];

  insertMediaElements(GeneraleWorkData, MediaSuggestions, undefined, libraryInfo);
}

function loadCachedMediaData(cachedData) {
  const containersData = cachedData?.containers_data;
  if(containersData){
    MediaSuggestions.innerHTML = "";
    const allMediaElements = [];
    const allToggleToLibButtons = [];
    for(const mediaContainer of containersData) {
      if(mediaContainer.id) {
        const containerDomElement = document.getElementById(mediaContainer.id);
        if(!containerDomElement || !mediaContainer?.HTMLContent) continue;
        containerDomElement.innerHTML = mediaContainer.HTMLContent;
        allMediaElements.push(...containerDomElement.querySelectorAll(".div-MovieElement"));
        allToggleToLibButtons.push(...containerDomElement.querySelectorAll(".btn-toggle-in-library"));
      }
    }

    for(const mediaDomElement of allMediaElements){
      if(mediaDomElement){
        const mediaId = mediaDomElement.getAttribute("mediaId");
        const mediaType = mediaDomElement.getAttribute("mediaType");
        if(mediaId && mediaType)
          addEventListenerToMediaDomElementToOpenDetailPage(
            mediaDomElement,
            mediaId,
            mediaType
          )
      }
    }

    for(const toggleToLibButton of allToggleToLibButtons) {
      const thisMediaElement = toggleToLibButton?.parentElement;
      if(!thisMediaElement) continue;
      addToggleToLibButtonEventListener(
        toggleToLibButton,
        thisMediaElement.getAttribute("mediaId"),
        thisMediaElement.getAttribute("mediaType"),
      );
    }
  }
}

function loadCachedPersonInfo(cachedMediaInfo) {
  const personCachedInformation = cachedMediaInfo.person_information;
  const personInformationDomElement = document.getElementById("div-Person-description")
  if(personCachedInformation && personInformationDomElement){
    personInformationDomElement.innerHTML = personCachedInformation
  }
}

async function loadMedia(apiKey, cachedMediaInfo) {
  if(cachedMediaInfo) {
    console.log("Loading Cached Information");
    loadCachedMediaData(cachedMediaInfo);
    loadCachedRightDivScrollValue(cachedMediaInfo);
    loadCachedPersonInfo(cachedMediaInfo);
  } else {
    await getPersonInfo(apiKey)
  }
  addDescriptionButtonsEventListener();
}

async function initPage() {
  const [apiKey, cachedMediaInfo] = await Promise.all([
    window.electronAPI.getTMDBAPIKEY(),
    window.electronAPI.loadPageCachedDataFromHistory(document.URL)
  ]);
  await loadMedia(apiKey, cachedMediaInfo);
  globalLoadingGif.remove();
  RightmiddleDiv.classList.add("activate");
}

initPage();
setupKeyPressesHandler();
loadIconsDynamically();
handlingMiddleRightDivResizing();
const searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key === "Enter") openSearchPage();
});
