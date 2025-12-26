let RightmiddleDiv = document.getElementById("div-middle-right");
let data = new URLSearchParams(window.location.search);
let personId = data.get("personId");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")
let globalLoadingGif = document.getElementById("div-globlaLoadingGif");

let LibraryInformation;

addSmoothTransition();
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);

function getPersonInfo(apiKey,personId){
  fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}`)
  .then(PersonData => PersonData.json())
  .then(PersonInfo =>{
    let Name = PersonInfo.name;
    let ProfilePic = PersonInfo.profile_path
    let Department = PersonInfo.known_for_department;
    let Biography = PersonInfo.biography;
    let ImdbId = PersonInfo.imdb_id; 
    document.title = Name +" - Discovery"; 

    let personNameElement = document.getElementById("para-personName");
    let  personProfileElementContainer = document.getElementById("div-left-Person-description");
    let personProfileElement = document.getElementById("img-personProfilePic");
    let personDepartmentElement = document.getElementById("para-personDepartment");
    let personBioElement = document.getElementById("para-personBiography");
    personBioElement.setAttribute("displayState","less"); 

    if(Biography.length > 576){
      let OldBiography = Biography;
      Biography = Biography.slice(0,573)+"...";
      let readMoreElement = document.createElement("a");
      readMoreElement.style.color = "grey";

      readMoreElement.addEventListener("click",()=>{
        if(personBioElement.getAttribute("displayState") === "less"){
          readMoreElement.innerText = " read less"
          personBioElement.innerHTML = OldBiography;
          personBioElement.append(readMoreElement);
          personBioElement.setAttribute("displayState","full");
        }else{
          readMoreElement.innerText = "read more"
          personBioElement.innerHTML = Biography;
          personBioElement.append(readMoreElement);
          personBioElement.setAttribute("displayState","less");
        }
      });
      readMoreElement.innerText = "read more";
      personBioElement.append(readMoreElement);
    }

    let imagePath = ProfilePic == null ? "../assets/ProfileNotFound.png" : "https://image.tmdb.org/t/p/w500/"+ProfilePic;

    personNameElement.innerText = Name;
    personDepartmentElement.innerText = "Department : "+Department;

    loadImageWithAnimation(personProfileElementContainer, personProfileElement, imagePath);

    personBioElement.prepend(Biography+" ");
    fetchData(apiKey,personId,Department); 
  }).catch((err) => {
    err.message = (err.message === "Failed to fetch") ? "We’re having trouble loading data.</br>Please Check your connection and refresh!":err.message;
    console.error(err);
    setTimeout(()=>{
      RightmiddleDiv.innerHTML ="";
      let WarningElement = DisplayWarningOrErrorForUser(err.message);
      RightmiddleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      RightmiddleDiv.style.opacity = 1;
    },800);
  })
}

async function fetchData(apiKey,personId, personjob){
  LibraryInformation = await loadLibraryInfo();
  fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}`).then(res=>res.json())
    .then(MediaData => insertDataIntoDiv(MediaData, personjob,LibraryInformation));
  globalLoadingGif.remove();
  RightmiddleDiv.style.opacity = 1;

}

function insertDataIntoDiv(MediaData, personJob,LibraryInformation){
  let tempArray=[];
  let GeneraleWorkData;
  let CrewData = MediaData.crew;
  let CastData = MediaData.cast;
  if(personJob == "Acting") GeneraleWorkData = [...CastData,...CrewData];
  else  GeneraleWorkData = [...CrewData,...CastData];

  insertMediaElements(GeneraleWorkData,MediaSuggestions,undefined,LibraryInformation);
}

MediaSuggestions.innerHTML ="";

(async () => {
  const apiKey = await window.electronAPI.getAPIKEY();
  getPersonInfo(apiKey,personId)
})();

setupKeyPressesHandler();
loadIconsDynamically();
handlingMiddleRightDivResizing();
let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});

