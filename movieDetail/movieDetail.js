const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");

let backgroundImage;
let IMDB_ID;

let mainPageDiv = document.getElementById("div-main");
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

let contextMenu = document.querySelector("#contextMenu");
let DownloadOverlay = document.getElementById('downloadOverlay');

let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.error(err)}},100);

EpisodesContainer.style.cursor = 'default';

if(MediaType === "movie") TorrentContainer.style.display = "flex";

let seasonsDivArray = [];

async function fetchInformation(){
  const apiKey = await window.electronAPI.getAPIKEY();
  const results = await Promise.allSettled([
    loadMovieInformation(apiKey),
    loadCastInformation(apiKey)
  ]);

  if (results[0].status === "rejected" && results[1].status === "rejected") {
    let middleDiv = document.getElementById("div-middle");
    document.documentElement.classList.add("fetchingFailed");
    middleDiv.innerHTML = "";
    mainPageDiv.style.opacity = "1";
    setTimeout(() => {
      let WarningElement = DisplayWarningOrErrorForUser("We're having trouble loading data.</br>Please Check your connection and retry!");
      middleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      middleDiv.style.opacity = 1;
    }, 800);
  }
}

function loadMovieInformation(apiKey){
  //load Movie information
  let MediaTypeForSearch = MediaType === "anime" ? "tv" :MediaType;
  return fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}?api_key=${apiKey}`)
    .then(res=>res.json())  
    .then(data =>{
      insertMediaInformation(data,apiKey);
      if(MediaType === "movie")
        return fetchTorrent(apiKey,movieId,MediaType); 
    })
    .catch(error => {
      console.error(error);
      throw error;
    });
}

function loadCastInformation(apiKey){
  // load Cast and Crew information
  let MediaTypeForSearch = MediaType === "anime" ? "tv" :MediaType;
  return  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/credits?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => insertCastInformation(data))
    .catch(err =>{
      noInfoFounded();
      console.error(err);
      throw error
  });
}


function noInfoFounded(){
  noCastInfoFounded();
  noDirectorInfoFounded();
}

function noCastInfoFounded(){
  let NoCastInfoFounded = document.createElement("p");
  NoCastInfoFounded.innerHTML = 'No Cast information were Found';
  divCastElement.appendChild(NoCastInfoFounded);
  NoCastInfoFounded.classList.add("case-info-unavailable");
}

function noDirectorInfoFounded(){
  let NoDirectorInfoFounded = document.createElement("p");
  NoDirectorInfoFounded.innerHTML = 'No Directors information were Found';
  divDirectoryElement.appendChild(NoDirectorInfoFounded);
  NoDirectorInfoFounded.classList.add("case-info-unavailable");
}

async function loadAllEpisodesOfSeason(apiKey,series_id,season_number,title){
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
    let episodeImageUrl = "../assets/noEpisodeImageFound.png";
    if(episode.still_path)
      episodeImageUrl = `https://image.tmdb.org/t/p/w342/${episode.still_path}`;

    SeasonDiv.setAttribute("season_number",episode.season_number);
    let EpisodeElement = document.createElement("div");
    EpisodeElement.className = "div-episodes-Element";
    EpisodeElement.innerHTML += `
      <h4>${episode.episode_number}</h4>
        <div style="height:70px;width:124px" class="episode-image-container">
          <img style="height:70px;width:124px" class="episode-image"></img>
        </div>
      <div style="max-width:50%;width: fit-content; " class="div-episode-information">
        <p style="font-size:15px;">${episode.name}</p>
        <p style="font-weight:bold;font-size:11px;margin-top:20px;">${episode.air_date}</p>
      </div>
    `;

    let episodeImageElement = EpisodeElement.querySelector(".episode-image");
    let episodeImageElementContainer = EpisodeElement.querySelector(".episode-image-container");
    loadImageWithAnimation(episodeImageElementContainer, episodeImageElement, episodeImageUrl,"../assets/noEpisodeImageFound.png");

    let continueWatchingEpisode = (libraryInfo?.typeOfSave?.includes("Currently Watching") &&
      episode.season_number === libraryInfo["seasonNumber"] &&
      episode.episode_number === libraryInfo["episodeNumber"]);

    if(continueWatchingEpisode){
      EpisodeElement.style.backgroundColor = "rgba(255, 255, 255, 10%)";
      insertContinueWatchingButton(EpisodeElement,libraryInfo);
    }

    EpisodeElement.addEventListener("mouseenter",()=>{
      EpisodeElement.classList.add("episode_hovered")
    });

    EpisodeElement.addEventListener("mouseleave",()=>{
      EpisodeElement.classList.remove("episode_hovered")
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
}

function handleEpisodeElementColoring(DivContainer, currentEpisodeElement) {
  const EpisodeElements = DivContainer.querySelectorAll('.div-episodes-Element');

  EpisodeElements.forEach(element => {
    element.classList.toggle(
      "pressed_episode",
      element === currentEpisodeElement
    );
  });
}

async function fetchTorrent(apiKey,MediaId,MediaType,episodeInfo={}){
  let MediaTypeForSearch = MediaType === "anime" ? "tv" :MediaType;
  let libraryInfo = await loadMediaEntryPointLibraryInfo();
  fetch(`https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/external_ids?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      IMDB_ID = data.imdb_id;
      let fetchUrl;
      if(MediaTypeForSearch === "tv")
        fetchUrl = `https://torrentio.strem.fun/stream/series/${IMDB_ID}:${episodeInfo.seasonNumber}:${episodeInfo.episodeNumber}.json`;
      else
        fetchUrl = `https://torrentio.strem.fun/stream/movie/${IMDB_ID}.json`;

      fetch(fetchUrl)
        .then(res=>res.json())  
        .then(data =>{
          insertTorrentInfoElement(data,MediaId,MediaTypeForSearch,libraryInfo?.[0],episodeInfo);
        })
        .catch(error =>{
          TorrentMagnetContainer.innerHTML = "";
          let NothingWasFound = document.createElement("div");
          NothingWasFound.classList.add("div-NothingWasFound");
          NothingWasFound.innerHTML = error.message;
          TorrentMagnetContainer.appendChild(NothingWasFound);
          console.error(error);
        });
    });
}

async function insertMediaInformation(data,apiKey){
  let [Title,Duration,ReleaseYear,Rating,Adult,Genres,logoFileName,Summary,Seasons] = await extractMediaInfoFromApiResponse(apiKey,data);

  document.title = Title;
  addBackgroundImageToBody(backgroundImage)

  insertLogoTitleInformation(logoFileName,Title)
  let mediaGeneraleInfo = [Duration,ReleaseYear,Rating,Summary];
  insertMediaGeneraleInformation(mediaGeneraleInfo);
  insertGenresOfMedia(Genres);

  if(Duration === "TV Show") TorrentMagnetContainer.style.display = "none";
  else EpisodesContainer.style.display = "none";

  if(Seasons){
    SerieContainer.style.display = "flex";
    for(let season of Seasons){
      let [newOption,seasonNumber] = createSeasonOptionElement(season);
      selectElement.appendChild(newOption); 
      loadAllEpisodesOfSeason(apiKey,movieId,seasonNumber,Title);
    }

    dropDownInit(); // initialise seasons drop down
    addSeasonsDropDownEventListener()

  }else{
    TorrentMagnetContainer.style.display = "flex";
    selectSeasonContainer.style.display = "none";
  }

  globalLoadingGif.remove();

  mainPageDiv.style.opacity = "1";
}

async function extractMediaInfoFromApiResponse(apiKey,data){
  let Title = data?.title ?? data?.name ?? "Unknown";
  let Duration = data?.runtime
    ? `${data.runtime} min`
    : MediaType === "tv"
      ? "TV Show"
      : null;

  let ReleaseYear = data?.release_date
    ? new Date(data.release_date).getFullYear()
    : data?.first_air_date
      ? new Date(data.first_air_date).getFullYear()
      : null;

  let Rating = data?.vote_average != null 
    ? parseFloat(data.vote_average).toFixed(1) 
    : null;

  let Adult = data?.adult ?? "Unknown";
  let Genres = Array.isArray(data?.genres) 
    ? data.genres.map(el => ({ name: el.name, id: el.id })) 
    : "Unknown";

  let mediaOriginalLanguage = data?.original_language ?? "Unknown";
  let Summary = data?.overview ?? null;
  backgroundImage = data?.backdrop_path
    ? `https://image.tmdb.org/t/p/original/${data.backdrop_path}` 
    : "Unknown";

  let logoFileName = await loadLogoImage(mediaOriginalLanguage,apiKey);

  let Seasons = data?.seasons ?? 0;

  return [Title,Duration,ReleaseYear,Rating,Adult,Genres,logoFileName,Summary,Seasons];
}

function insertLogoTitleInformation(logoFileName,Title){
  let logoTitleContainer = document.getElementById("div-MovieLogoTitleContainer");
  let textTitleElement = document.getElementById("h1-MovieTitle");
  let logoTitleElement = document.getElementById("img-MovieLogoTitle");

  if(logoFileName){
    let logoImage = `https://image.tmdb.org/t/p/original/${logoFileName}`;
    logoTitleElement.src = logoImage;
    textTitleElement.style.display = "none";
  }else
    logoTitleContainer.style.display = "none";

  textTitleElement.innerText = Title;
}

function insertMediaGeneraleInformation(mediaBasicInfo){
  let mediaDurationElement = document.getElementById("p-movieDuration");
  let mediaYearOfReleaseElement = document.getElementById("p-movieYearOfRelease");
  let mediaRatingElement = document.getElementById("p-movieRating");
  let mediaSummaryElement = document.getElementById("p-summaryParagraph");
  let imdbLogoElement = document.getElementById("img-IMDBlogo");

  let [Duration,ReleaseYear,Rating,Summary] = mediaBasicInfo;
  let summaryExist = true;
  if(!Duration) mediaDurationElement.style.display = "none";
  if(!ReleaseYear) mediaYearOfReleaseElement.style.display = "none";
  if(!Rating || Rating === "0.0"){
    mediaRatingElement.style.display = "none";
    imdbLogoElement.style.display = "none";
  }
  if(!Summary || Summary.trim() === ""){
    summaryExist = false;
    mediaSummaryElement.classList.add("unavailable-summary");
  }

  mediaDurationElement.innerText = Duration;
  mediaYearOfReleaseElement.innerText = ReleaseYear;
  mediaRatingElement.innerText = Rating;
  mediaSummaryElement.innerText = summaryExist ? Summary : "No Summary available" ;
}

function insertGenresOfMedia(Genres){
  let DivGenresContainer = document.getElementById("div-genresInfos");
  for(let genre of Genres){
    let newGenreElement = document.createElement("button");
    newGenreElement.onclick = ()=>{openDiscoveryPage(genre.id,MediaType)};
    newGenreElement.classList.add("btn-MovieDetailsButtons");
    newGenreElement.innerText = genre.name;
    DivGenresContainer.append(newGenreElement);
  }
}

function createSeasonOptionElement(season){
  let name = season.name;
  let seasonNumber = season.season_number;
  let newOption = document.createElement("div");
  newOption.classList.add("select-option");
  newOption.setAttribute("role","option");
  newOption.setAttribute("value",seasonNumber);
  newOption.innerText = name;
  return [newOption,seasonNumber];
}

function addSeasonsDropDownEventListener(){
  selectElement.addEventListener("dropdownChange",()=>{
    let newDropDownValue = getDropdownValue(selectElement);
    displayEpisodes(newDropDownValue);
  });
}

function addBackgroundImageToBody(backgroundImage){
  if(backgroundImage !== "https://image.tmdb.org/t/p/original/null"){
    document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${backgroundImage}')`;
    document.documentElement.style.backgroundRepeat = `no-repeat`;
    document.documentElement.style.backgroundPosition = `center center`;
    document.documentElement.style.backgroundSize = `cover`;
    document.documentElement.style.backgroundAttachment = `fixed`;
  }
}

function insertCastInformation(data){
    if(data.success === false) throw new Error("No Information about the Crew Founded.");
    let Crew = data.crew;
    let Cast = data.cast;

    let DirectorsObjects = [];
    let MainCastObjects = [];

    if(Crew?.[0]?.hasOwnProperty("job") || Crew?.[0]?.hasOwnProperty("known_for_department")){
      DirectorsObjects = Crew.filter(element => element.job === "Director" && element.known_for_department === "Directing");
      if(DirectorsObjects.length){
        DirectorsObjects = Crew.filter(element => element.job === "Director" || element.known_for_department === "Directing");
      }
    }else{
      throw new Error("No Information about the Crew Founded.");
    }

    if(Cast?.[0]?.hasOwnProperty("name")) 
      MainCastObjects = Cast;

    let loadedDirectors = [];
    for(let directorObject of DirectorsObjects){
      if(!loadedDirectors.includes(directorObject.id)){
        let newDirectorElement = document.createElement("button");
        newDirectorElement.onclick = ()=>{openProfilePage(directorObject.id)};
        newDirectorElement.id = directorObject.id;
        newDirectorElement.classList.add("btn-MovieDetailsButtons");
        newDirectorElement.innerText = directorObject.name;
        divDirectoryElement.append(newDirectorElement);
        loadedDirectors.push(directorObject.id);
        if(loadedDirectors.length > 4) break;
      }
    }

    let loadedCast = [];
    for(let castObject of MainCastObjects){
      if(!loadedCast.includes(castObject.id)){
        let newCastElement = document.createElement("button");
        newCastElement.onclick = ()=>{openProfilePage(castObject.id)};
        newCastElement.id = castObject.id;
        newCastElement.classList.add("btn-MovieDetailsButtons");
        newCastElement.innerText = castObject.name;
        divCastElement.append(newCastElement);
        loadedCast.push(castObject.id);
        if(loadedCast.length > 4) break;
      }
    }

    if(!MainCastObjects.length){
      noCastInfoFounded();
    }
    if(!DirectorsObjects.length){
      noDirectorInfoFounded();
    }
}

function insertTorrentInfoElement(data,MediaId,MediaType,MediaLibraryInfo,episodeInfo={}){
    TorrentMagnetContainer.innerHTML = "";
    addSpaceToTopOfTorrentContainer();
    let TorrentResutls = data.streams;
    TorrentResutls.forEach(element => {
      let FullTitle = element.title.replace(/\n+/g, "");
      let Title = FullTitle.split("👤")[0].split("\n")[0].replace(/\n+/g, "");
      let Quality = element.name.split("Torrentio")[1].replace(/\n+/g, "");
      let Hash = element.infoHash;
      let SeedersNumber = FullTitle.split("👤")[1].split("💾")[0].replace(/\n+/g, "");
      let Size = FullTitle.split("💾")[1].split("⚙️")[0].replace(/\n+/g, "");
      let fileName = element?.behaviorHints?.filename || "";
      let MagnetLink = `magnet:?xt=urn:btih:${Hash}`

      if(parseInt(SeedersNumber) && fileName.trim() !== ""){
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
          openMediaVideo(undefined,MediaId,MediaType,undefined,fileName,MagnetLink,IMDB_ID,backgroundImage,episodeInfo);
        });
        
        TorrentElement.addEventListener("mousedown",(event)=>{
          if (event.button === 2) {
            let mediaTitle = document.getElementById("h1-MovieTitle").innerText;
            let mediaReleaseYear = document.getElementById("p-movieYearOfRelease").innerText;
            let DownloadTargetInfo = {
              IMDB_ID:IMDB_ID, Title:mediaTitle, Size:Size,
              Quality:Quality, Year:mediaReleaseYear, MagnetLink:MagnetLink,
              fileName:fileName,dirName:Title, MediaId:MediaId, MediaType:MediaType,
              seasonNumber:episodeInfo.seasonNumber,episodeNumber:episodeInfo.episodeNumber
            };
            setupDownloadDivEvents(DownloadTargetInfo);
            handleRightClicksForTorrentElement(DownloadTargetInfo);
          }
        });

        if(MediaLibraryInfo?.typeOfSave?.includes("Currently Watching") &&
          String(MagnetLink) === String(MediaLibraryInfo["Magnet"]) &&
          String(episodeInfo.seasonNumber) === String(MediaLibraryInfo["seasonNumber"]) &&
          String(episodeInfo.episodeNumber) === String(MediaLibraryInfo["episodeNumber"]))
            insertContinueWatchingButton(TorrentElement,MediaLibraryInfo)

        // if(!fileName.includes("mkv"))
        TorrentMagnetContainer.append(TorrentElement);
      }
    });
    TorrentMagnetContainer.classList.remove("preloadingTorrent");
    if(TorrentMagnetContainer.innerHTML.trim() === "") throw new Error("No Useful Results Were found !");
    // if(TorrentMagnetContainer.style.display !== "none"){
      TorrentContainer.style.display = "block";
      TorrentMagnetContainer.style.display = "block";
    // }
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
    openMediaVideo(MediaLibraryInfo.TorrentIdentification,MediaLibraryInfo.MediaId, MediaLibraryInfo.MediaType, MediaLibraryInfo.Magnet,MediaLibraryInfo.mediaImdbId,MediaLibraryInfo.bgImagePath,episodeInfo);
    event.preventDefault();
    event.stopPropagation();
  });

  container.appendChild(continueVideoButton);
  container.style.backgroundColor ="rgba(255, 255, 255, 10%)";
}


function displayEpisodes(seasonIndex){
  let currentSeasonDiv = seasonsDivArray.find(div => parseInt(div.getAttribute("season_number")) === parseInt(seasonIndex));
  if(currentSeasonDiv){
    selectElement.style.display = "block";
    EpisodesContainer.style.display = "block";
    EpisodesContainer.innerHTML = "";
    setDropdownValue(selectElement,seasonIndex);
    EpisodesContainer.appendChild(currentSeasonDiv);
  }
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
  }else{
    setAddToLibraryButtonToNormal(addToLibraryButton);
    addToLibraryButton.innerHTML+="Save To Library";
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

function handleRightClicksForTorrentElement(DownloadTargetInfo){
  let DownloadOption = contextMenu.querySelector("#DownloadOption");

  DownloadOption.addEventListener("mousedown",()=>showDownloadInfoInputDiv(DownloadTargetInfo),{once:true});

  contextMenu.style.top = event.pageY + "px";
  contextMenu.style.left = event.pageX + "px";
  contextMenu.style.display = "flex";
  dontGoBack = true;

  event.stopImmediatePropagation();
  event.preventDefault();
  event.stopPropagation();
}

document.addEventListener("mousedown", event => {
  contextMenu.style.display = "none";
  dontGoBack = false;
});

async function showDownloadInfoInputDiv(DownloadTargetInfo){
  const apiKey = await window.electronAPI.getAPIKEY();
  let [defaultPath, rememberDownloadLocation, DownloadSubtitles] = await loadDownloadSettings();
  let MediaPosterContainer = DownloadOverlay.querySelector("#mediaPoster");
  let MediaPosterElement = DownloadOverlay.querySelector("#mediaPosterImg");
  let MediaTitleElement = DownloadOverlay.querySelector("#mediaTitle");
  let SeasonEpisodeElement = DownloadOverlay.querySelector("#season-episode");
  let MediaYearTextElement = DownloadOverlay.querySelector("#mediaYear");
  let MediaSizeAResolutionTextElement = DownloadOverlay.querySelector("#mediaSize");
  let downloadPathInput = DownloadOverlay.querySelector("#downloadPath");
  let rememberPathCheckbox = DownloadOverlay.querySelector("#rememberPath");
  let addSubtitlesCheckbox = DownloadOverlay.querySelector("#addSubtitles");


  MediaTitleElement.innerText = DownloadTargetInfo.Title;
  if(DownloadTargetInfo.seasonNumber && DownloadTargetInfo.episodeNumber)
    SeasonEpisodeElement.innerText = `S${DownloadTargetInfo.seasonNumber}-E${DownloadTargetInfo.episodeNumber}`;
  MediaYearTextElement.innerText = DownloadTargetInfo.Year;
  MediaSizeAResolutionTextElement.innerText = DownloadTargetInfo.Size +" • "+DownloadTargetInfo.Quality;
  downloadPathInput.value = defaultPath;
  rememberPathCheckbox.checked = rememberDownloadLocation;
  addSubtitlesCheckbox.checked = DownloadSubtitles;


  DownloadOverlay.classList.add('active');
  dontGoBack = true;
  let posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  loadImageWithAnimation(MediaPosterContainer, MediaPosterElement, `https://image.tmdb.org/t/p/w185${posterPath}`);
}

function setupDownloadDivEvents(DownloadTargetInfo){
  // IMDB_ID,Title,Size,Quality,MagnetLink,fileName,MediaId,MediaType,seasonNumber,episodeNumber

  let cancelButton = DownloadOverlay.querySelector("#cancelBtn");
  let closeBtn = DownloadOverlay.querySelector("#closeBtn");
  let downloadButton = DownloadOverlay.querySelector("#downloadBtn");
  let browseButton = DownloadOverlay.querySelector("#browseBtn");
  let downloadPathInput = DownloadOverlay.querySelector("#downloadPath");
  let rememberPathCheckbox = DownloadOverlay.querySelector("#rememberPath");
  let addSubtitlesCheckbox = DownloadOverlay.querySelector("#addSubtitles");

  // handle closing and canceling buttons event listener
  [cancelButton,closeBtn].forEach((btn)=>{btn.addEventListener("click",()=>{
    DownloadOverlay.classList.remove('active');
  })});

  // handle the download button event listener
  downloadButton.addEventListener("click",async (event)=>{
    DownloadTorrent(DownloadTargetInfo,addSubtitlesCheckbox.checked);
    await saveDownloadSettings(downloadPathInput.value, addSubtitlesCheckbox.checked, rememberPathCheckbox.checked);
    DownloadOverlay.classList.remove('active');
    event.stopPropagation();
    event.preventDefault();
  });
  
  // handle browsing fs button
  browseButton.addEventListener("click",async (event)=>{
    let pathInputElement = document.getElementById("downloadPath");
    let dirPath = await window.electronAPI.openFileSystemBrowser(pathInputElement.value);
    if(dirPath) pathInputElement.value = dirPath;
  });

}

async function loadLogoImage(movieLanguage,apiKey){
  const res = await fetch(
    `https://api.themoviedb.org/3/${MediaType}/${movieId}/images?api_key=${apiKey}`
  );

  const data = await res.json();

  let originalLanguageLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === movieLanguage) ;
  let englishLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === "en");

  let titleLogo = englishLogos?.[0]?.file_path ?? originalLanguageLogos?.[0]?.file_path ?? null;
  return titleLogo;
}

async function DownloadTorrent(DownloadTargetInfo,downloadSubtitles){
  const apiKey = await window.electronAPI.getAPIKEY();
  let userDownloadPath = document.getElementById("downloadPath")?.value;
  let posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  DownloadTargetInfo["posterUrl"] = `https://image.tmdb.org/t/p/w500${posterPath}`;
  DownloadTargetInfo["bgImageUrl"] = backgroundImage;
  DownloadTargetInfo["userDownloadPath"] = userDownloadPath;
  let subsObjects = [];
  if(downloadSubtitles){
     subsObjects = await loadingAllSubs(DownloadTargetInfo.IMDB_ID);
  }

  window.electronAPI.downloadTorrent([DownloadTargetInfo],subsObjects);
}

async function loadDownloadSettings(){
  const Settings = await window.electronAPI.loadSettings();
  return [Settings?.["DefaultDownloadPath"],Settings?.["rememberDownloadLocationByDefault"],Settings?.["DownloadSubtitlesByDefault"]];
}

async function saveDownloadSettings(DefaultDownloadPath, DownloadSubtitlesByDefault, rememberDownloadLocationByDefault){
  let Settings = await window.electronAPI.loadSettings();
  Settings["rememberDownloadLocationByDefault"] = rememberDownloadLocationByDefault;
  Settings["DownloadSubtitlesByDefault"] = DownloadSubtitlesByDefault;
  if(rememberDownloadLocationByDefault)
    Settings["DefaultDownloadPath"] = DefaultDownloadPath;

  window.electronAPI.applySettings(Settings);
}

window.addEventListener("keydown",(event)=>{
  if(event.key === "Escape"){
    contextMenu.style.display = "none";
    DownloadOverlay.classList.remove('active');
  }
});


setupKeyPressesHandler();
handleLibraryButton()
fetchInformation();
handleDivsResize();
handleFullScreenIcon();
loadIconsDynamically();
