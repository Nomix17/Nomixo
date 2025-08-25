let data = new URLSearchParams(window.location.search);
let personId = data.get("personId");
let MediaSuggestions = document.getElementById("div-MediaSuggestions")

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
function fetchData(apiKey,personId, personjob){
  fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}`).then(res=>res.json())
    .then(MediaData => insertDataIntoDiv(MediaData, personjob));
}

function insertDataIntoDiv(MediaData, personJob){
  let tempArray=[];
  let GeneraleWorkData;
  let CrewData = MediaData.crew;
  let CastData = MediaData.cast;
  if(personJob == "Acting") GeneraleWorkData = [...CastData,...CrewData];
  else  GeneraleWorkData = [...CrewData,...CastData];


  GeneraleWorkData.forEach(obj => {
    let Id = "Unknown";
    let Title = "Unknown";
    let Adult = "Unknown";
    let PosterPath = "Unknown";
    let MediaType = "Unknown";
    if(obj.hasOwnProperty("id")) Id = obj["id"];
    
    if(obj.hasOwnProperty("title")) Title = obj["title"];
    else Title = obj["name"];

    if(!tempArray.includes(Title)){
      tempArray.push(Title); 

      if(obj.hasOwnProperty("adult")) Adult = obj["adult"];
     
      if(obj.hasOwnProperty("poster_path") && obj["poster_path"] != null) PosterPath = "https://image.tmdb.org/t/p/w500/"+obj["poster_path"];
      else PosterPath = "../cache/PosterNotFound.png"

      if(obj.hasOwnProperty("media_type") && obj["media_type"] != null) MediaType = obj["media_type"];
      
      let movieDomElement = document.createElement("div");
      let moviePosterElement = document.createElement("img");
      let movieNameElement = document.createElement("p");

      movieNameElement.innerText = Title;
      moviePosterElement.src = PosterPath;
      
      movieDomElement.classList.add("div-MovieElement");
      moviePosterElement.classList.add("img-MoviePoster");
      movieNameElement.classList.add("parag-MovieTitle");

      movieDomElement.appendChild(moviePosterElement);
      movieDomElement.appendChild(movieNameElement); 

      movieDomElement.addEventListener("click",function() {openDetailPage(Id,MediaType)});
      MediaSuggestions.append(movieDomElement);
    }
  });
}


// on click functions
function backToHome(){
  path = "./home/mainPage.html"
  window.electronAPI.navigateTo(path);
}

function openSearchPage(){
  let searchKeyword = document.getElementById("input-searchForMovie").value;
  path = "./search/searchPage.html?search="+searchKeyword;
  if(searchKeyword !="") window.electronAPI.navigateTo(path);
}

function openDetailPage(movieId,MediaType){
  path = "./movieDetail/movieDetail.html?MovieId="+movieId+"&MediaType="+MediaType;
  window.electronAPI.navigateTo(path);
}

MediaSuggestions.innerHTML ="";

(async () => {
  const apiKey = await window.electronAPI.getAPIKEY();
  getPersonInfo(apiKey,personId)
})();

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

let searchInput = document.getElementById("input-searchForMovie");
searchInput.addEventListener("keypress",(event)=>{
  if(event.key == "Enter") openSearchPage();
});


function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function goBack(){
  window.electronAPI.goBack();
}

function openDiscoveryPage(genreId, MediaType){
  path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}

function OpenSettingsPage(){
  path = "./settingsPage/settingsPage.html"
  window.electronAPI.navigateTo(path);
}

function OpenLibaryPage(){
  path = "./libraryPage/libraryPage.html";
  window.electronAPI.navigateTo(path);
}
