const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");

var backgroundImage;
let IMDB_ID;

let TorrentContainer = document.getElementById("div-TorrentContainer");
let SerieContainer = document.getElementById("div-serieEpisodes");

let TorrentMagnetContainer = document.getElementById("div-movieMedias");
let EpisodesContainer = document.getElementById("EpisodesContainer");

TorrentMagnetContainer.classList.add("preloadingTorrent");

let selectSeasonContainer = document.querySelector(".selectSeason-container");
let selectElement = document.getElementById("select-Seasons");
let toggleTorrentContainer = document.querySelector(".toggleButton");

let serieEpisodeloadingDiv = document.getElementById("div-serieEpisodes-LoadingGif");
let movieMediaLoadingDiv = document.getElementById("div-movieMedias-LoadingGif");

let divCastElement = document.getElementById("div-castInfos");
let divDirectoryElement = document.getElementById("div-directorInfos");

let addToLibraryButton = document.getElementById("bookmarkbtn");

let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.error(err)}},100);

EpisodesContainer.style.cursor = 'default';

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
      console.error(err.message);
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
      console.error(err.message)
      EpisodesContainer.innerHTML = "";
      let NothingWasFound = document.createElement("span");
      NothingWasFound.innerHTML = "No Results Were Found !";
      SerieContainer.style.display = "flex";
      EpisodesContainer.appendChild(NothingWasFound);
    });
}

function insertEpisodesElements(apiKey,data,title,libraryInfo){
  let SeasonDiv = document.createElement("div");
  SeasonDiv.style.backgroundColor = "rgba(0,0,0,0)";
  SeasonDiv.id = "main-SeasonDiv";
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
      handleEpisodeElementColoring(SeasonDiv,EpisodeElement)


      let seasonNumber = String(episode.season_number).padStart(2,"0");
      let episodeNumber = String(episode.episode_number).padStart(2,"0");
      let episodeName = episode.name;

      let episodeInfo = {seasonNumber:seasonNumber,episodeNumber:episodeNumber}
      try{
        TorrentContainer.style.display = "flex";
        TorrentContainer.style.borderRadius = "0px";

        TorrentMagnetContainer.style.display = "flex";
        TorrentMagnetContainer.style.borderRadius = "0px";
        TorrentContainer.style.borderRadius = "0px";
        TorrentMagnetContainer.style.width = "100px";

        toggleTorrentContainer.style.opacity = "1"
        toggleTorrentContainer.style.pointerEvents = "auto"

        TorrentMagnetContainer.innerHTML = `
          <div class="img-movieMedias-LoadingGif" class="loader">
              <div class="dot dot1"></div>
              <div class="dot dot2"></div>
              <div class="dot dot3"></div>
              <div class="dot dot4"></div>
          </div>`

        fetchTorrent(apiKey,movieId,MediaType,episodeInfo);
      }catch(error){
        console.error(error)
      }
    });
    SeasonDiv.appendChild(EpisodeElement);
    seasonsDivArray.push(SeasonDiv);
  });
  return "";
}

function handleEpisodeElementColoring(DivContainer,currentEpisodeElement){
  let EpisodeElements = DivContainer.querySelectorAll('div[class="div-episodes-Element"]');

  EpisodeElements.forEach(element =>{
    if(element != currentEpisodeElement){
      element.style.borderColor = "rgba(0,0,0,0)";
      element.style.backgroundColor = "rgba(0,0,0,0)";
    }else{
      element.style.borderColor = "rgba(var(--MovieElement-hover-BorderColor), 100%)";
      element.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    }
  });
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
          TorrentMagnetContainer.innerHTML = "";
          let NothingWasFound = document.createElement("span");
          NothingWasFound.innerHTML = error.message;
          NothingWasFound.style.backgroundColor = "rgba(0,0,0,0)";
          TorrentMagnetContainer.appendChild(NothingWasFound);
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
    SerieContainer.style.display = "flex";
    Seasons.forEach(season =>{
      let name = season.name;
      let seasonNumber = season.season_number;
      let newOption = document.createElement("option");
      newOption.value = seasonNumber;
      newOption.innerText = name;
      selectElement.appendChild(newOption); 
      loadEpisodes(apiKey,movieId,seasonNumber,Title);
    });
    selectElement.addEventListener("change",()=>{
      displayEpisodes(selectElement.value);
    });
  }else{
    TorrentMagnetContainer.style.display = "flex";
    selectSeasonContainer.style.display = "none";
  }

  document.title = Title;

  document.getElementById("h1-MovieTitle").innerText = Title;
  document.getElementById("p-movieDuration").innerText = Duration;
  document.getElementById("p-movieYearOfRelease").innerText = ReleaseYear;
  document.getElementById("p-movieRating").innerText = Rating;
  document.getElementById("p-summaryParagraph").innerText = Summary;

  if(Duration == "TV Show") TorrentMagnetContainer.style.display = "none";
  else EpisodesContainer.style.display = "none";

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

    if(Crew?.[0]?.hasOwnProperty("job") || Crew?.[0]?.hasOwnProperty("known_for_department")){
      DirectorsObjects = Crew.filter(element => element.job=="Director" && element.known_for_department=="Directing");
      if(DirectorsObjects.lenght){
        DirectorsObjects = Crew.filter(element => element.job=="Director" || element.known_for_department=="Directing");
      }
    }else{
      throw new Error("No Information about the Crew Founded.");
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
    TorrentMagnetContainer.innerHTML = "";
    addSpaceToTopOfTorrentContainer();
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

        TorrentMagnetContainer.append(TorrentElement);
      }
    });
    TorrentMagnetContainer.classList.remove("preloadingTorrent");
    if(TorrentMagnetContainer.innerHTML.trim() == "") throw new Error("No Useful Results Were found !");
    if(TorrentMagnetContainer.style.display != "none"){
      TorrentContainer.style.display = "block";
      TorrentMagnetContainer.style.display = "block";
  }
    loadIconsDynamically();
}

function insertContinueWatchingButton(container,MediaLibraryInfo){
  let continueVideoButton = document.createElement("button");
  continueVideoButton.classList.add("continue-video-button");

  fetch('../assets/icons/playVideo.svg')
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
  selectElement.style.display = "block";
  EpisodesContainer.style.display = "block";
  EpisodesContainer.innerHTML = "";
  let seasonIndex = seasonNumber;
  let currentSeasonDiv = seasonsDivArray.find(div => div.getAttribute("season_number") == seasonIndex);
  selectElement.value = seasonIndex;
  EpisodesContainer.append(currentSeasonDiv);
}

async function handleDivsResize(){
  let systemSettings = await window.electronAPI.loadSettings();
  let defaultRatio = systemSettings?.defaultDivRadio;
  if(defaultRatio == undefined) defaultRatio = 0.3;

  resizeTorrentAndEpisodeElement(defaultRatio,EpisodesContainer);
  resizeTorrentAndEpisodeElement(defaultRatio,TorrentMagnetContainer);

  window.addEventListener("resize",(event)=>{
    resizeTorrentAndEpisodeElement(defaultRatio,EpisodesContainer);
    resizeTorrentAndEpisodeElement(defaultRatio,TorrentMagnetContainer);
  });

  dragResizeDiv(EpisodesContainer);
  dragResizeDiv(TorrentMagnetContainer);

  [EpisodesContainer,TorrentMagnetContainer].forEach(ToResizeDiv => {
    window.addEventListener("mousemove",(event)=>{
      const onLeftBorder = isOnLeftBorder(event,ToResizeDiv); 
      const mouseTopOfDiv = isMouseOnDiv(ToResizeDiv);
      if(onLeftBorder && mouseTopOfDiv){
        ToResizeDiv.style.cursor = "ew-resize";
      }else{
        ToResizeDiv.style.cursor = "default";
      }
    });
  });
}

function resizeTorrentAndEpisodeElement(radio,DivElement){
  DivElement.style.maxWidth = window.innerWidth*radio+"px";
  DivElement.style.minWidth = window.innerWidth*radio+"px";
  addSpaceToTopOfTorrentContainer();
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

toggleTorrentContainer.addEventListener("click",(event)=>{
  TorrentMagnetContainer.style.display = "none";
  toggleTorrentContainer.style.opacity = "0";
  toggleTorrentContainer.style.pointerEvents = "none";

  // clearing the coloring of all the episode Elements
  let SeasonDiv = document.getElementById("main-SeasonDiv");
  handleEpisodeElementColoring(SeasonDiv,undefined) 
});


function addEventListenerWithArgs(element,event,handler,...args){
  const listener = e => handler(e,...args);
  element.addEventListener(event,listener);
  return listener;
}
function removeEventListenerWithArgs(element,event,listener){
  element.removeEventListener(event,listener);
}


function isMouseOnDiv(div){
    const rect = div.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}


function isOnLeftBorder(event,ToResizeDiv){
  const rect = ToResizeDiv.getBoundingClientRect();
  const style = getComputedStyle(ToResizeDiv);
  const borderLeft = parseFloat(style.borderLeftWidth)+10;
  const x = event.clientX - rect.left;

  const onLeftBorder = x < borderLeft;
  return onLeftBorder;
}

function dragResizeDiv(ToResizeDiv){
  ToResizeDiv.addEventListener("mousedown",(event)=>{
    const onLeftBorder = isOnLeftBorder(event,ToResizeDiv);
    if(onLeftBorder){
      let listener = addEventListenerWithArgs(window,"mousemove",moveDiv,ToResizeDiv);
      window.addEventListener("mouseup",async()=>{
        let systemSettings = await window.electronAPI.loadSettings();
        systemSettings["defaultDivRadio"] = calculatingDivRadio(ToResizeDiv);
        await window.electronAPI.applySettings(systemSettings);
        removeEventListenerWithArgs(window,"mousemove",listener);
      },{once:true});
    }
  });
}

function calculatingDivRadio(DivElement){
  return parseFloat(DivElement.style.maxWidth) / window.innerWidth;
}

function moveDiv(event,ToResizeDiv){
  let leftBorderPos = ToResizeDiv.getBoundingClientRect().left;
  let mousePos = event.clientX; 
  ToResizeDiv.style.maxWidth = parseInt(ToResizeDiv.style.maxWidth) + leftBorderPos-mousePos+"px";
  ToResizeDiv.style.minWidth = parseInt(ToResizeDiv.style.minWidth) + leftBorderPos-mousePos+"px";
}

function addSpaceToTopOfTorrentContainer(){
  let selectSeasonContainer = document.querySelector(".selectSeason-container");
  let dummyDiv = document.getElementById("dummyDiv");
  let selectSeasonContainerHeight = selectSeasonContainer.offsetHeight;

  if(selectSeasonContainerHeight > 0){
    dummyDiv.style.height = selectSeasonContainerHeight+"px";
    TorrentContainer.style.paddingBottom = selectSeasonContainerHeight+"px";
  }else{
    dummyDiv.style.height = "15px";
    TorrentContainer.style.paddingBottom = "15px";
  }
}

setupKeyPressesHandler();
handleLibraryButton()
fetchInformation();
handleDivsResize();
handleFullScreenIcon();
