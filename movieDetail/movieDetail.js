const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");
var backgroundImage;
let Title;

let TorrentContainer = document.getElementById("div-movieMedias");
let SerieEpisode = document.getElementById("div-serieEpisodes");

TorrentContainer.classList.add("preloadingTorrent");

let selectElement = document.getElementById("select-Seasons");

let serieEpisodeloadingDiv = document.getElementById("div-serieEpisodes-LoadingGif");
let movieMediaLoadingDiv = document.getElementById("div-movieMedias-LoadingGif");

let addToLibraryButton = document.getElementById("bookmarkbtn");

let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.log(err)}},100);


let seasonsDivArray = [];

async function fetchInformation(){
  const apiKey = await window.electronAPI.getAPIKEY();
  loadMovieInformation(apiKey);
  loadCastInformation(apiKey);
}

function loadMovieInformation(apiKey){
  //load Movie information
  let MediaTypeForSearch = MediaType == "anime" ? "tv" :MediaType;
  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}?api_key=${apiKey}`)
    .then(res=>res.json())  
    .then(data =>{
      insertMovieElements(data,apiKey);
      let ReleaseYear;
      Title;
      if(data.hasOwnProperty("release_date")) ReleaseYear = new Date(data["release_date"]).getFullYear();
      else ReleaseYear = new Date(data["first_air_date"]).getFullYear();
      if(data.hasOwnProperty("title"))  Title = data["title"]+" "+ReleaseYear;
      else Title = data["name"]+" "+ReleaseYear;
      Title = Title.replaceAll(" ","%20");
      if(MediaType == "movie")
        return fetchTorrent(Title); 
      else
        return "";
    })
    .catch(error => console.log(error));
}

function loadCastInformation(apiKey){
  // load Cast and Crew information
  let MediaTypeForSearch = MediaType == "anime" ? "tv" :MediaType;
  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/credits?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => insertCastElements(data))
    .catch(err =>{
      console.log(err);
  });
}

function loadEpisodes(apiKey,series_id,season_number,title){
  // serieEpisodeDiv.remove();
  fetch(`https://api.themoviedb.org/3/tv/${series_id}/season/${season_number}?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => insertEpisodesElements(data,title))
    .then(() =>{displayEpisodes(1)})
    .catch(err =>{
      SerieEpisode.innerHTML = "";
      let NothingWasFound = document.createElement("span");
      NothingWasFound.innerHTML = "No Results Were Found !";
      SerieEpisode.style.display = "flex";
      SerieEpisode.appendChild(NothingWasFound);
    });
}

function insertEpisodesElements(data,title){
  let SeasonDiv = document.createElement("div");
  SeasonDiv.style.backgroundColor = "rgba(0,0,0,0)";
  let episodes = data.episodes;
  episodes.forEach(episode =>{
    SeasonDiv.setAttribute("season_number",episode.season_number);
    let EpisodeElement = document.createElement("div");
    EpisodeElement.className = "div-episodes-Element";
    EpisodeElement.innerHTML += `
       <h4>${episode.episode_number}</h4>
       <img style="height:70px;" src="https://image.tmdb.org/t/p/w342/${episode.still_path}"></img>
       <div style="max-width:50%;width: fit-content; " class="div-episode-information">
         <p style="font-size:15px;">${episode.name}</p>
         <p style="font-weight:bold;font-size:11px;margin-top:20px;">${episode.air_date}</p>
       </div>
     `
    EpisodeElement.addEventListener("mouseenter",()=>{
      EpisodeElement.style.backgroundColor = "rgba(255, 255, 255, 10%)";
    });

    EpisodeElement.addEventListener("mouseleave",()=>{
      if(EpisodeElement.style.borderColor != "rgba(var(--MovieElement-hover-BorderColor), 100%)")
        EpisodeElement.style.backgroundColor = "rgba(0,0,0,0)";
    });
    EpisodeElement.addEventListener("click",() => {
      let EpisodeElements = SeasonDiv.querySelectorAll('div[class="div-episodes-Element"');
      EpisodeElements.forEach(element =>{
        if(element != EpisodeElement){
          element.style.borderColor = "rgba(0,0,0,0)";
          element.style.backgroundColor = "rgba(0,0,0,0)";
        }else{
          element.style.borderColor = "rgba(var(--MovieElement-hover-BorderColor), 100%)";
          element.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        }
      });


      let seasonNumber = String(episode.season_number).padStart(2,"0");
      let episodeNumber = String(episode.episode_number).padStart(2,"0");
      let episodeName = episode.name;

      let searchQuery = `${title} S${seasonNumber}E${episodeNumber}`;
      try{
        fetchTorrent(searchQuery);
        TorrentContainer.style.display = "flex";
        TorrentContainer.style.borderRadius = "0px";
        TorrentContainer.innerHTML = `
          <div class="img-movieMedias-LoadingGif" class="loader">
              <div class="dot dot1"></div>
              <div class="dot dot2"></div>
              <div class="dot dot3"></div>
              <div class="dot dot4"></div>
          </div>`
      }catch(error){
        error => console.log(error)
      }
    });
    SeasonDiv.appendChild(EpisodeElement);
    seasonsDivArray.push(SeasonDiv);
  });
  return "";
}


async function fetchTorrent(Title){
  let pageNum = 1;
  let continueLoop = true;
    while(continueLoop ){
      try{
        const torrentRes = await fetch(`https://torrent-api-py-nx0x.onrender.com/api/v1/search?site=piratebay&query=${Title}&page=${pageNum}`)
        const torrentData = await torrentRes.json();
        if (pageNum == 1) TorrentContainer.innerHTML ="";
        if(torrentData.hasOwnProperty("error")) throw new Error("No Results Were Found !");
        insertTorrentInfoElement(torrentData)
        pageNum++;
      }catch(err){
        if(pageNum == 1 || err.message == "No Useful Results Were found !"){ 
          TorrentContainer.innerHTML = "";
          let NothingWasFound = document.createElement("span");
          NothingWasFound.innerHTML = err.message;
          NothingWasFound.style.backgroundColor = "rgba(0,0,0,0)";
          TorrentContainer.appendChild(NothingWasFound);
          console.error(err);
        }
        continueLoop = false;
        console.log("Pages Fetched: "+pageNum);
        console.log(err);
      }
  }
}


function insertMovieElements(data,apiKey){
  let Title = "Unknown";
  let Duration = "Unknown";
  let ReleaseYear = "Unknown";
  let Rating = "Unknown";
  let Adult = "Unknown";
  let Genres = [{name:"Unknown", id:"Unknown"}];
  let Summary = "Unknown";
  let Seasons = 0;
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
  if(data.hasOwnProperty("seasons")) Seasons = data["seasons"];


  if(backgroundImage != "https://image.tmdb.org/t/p/original/null"){
    document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${backgroundImage}')`;
    document.documentElement.style.backgroundRepeat = `no-repeat`;
    document.documentElement.style.backgroundPosition = `center center`;
    document.documentElement.style.backgroundSize = `cover`;
    document.documentElement.style.backgroundAttachment = `fixed`;
  }

  if(Seasons){
    SerieEpisode.style.display = "flex";
    Seasons.forEach(season =>{
      let name = season.name;
      let seasonNumber = season.season_number;
      let newOption = document.createElement("option");
      newOption.value = seasonNumber;
      newOption.innerText = name;
      selectElement.appendChild(newOption); 
      loadEpisodes(apiKey,movieId,seasonNumber,Title);
    });
    SerieEpisode.appendChild(selectElement);
    selectElement.addEventListener("change",()=>{
      displayEpisodes(selectElement.value);
    });
  }else{
    TorrentContainer.style.display = "flex";
  }
  selectElement.style.display = "none";

  document.title = Title;

  document.getElementById("h1-MovieTitle").innerText = Title;
  document.getElementById("p-movieDuration").innerText = Duration;
  document.getElementById("p-movieYearOfRelease").innerText = ReleaseYear;
  document.getElementById("p-movieRating").innerText = Rating;
  document.getElementById("p-summaryParagraph").innerText = Summary;

  if(Duration == "TV Show") TorrentContainer.style.display = "none";
  else SerieEpisode.style.display = "none";

  globalLoadingGif.remove();

  let DivGenresContainer = document.getElementById("div-genresInfos");
  Genres.forEach(element=>{
    let newGenreElement = document.createElement("button");
    newGenreElement.onclick = ()=>{openDiscoveryPage(element.id,MediaType)};
    newGenreElement.classList.add("btn-MovieDetailsButtons");
    newGenreElement.innerText = element.name;
    DivGenresContainer.append(newGenreElement);
  });

    document.getElementById("div-main").style.opacity = "1";

}

function insertCastElements(data){
    if(data.success == false) throw new Error("No Information about the Crew Founded.");
    let Crew = data.crew;
    let Cast = data.cast;

    let DirectorsObjects = ["Unknown"];
    let MainCastObjects = ["Unknown"];

    if(Crew[0].hasOwnProperty("job") || Crew[0].hasOwnProperty("known_for_department")){
      DirectorsObjects = Crew.filter(element => element.job=="Director" && element.known_for_department=="Directing");
      if(DirectorsObjects.lenght){
        DirectorsObjects = Crew.filter(element => element.job=="Director" || element.known_for_department=="Directing");
      }
    }

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
    if(divDirectoryElement.innerHTML.trim() == "<h2>Director</h2>") divDirectoryElement.remove();
}

function insertTorrentInfoElement(data){
    let TorrentResutls = data.data;
    TorrentResutls.forEach(element => {
      let FullName = element.name;
      let Categorie = element.category;
      let Size = element.size;
      
      if(!Size.includes("GiB")){
        if(!Size.includes("MiB")) return;
        if(parseInt(Size.split("MiB")[0]) < 500) return
      }
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
  
      let SeedersNumber = element.seeders;
      let MagnetLink = element.magnet;
      if(parseInt(SeedersNumber)){
        let TorrentElement = document.createElement("div");
        TorrentElement.id = "div-TorrentMedia";
        TorrentElement.innerHTML = `
          <div style="" class="div-MediaQuality"><p style="font-size:15px;padding-right: 0px">${Resolution}</p></div>
          <div style="max-width:80%;width: fit-content;"  class="div-MediaDescription">
            <p style="padding:0px 10px 10px 0px;">${FullName}</p>
            <p style="font-size:13px;">
              <img id="img-storageImage" src="../cache/icons/storage.png"/> ${Size} &ensp;
              <img id="img-seedImage" src="../cache/icons/seeds.png"/> ${SeedersNumber} 
            </p>
          </div>
        `;
        TorrentElement.addEventListener("click",()=>{openMediaVideo(movieId,MagnetLink)});
        TorrentContainer.append(TorrentElement);
      }
    });
    TorrentContainer.classList.remove("preloadingTorrent");
    if(TorrentContainer.innerHTML.trim() == "") throw new Error("No Useful Results Were found !");
    TorrentContainer.style.display = "block";
}

function displayEpisodes(seasonNumber){
  selectElement.style.display = "flex";
  SerieEpisode.style.display = "block";
  SerieEpisode.innerHTML = "";
  let seasonIndex = seasonNumber;
  let currentSeasonDiv = seasonsDivArray.find(div => div.getAttribute("season_number") == seasonIndex);
  selectElement.value = seasonIndex;
  SerieEpisode.appendChild(selectElement);
  SerieEpisode.appendChild(currentSeasonDiv);
}
loadMediaEntryPointLibraryInfo();
fetchInformation();

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

resizeTorrentAndEpisodeElement(0.3);
window.addEventListener("resize",(event)=>{
  resizeTorrentAndEpisodeElement(0.3);
});


function resizeTorrentAndEpisodeElement(radio){
  SerieEpisode.style.maxWidth = window.innerWidth*radio+"px";
  SerieEpisode.style.minWidth = window.innerWidth*radio+"px";
  TorrentContainer.style.maxWidth = window.innerWidth*radio+"px";
  TorrentContainer.style.minWidth = window.innerWidth*radio+"px";
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

function openMediaVideo(movieId,MagnetLink){
  let b64MagnetLink = btoa(MagnetLink);
  let path = `./videoPlayer/videoPlayer.html?MagnetLink=${b64MagnetLink}&id=${movieId}&bgPath=${backgroundImage}`;
  window.electronAPI.navigateTo(path); 
}

function setAddToLibraryButtonToPressed(){
  addToLibraryButton.innerHTML = `<svg id="bookmarkicon" style="margin-left:3px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                  <path d="M64 0C28.7 0 0 28.7 0 64L0 480c0 11.5 6.2 22.2 16.2 27.8s22.3 5.5 32.2-.4L192 421.3 335.5 507.4c9.9 5.9 22.2 6.1 32.2 .4S384 491.5 384 480l0-416c0-35.3-28.7-64-64-64L64 0z"/>
                                </svg>Saved !
`
    addToLibraryButton.setAttribute("pressed"," ");
}

function setAddToLibraryButtonToNormal(){
  addToLibraryButton.innerHTML =`<svg id="bookmarkicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                    <use href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/svgs/regular/bookmark.svg"></use>
                                  </svg>Save To Library`
    addToLibraryButton.removeAttribute("pressed");
}

function addMediaToLibrary(){
  let mediaLibraryEntryPointObject = formatMediaLibraryObject()
  if(!addToLibraryButton.hasAttribute("pressed")){
    window.electronAPI.addMediaToLibrary(mediaLibraryEntryPointObject);
    setAddToLibraryButtonToPressed();
  }else{
    window.electronAPI.removeMediaFromLibrary(mediaLibraryEntryPointObject);
    setAddToLibraryButtonToNormal();
  }
}

function formatMediaLibraryObject(){
  let MediaLibraryObject = {
    MediaId:movieId,
    MediaType:MediaType,
    episodesWatched:[],
    lastPlaybackPosition:0,
    timeWatched:0
  }
  return MediaLibraryObject;
}

async function loadMediaEntryPointLibraryInfo(){
  let MediaLibraryInfo = await window.electronAPI.loadMediaLibraryInfo({MediaId:movieId, MediaType:MediaType})
    .catch((err)=>{
      console.error(err);
      return null;
    });
  if(MediaLibraryInfo){
    setAddToLibraryButtonToPressed();
  }
}
