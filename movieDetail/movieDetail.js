const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");

var backgroundImage;
let IMDB_ID;

let TorrentContainer = document.getElementById("div-movieMedias");
let SerieEpisode = document.getElementById("div-serieEpisodes");

TorrentContainer.classList.add("preloadingTorrent");

let selectElement = document.getElementById("select-Seasons");

let serieEpisodeloadingDiv = document.getElementById("div-serieEpisodes-LoadingGif");
let movieMediaLoadingDiv = document.getElementById("div-movieMedias-LoadingGif");

let divCastElement = document.getElementById("div-castInfos");
let divDirectoryElement = document.getElementById("div-directorInfos");

let addToLibraryButton = document.getElementById("bookmarkbtn");

let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.error(err)}},100);


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
      if(MediaType == "movie")
        return fetchTorrent(apiKey,movieId,MediaType); 
    })
    .catch(error => console.error(error));
}

function loadCastInformation(apiKey){
  // load Cast and Crew information
  let MediaTypeForSearch = MediaType == "anime" ? "tv" :MediaType;
  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/credits?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => insertCastElements(data))
    .catch(err =>{
      noInfoFounded();
      console.error(err);
  });
}

function noInfoFounded(){
  divCastElement.innerHTML += '<p class="infoText">No Cast information were Found</p>';
  divDirectoryElement.innerHTML += '<p class="infoText">No Directors information were Found</p>';
}

async function loadEpisodes(apiKey,series_id,season_number,title){
  let libraryInfo = await loadMediaEntryPointLibraryInfo();
  fetch(`https://api.themoviedb.org/3/tv/${series_id}/season/${season_number}?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => insertEpisodesElements(apiKey,data,title,libraryInfo?.[0]))
    .then(() =>{displayEpisodes(1)})
    .catch(err =>{
      SerieEpisode.innerHTML = "";
      let NothingWasFound = document.createElement("span");
      NothingWasFound.innerHTML = "No Results Were Found !";
      SerieEpisode.style.display = "flex";
      SerieEpisode.appendChild(NothingWasFound);
    });
}

function insertEpisodesElements(apiKey,data,title,libraryInfo){
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
     `;


    let continueWatchingEpisode = (libraryInfo?.typeOfSave?.includes("Currently Watching") &&
      episode.season_number == libraryInfo["seasonNumber"] &&
      episode.episode_number == libraryInfo["episodeNumber"]);

    if(continueWatchingEpisode){
      EpisodeElement.style.backgroundColor = "rgba(255, 255, 255, 10%)";
      insertContinueWatchingButton(EpisodeElement,libraryInfo);
    }

    EpisodeElement.addEventListener("mouseenter",()=>{
      EpisodeElement.style.backgroundColor = "rgba(255, 255, 255, 10%)";
    });

    EpisodeElement.addEventListener("mouseleave",()=>{
      if(EpisodeElement.style.borderColor != "rgba(var(--MovieElement-hover-BorderColor), 100%)" && (!continueWatchingEpisode))
        EpisodeElement.style.backgroundColor = "rgba(0,0,0,0)";
    });

    EpisodeElement.addEventListener("click",() => {
      continueWatchingEpisode=false;
      let EpisodeElements = SeasonDiv.querySelectorAll('div[class="div-episodes-Element"]');
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

      let episodeInfo = {seasonNumber:seasonNumber,episodeNumber:episodeNumber}
      try{
        fetchTorrent(apiKey,movieId,MediaType,episodeInfo);
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
        console.error(error)
      }
    });
    SeasonDiv.appendChild(EpisodeElement);
    seasonsDivArray.push(SeasonDiv);
  });
  return "";
}

async function fetchTorrent(apiKey,MediaId,MediaType,episodeInfo={}){
  let MediaTypeForSearch = MediaType == "anime" ? "tv" :MediaType;
  let libraryInfo = await loadMediaEntryPointLibraryInfo();
  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/external_ids?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      IMDB_ID = data.imdb_id;
      let fetchUrl;
      if(MediaTypeForSearch == "tv")
        fetchUrl = `https://torrentio.strem.fun/stream/series/${IMDB_ID}:${episodeInfo.seasonNumber}:${episodeInfo.episodeNumber}.json`;
      else
        fetchUrl = `https://torrentio.strem.fun/stream/movie/${IMDB_ID}.json`;

      fetch(fetchUrl)
        .then(res=>res.json())  
        .then(data => insertTorrentInfoElement(data,MediaId,MediaTypeForSearch,libraryInfo?.[0],episodeInfo))

        .catch(error =>{
          TorrentContainer.innerHTML = "";
          let NothingWasFound = document.createElement("span");
          NothingWasFound.innerHTML = error.message;
          NothingWasFound.style.backgroundColor = "rgba(0,0,0,0)";
          TorrentContainer.appendChild(NothingWasFound);
          console.error(error);
        });
    });
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

    if(!MainCastObjects.length) divCastElement.innerHTML += '<p class="infoText">No Cast information were Found</p>';
    if(!DirectorsObjects.length) divDirectoryElement.innerHTML += '<p class="infoText">No Directors information were Found</p>';

    if(divDirectoryElement.innerHTML.trim() == "<h2>Director</h2>") divDirectoryElement.remove();
}

function insertTorrentInfoElement(data,MediaId,MediaType,MediaLibraryInfo,episodeInfo={}){
    TorrentContainer.innerHTML = "";
    let TorrentResutls = data.streams;
    TorrentResutls.forEach(element => {
      let FullTitle = element.title;
      let Title = FullTitle.split("👤")[0].split("\n")[0];
      let Quality = element.name.split("Torrentio")[1];
      let Hash = element.infoHash;
      let SeedersNumber = FullTitle.split("👤")[1].split("💾")[0];
      let Size = FullTitle.split("💾")[1].split("⚙️")[0];
      let fileName = element?.behaviorHints?.filename || "";
      let MagnetLink = `magnet:?xt=urn:btih:${Hash}`

      if(parseInt(SeedersNumber) && !fileName.endsWith('.mkv')){
        let TorrentElement = document.createElement("div");
        TorrentElement.id = "div-TorrentMedia";
        TorrentElement.style.marginBottom = "5px";
        TorrentElement.innerHTML = `
          <div style="" class="div-MediaQuality"><p style="font-size:15px;padding-right: 0px">${Quality}</p></div>
          <div style="max-width:80%;width: fit-content;"  class="div-MediaDescription">
            <p style="padding:0px 10px 10px 0px;">${Title}</p>
            <div style="display:flex;justify-content:flex-start;align-items:center;flex-direction:row;font-size:13px;">
              <div id="div-storageImage"></div> ${Size} &ensp;
              <div id="div-seedImage"></div> ${SeedersNumber} 
            </div>
          </div>
        `;
        
        TorrentElement.addEventListener("click",()=>{
          openMediaVideo(MediaId,MediaType,MagnetLink,IMDB_ID,backgroundImage,episodeInfo);
        });
        
        if(MediaLibraryInfo?.typeOfSave?.includes("Currently Watching") &&
          String(MagnetLink) == String(MediaLibraryInfo["Magnet"]) &&
          String(episodeInfo.seasonNumber) == String(MediaLibraryInfo["seasonNumber"]) &&
          String(episodeInfo.episodeNumber) == String(MediaLibraryInfo["episodeNumber"]))
            insertContinueWatchingButton(TorrentElement,MediaLibraryInfo)

        TorrentContainer.append(TorrentElement);
      }
    });
    TorrentContainer.classList.remove("preloadingTorrent");
    if(TorrentContainer.innerHTML.trim() == "") throw new Error("No Useful Results Were found !");
    TorrentContainer.style.display = "block";
    loadIconsDynamically();
}

function insertContinueWatchingButton(container,MediaLibraryInfo){
  let continueVideoButton = document.createElement("button");
  continueVideoButton.classList.add("continue-video-button");

  fetch('../cache/icons/playVideo.svg')
    .then(response => response.text())
    .then(svgText => {
      continueVideoButton.innerHTML = svgText;
      addContrastForPlayIcon();
    })
  .catch(err=>{
    console.error(err.message);
  });

  let episodeInfo = {"seasonNumber":MediaLibraryInfo.seasonNumber, "episodeNumber":MediaLibraryInfo.episodeNumber}

  continueVideoButton.addEventListener("click",()=>{
    openMediaVideo(MediaLibraryInfo.MediaId, MediaLibraryInfo.MediaType, MediaLibraryInfo.Magnet,MediaLibraryInfo.mediaImdbId,MediaLibraryInfo.bgImagePath,episodeInfo);
    event.preventDefault();
    event.stopPropagation();
  });

  container.appendChild(continueVideoButton);
  container.style.backgroundColor ="rgba(255, 255, 255, 10%)";
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

setupKeyPressesHandler();
handleLibraryButton()
fetchInformation();

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

function openProfilePage(personId){
  let path = `./personDetails/personDetails.html?personId=${personId}`;
  window.electronAPI.navigateTo(path);
}

function addMediaToLibrary(){
  ToggleInLibrary(movieId,MediaType,"Watch Later");
  if(addToLibraryButton.hasAttribute("pressed")){
    setAddToLibraryButtonToPressed(addToLibraryButton);
    addToLibraryButton.innerHTML+="Saved!";
  }else{
    setAddToLibraryButtonToNormal(addToLibraryButton);
    addToLibraryButton.innerHTML+="Save To Library";
  }
}

function formatMediaLibraryObject(){
  let MediaLibraryObject = {
    MediaId:movieId,
    MediaType:MediaType,
    episodesWatched:[],
    lastPlaybackPosition:0,
    typeOfSave:"WatchLater"
  }
  return MediaLibraryObject;
}

async function loadMediaEntryPointLibraryInfo(){
  let MediaLibraryInfo = await window.electronAPI.loadMediaLibraryInfo({MediaId:movieId, MediaType:MediaType})
    .catch((err)=>{
      console.error(err);
      return [];
    });
  return MediaLibraryInfo;
}

async function handleLibraryButton(){
  let MediaLibraryInfo = await loadMediaEntryPointLibraryInfo();
  if(MediaLibraryInfo?.[0]["typeOfSave"]?.includes("Watch Later")){
    setAddToLibraryButtonToPressed(addToLibraryButton);
    addToLibraryButton.innerHTML+="Saved!";
  }
}

