const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");
const apiKey = "api_Key";
var backgroundImage;

let TorrentContainer = document.getElementById("div-movieMedias");
TorrentContainer.classList.add("preloadingTorrent");
//load Movie information
fetch(`https://api.themoviedb.org/3/${MediaType}/${movieId}?api_key=${apiKey}`)
  .then(res=>res.json())  
  .then(data =>{
    insertMovieElements(data);
    let ReleaseYear;
    let Title;
    if(data.hasOwnProperty("release_date")) ReleaseYear = new Date(data["release_date"]).getFullYear();
    else ReleaseYear = new Date(data["first_air_date"]).getFullYear();
    if(data.hasOwnProperty("title"))  Title = data["title"]+" "+ReleaseYear;
    else Title = data["name"]+" "+ReleaseYear;
    Title = Title.replaceAll(" ","%20");
    fetchTorrent(Title); 
  })
  .catch(error => console.log(error));

// load Cast and Crew information
fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${apiKey}`)
  .then(res => res.json())
  .then(data => insertCastElements(data))
  .catch(err =>{
    console.log(err);
});

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

async function fetchTorrent(Title){
  let pageNum = 1;
  let continueLoop = true;
    while(continueLoop ){
      try{
        const torrentRes = await fetch(`https://torrent-api-py-nx0x.onrender.com/api/v1/search?site=piratebay&query=${Title}&page=${pageNum}`)
        const torrentData = await torrentRes.json();
        if(torrentData.hasOwnProperty("error")) throw new Error(torrentData["error"]);
        insertTorrentInfoElement(torrentData)
        pageNum++;
      }catch(err){
        if(err == "TypeError: TorrentResutls is undefined"){
          if(pageNum == 0){ 
            let TorrentContainer = document.getElementById("div-movieMedias");
            let noResultsFoundedElement = document.createElement("img");
            TorrentContainer.innerHTML ="";
            noResultsFoundedElement.src = "../cache/NoResultsFound.png";
            noResultsFoundedElement.style = "padding:100px;width:300px; background-color:rgba(0,0,0,0%);";
            TorrentContainer.style = "display:flex;justify-content:center;align-items:center;";
            TorrentContainer.appendChild(noResultsFoundedElement);
            console.log("no stream was found");
          }
        }
        continueLoop = false;
        console.log(err);
        console.log("Pages Fetched: "+pageNum);
      }
  }
}

function insertMovieElements(data){
  let Title = "Unknown";
  let Duration = "Unknown";
  let ReleaseYear = "Unknown";
  let Rating = "Unknown";
  let Adult = "Unknown";
  let Genres = [{name:"Unknown", id:"Unknown"}];
  let Summary = "Unknown";
  backgroundImage = "Unknown";

  if(data.hasOwnProperty("title"))  Title = data["title"];
  else Title = data["name"];
  if(data.hasOwnProperty("runtime")) Duration = data["runtime"]+" min";
  else Duration = "TV Show";
  if(data.hasOwnProperty("release_date")) ReleaseYear = new Date(data["release_date"]).getFullYear();
  else ReleaseYear = new Date(data["first_air_date"]).getFullYear();
  if(data.hasOwnProperty("vote_average")) Rating = parseFloat(data["vote_average"]).toFixed(1);
  if(data.hasOwnProperty("adult")) Adult = data["adult"];
  if(data.hasOwnProperty("genres")) Genres = data["genres"].map(element => element = {name: element["name"],id: element["id"]});
  if(data.hasOwnProperty("overview")) Summary = data["overview"];
  if(data.hasOwnProperty("backdrop_path")) backgroundImage = "https://image.tmdb.org/t/p/original/"+data["backdrop_path"];
  document.title = Title;

  document.getElementById("h1-MovieTitle").innerText = Title;
  document.getElementById("p-movieDuration").innerText = Duration;
  document.getElementById("p-movieYearOfRelease").innerText = ReleaseYear;
  document.getElementById("p-movieRating").innerText = Rating;
  document.getElementById("p-summaryParagraph").innerText = Summary;


  let DivGenresContainer = document.getElementById("div-genresInfos");
  Genres.forEach(element=>{
    let newGenreElement = document.createElement("button");
    newGenreElement.onclick = ()=>{openDiscoveryPage(element.id,MediaType)};
    newGenreElement.classList.add("btn-MovieDetailsButtons");
    newGenreElement.innerText = element.name;
    DivGenresContainer.append(newGenreElement);
  });
   
  document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${backgroundImage}')`;
  document.documentElement.style.backgroundRepeat = `no-repeat`;
  document.documentElement.style.backgroundPosition = `center center`;
  document.documentElement.style.backgroundSize = `cover`;
  document.documentElement.style.backgroundAttachment = `fixed`;

}

function insertCastElements(data){
    if(data.success == false) throw new Error("No Information about the Crew Founded.");
    let Crew = data.crew;
    let Cast = data.cast;

    let DirectorsObjects = ["Unknown"];
    let MainCastObjects = ["Unknown"];

    if(Crew[0].hasOwnProperty("job")) DirectorsObjects = Crew.filter(element => element.job=="Director");
    if(Cast[0].hasOwnProperty("name")) MainCastObjects = Cast.slice(0,5);

    let divCastElement = document.getElementById("div-castInfos");
    let divDirectoryElement = document.getElementById("div-directorInfos");
    
    DirectorsObjects.forEach(directorObject=>{
       let newDirectorElement = document.createElement("button");
       newDirectorElement.onclick = ()=>{openProfilePage(directorObject.id)};
       newDirectorElement.classList.add("btn-MovieDetailsButtons");
       newDirectorElement.innerText = directorObject.name;
       divDirectoryElement.append(newDirectorElement);
    });

    MainCastObjects.forEach(castObject=>{
       let newCastElement = document.createElement("button");
       newCastElement.onclick = ()=>{openProfilePage(castObject.id)};
       newCastElement.classList.add("btn-MovieDetailsButtons");
       newCastElement.innerText = castObject.name;
       divCastElement.append(newCastElement);
    });
}

function insertTorrentInfoElement(data){
    let TorrentResutls = data.data;
    TorrentContainer.innerHTML ="";
    TorrentResutls.forEach(element => {
      let FullName = element.name;
      let Categorie = element.category;

      let Resolution =
        Categorie.includes("CAM") ? "CAM" :
        FullName.includes("CAM") ? "CAM" :
        FullName.includes("2160p") ? "4k" :
        FullName.includes("1080p") ? "1080p" :
        FullName.includes("720p") ? "720p" :
        Categorie.includes("UHD/4k") ? "4k" :
        Categorie.includes("HD") ? "1080p" :
        Categorie.includes("720p") ? "720p":
        "?p";

      FullName = FullName.length > 35 ?FullName.slice(0,45):FullName

      let Size = element.size;
      let SeedersNumber = element.seeders;
      let MagnetLink = element.magnet;
      
      let TorrentElement = document.createElement("div");
      TorrentElement.id = "div-TorrentMedia";
      TorrentElement.innerHTML = `
        <div style="   flex: 0 0 50px;  display: flex; justify-content: center;align-items: center; " class="div-MediaQuality"><p style="padding-right: 0px">${Resolution}</p></div>
        <div style="  flex: 1 1 auto; "  class="div-MediaDescription">
          <p>${FullName+"..."}</a><br>
          <p><img id="img-seedImage" src="../cache/icons/seeds.png"></img>${SeedersNumber}</p>
          <p><img id="img-storageImage" src="../cache/icons/storage.png">${Size}</p>
        </div>
      `;
      TorrentElement.addEventListener("click",()=>{openMediaVideo(MagnetLink)});
      TorrentContainer.append(TorrentElement);
    });
      TorrentContainer.classList.remove("preloadingTorrent");
}


function openDiscoveryPage(genreId, MediaType){
  let path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}
function openProfilePage(personId){
  let path = `./personDetails/personDetails.html?personId=${personId}`;
  window.electronAPI.navigateTo(path);

}
function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function goBack(){
  window.electronAPI.goBack();
}

function openMediaVideo(MagnetLink){
  let b64MagnetLink = btoa(MagnetLink);
  let path = `./videoPlayer/videoPlayer.html?MagnetLink=${b64MagnetLink}&bgPath=${backgroundImage}`;
  window.electronAPI.navigateTo(path); 
}

