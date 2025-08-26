let data = new URLSearchParams(window.location.search);
let personId = data.get("personId");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")

let LibraryInformation;

setTimeout(()=>{
  document.body.style.opacity = "1";
},80);

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
    let personProfileElement = document.getElementById("img-personProfilePic");
    let personDepartmentElement = document.getElementById("para-personDepartment");
    let personBioElement = document.getElementById("para-personBiography");
     

    if(Biography.length > 576){
      let OldBiography = Biography;
      Biography = Biography.slice(0,573)+"...";
      let readMoreElement = document.createElement("a");
      readMoreElement.style.color = "grey";
      readMoreElement.addEventListener("click",()=>{personBioElement.innerHTML = OldBiography});
      readMoreElement.innerText = "read more";
      personBioElement.append(readMoreElement);
    }

    personNameElement.innerText = Name;
    personProfileElement.src = ProfilePic == null?"../cache/ProfileNotFound.png":"https://image.tmdb.org/t/p/w500/"+ProfilePic;
    personDepartmentElement.innerText = "Department : "+Department;
    personBioElement.prepend(Biography+" ");
    fetchData(apiKey,personId,Department); 
  });
}
async function fetchData(apiKey,personId, personjob){
  LibraryInformation = await loadLibraryInfo();
  fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}`).then(res=>res.json())
    .then(MediaData => insertDataIntoDiv(MediaData, personjob,LibraryInformation));
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

let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});

