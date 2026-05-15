const data = new URLSearchParams(window.location.search);
let movieId = data.get("MovieId");
let MediaType = data.get("MediaType");

let backgroundImage;
let IMDB_ID;
let GlobalTitle = null;

const middleDiv = document.getElementById("div-middle");
const TorrentContainer = document.getElementById("div-TorrentContainer");
const SerieContainer = document.getElementById("div-serieEpisodes");

let TorrentMagnetContainer = document.getElementById("div-movieMedias");
let EpisodesContainer = document.getElementById("EpisodesContainer");

TorrentMagnetContainer.classList.add("preloadingTorrent");

let selectSeasonContainer = document.querySelector(".selectSeason-container");
let selectSeason = document.getElementById("select-Seasons");
const selectSave = document.getElementById("select-save");

let toggleTorrentContainer = document.querySelector(".toggleButton");

let serieEpisodeloadingDiv = document.getElementById("div-serieEpisodes-LoadingGif");
let movieMediaLoadingDiv = document.getElementById("div-movieMedias-LoadingGif");

let divCastElement = document.getElementById("div-castInfos");
let divDirectoryElement = document.getElementById("div-directorInfos");

let addToLibraryButton = document.querySelector(".split-save-btn__main");

let contextMenu = document.querySelector("#contextMenu");
let DownloadOverlay = document.getElementById('downloadOverlay');

let globalLoadingGif = document.getElementById("div-globlaLoadingGif");
setTimeout(()=>{try{globalLoadingGif.style.opacity = "1"}catch(err){console.error(err)}},100);

EpisodesContainer.style.cursor = 'default';

if(MediaType === "movie") TorrentContainer.style.display = "block";

let seasonsDivArray = [];

async function pageInit() {
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
  const results = await Promise.allSettled([
    loadMovieInformation(apiKey),
    loadCastInformation(apiKey)
  ]);

  if (results[0].status === "rejected") {
    let middleDiv = document.getElementById("div-middle");
    document.documentElement.classList.add("fetchingFailed");
    middleDiv.innerHTML = "";
    middleDiv.classList.add("activate");
    setTimeout(() => {
      const WarningElement = DisplayWarningOrErrorForUser(
        "We're having trouble loading data.</br>Please Check your connection and retry!"
      );
      middleDiv.appendChild(WarningElement);
      globalLoadingGif.remove();
      middleDiv.classList.add("activate");
    }, 800);
  }
}

async function loadMovieInformation(apiKey) {
  try {
    const MediaTypeForSearch = MediaType === "anime" ? "tv" : MediaType;
    const url = `https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}?api_key=${apiKey}`;
    const res = await fetch(url);
    const mediaInfo = await res.json();
    renderMediaPage(mediaInfo,apiKey);
    if(MediaType === "movie") {
      await fetchMediaTorrent(apiKey,movieId,MediaType); 
    }
  } catch(err) {
    console.error(err);
    throw err;
  }
}

async function loadCastInformation(apiKey) {
  try {
    const MediaTypeForSearch = MediaType === "anime" ? "tv" : MediaType;
    const url = `https://api.themoviedb.org/3/${MediaTypeForSearch}/${movieId}/credits?api_key=${apiKey}`;
    const res = await fetch(url);
    const castData = await res.json();
    renderCastInfomation(castData);
  } catch(err) {
    noInfoFounded();
    console.error(err);
    throw err;
  }
}


function noInfoFounded() {
  noCastInfoFounded();
  noDirectorInfoFounded();
}

function noCastInfoFounded() {
  let NoCastInfoFounded = document.createElement("p");
  NoCastInfoFounded.innerHTML = 'No Cast information were Found';
  divCastElement.appendChild(NoCastInfoFounded);
  NoCastInfoFounded.classList.add("case-info-unavailable");
}

function noDirectorInfoFounded() {
  let NoDirectorInfoFounded = document.createElement("p");
  NoDirectorInfoFounded.innerHTML = 'No Directors information were Found';
  divDirectoryElement.appendChild(NoDirectorInfoFounded);
  NoDirectorInfoFounded.classList.add("case-info-unavailable");
}

async function loadAllEpisodesOfSeason(apiKey,series_id,season_number,title) {
  try {
    const libraryInfo = await loadMediaEntryPointLibraryInfo();
    const url = `https://api.themoviedb.org/3/tv/${series_id}/season/${season_number}?api_key=${apiKey}`;
    const res = await fetch(url);
    const episodesData = await res.json();
    await renderEpisodes(apiKey,episodesData,title,libraryInfo?.[0]);
    displaySeason(1);
  } catch(err) {
    console.error(err.message)
    EpisodesContainer.innerHTML = "";
    const NothingWasFound = document.createElement("span");
    NothingWasFound.innerHTML = "No Results Were Found !";
    SerieContainer.style.display = "flex";
    EpisodesContainer.appendChild(NothingWasFound);
  }
}

function renderEpisodes(apiKey,data,title,libraryInfo) {
  const SeasonDiv = document.createElement("div");
  SeasonDiv.id = "main-SeasonDiv";

  const episodes = data.episodes;
  episodes.forEach(episode =>{
    let episodeImageUrl = "../../../assets/noEpisodeImageFound.svg";
    if(episode.still_path)
      episodeImageUrl = `https://image.tmdb.org/t/p/w342/${episode.still_path}`;

    SeasonDiv.setAttribute("season_number",episode.season_number);
    const EpisodeElement = createEpisodeElement(episode, episodeImageUrl);

    const isContinueWatching = (libraryInfo?.typeOfSave?.includes("Currently Watching") &&
      episode.season_number === libraryInfo["seasonNumber"] &&
      episode.episode_number === libraryInfo["episodeNumber"]);

    if(isContinueWatching){
      EpisodeElement.classList.add("continue_wathing_episode");
      createContinueWatchingBtn(EpisodeElement,libraryInfo);
    }

    createEpisodeEventListeners(apiKey, SeasonDiv, EpisodeElement, episode);
    SeasonDiv.appendChild(EpisodeElement);
    seasonsDivArray.push(SeasonDiv);
  });
}

function createEpisodeElement(episodeInfo, episodeImgUrl) {
  const EpisodeElement = document.createElement("div");
  EpisodeElement.className = "div-episodes-Element";
  EpisodeElement.setAttribute("tabindex",0);
  EpisodeElement.innerHTML = 
    `<h4>${episodeInfo.episode_number}</h4>
    <div class="episode-image-container">
      <img class="episode-image"></img>
    </div>
    <div class="div-episode-information">
      <p class="episode-name">${episodeInfo.name}</p>
      <p class="episode-airDate">${episodeInfo.air_date}</p>
    </div>`;
  const episodeImgElementContainer = EpisodeElement.querySelector(".episode-image-container");
  const episodeImgElement = EpisodeElement.querySelector(".episode-image");
  loadImageWithAnimation(
    episodeImgElementContainer,
    episodeImgElement,
    episodeImgUrl,
    "../../../assets/noEpisodeImageFound.svg"
  );
  return EpisodeElement;
}

function createEpisodeEventListeners(apiKey, SeasonDiv, EpisodeElement, episodeInfo) {
  EpisodeElement.addEventListener("mouseenter",() => {
    EpisodeElement.classList.add("episode_hovered")
  });

  EpisodeElement.addEventListener("mouseleave",()=>{
    EpisodeElement.classList.remove("episode_hovered")
  });

  EpisodeElement.addEventListener("click",async () => {
    handleEpisodeElementColoring(SeasonDiv,EpisodeElement);
    try {
      const defaultRatio = await getDefaultRatio();
      resizeTorrentAndEpisodeElement(defaultRatio,EpisodesContainer);
      resizeTorrentAndEpisodeElement(defaultRatio,TorrentMagnetContainer);

      TorrentContainer.style.display = "block";
      TorrentContainer.style.borderRadius = "0px";

      TorrentMagnetContainer.style.display = "block";
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
        </div>`;

      fetchMediaTorrent (
        apiKey, movieId,
        MediaType, {
          seasonNumber:String(episodeInfo.season_number).padStart(2,"0"),
          episodeNumber:String(episodeInfo.episode_number).padStart(2,"0")
        }
      );
    } catch(error) {
      console.error(error)
    }
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

async function fetchMediaTorrent(apiKey,MediaId,MediaType,episodeInfo={}) {
  let MediaTypeForSearch = MediaType === "anime" ? "tv" :MediaType;
  let libraryInfo = await loadMediaEntryPointLibraryInfo();

  try {
    IMDB_ID = await getIMDB_ID(MediaTypeForSearch, movieId, apiKey);
    let url = (MediaType === "tv") 
      ? `https://torrentio.strem.fun/stream/series/${IMDB_ID}:${episodeInfo.seasonNumber}:${episodeInfo.episodeNumber}.json`
      : `https://torrentio.strem.fun/stream/movie/${IMDB_ID}.json`;

    const mediaTorrentRes = await fetch(url);
    const mediaTorrentInformation = await mediaTorrentRes.json();
    renderMediaTorrent(mediaTorrentInformation,MediaId,MediaTypeForSearch,libraryInfo?.[0],episodeInfo);

  } catch (error) {
    console.error(error);
    const isNoResultsError =
      error?.message === "No Useful Results Were found !" ||
      error?.message === "No Results Were found !";

    const nothingWasFoundDiv = document.createElement("div");
    nothingWasFoundDiv.classList.add("div-NothingWasFound");
    nothingWasFoundDiv.textContent = isNoResultsError
      ? error.message
      : "Failed To Fetch Torrents, Please try again";

    if (!isNoResultsError) {
      const refreshButton = createRefreshTorrentBtn(apiKey, MediaId, MediaType);
      nothingWasFoundDiv.appendChild(refreshButton);
    }

    TorrentMagnetContainer.innerHTML = "";
    TorrentMagnetContainer.style.display = "flex";
    TorrentMagnetContainer.appendChild(nothingWasFoundDiv);
  }
}

async function getIMDB_ID(MediaType, MovieId, apiKey) {
  const mediaExternalIdsRes = await fetch(
    `https://api.themoviedb.org/3/${MediaType}/${MovieId}/external_ids?api_key=${apiKey}`
  );
  const mediaExternalIdsData = await mediaExternalIdsRes.json();
  const imdb_id = mediaExternalIdsData?.imdb_id
  if(imdb_id == null || imdb_id.trim() == "")
    throw new Error("No Results Were found !");

  return imdb_id;
}

function createRefreshTorrentBtn(apiKey, MediaId, MediaType) {
  const refreshButton = document.createElement("button");
  refreshButton.className = "btn-refreshAfterWarningMessage";
  refreshButton.innerHTML = reloadIcon;
  refreshButton.addEventListener("click",() => {
    TorrentMagnetContainer.innerHTML =
      `<div class="img-movieMedias-LoadingGif" class="loader">
        <div class="dot dot1"></div>
        <div class="dot dot2"></div>
        <div class="dot dot3"></div>
        <div class="dot dot4"></div>
      </div>`;

    setTimeout(() => {
      fetchMediaTorrent(apiKey,MediaId,MediaType);
    },1000);
  });
  return refreshButton;
}


async function renderMediaPage(data,apiKey) {
  let [Title,Duration,ReleaseYear,Rating,Adult,Genres,logoFileName,Summary,Seasons] = 
    await extractMediaInfoFromApiResponse(apiKey,data);

  GlobalTitle = Title;
  document.title = Title;
  addBackgroundImageToBody(backgroundImage);
  addImdbRatingEventListener(apiKey);
  insertLogoTitleInformation(logoFileName,Title);

  let mediaGeneraleInfo = [Duration,ReleaseYear,Rating,Summary];
  insertMediaGeneraleInformation(mediaGeneraleInfo);
  insertGenresOfMedia(Genres);

  if(Duration === "TV Show") TorrentMagnetContainer.style.display = "none";
  else EpisodesContainer.style.display = "none";

  if(Seasons){
    SerieContainer.style.display = "flex";
    for(let season of Seasons){
      let [newOption,seasonNumber] = createSeasonOptionElement(season);
      selectSeason.appendChild(newOption); 
      loadAllEpisodesOfSeason(apiKey,movieId,seasonNumber,Title);
    }

    addSeasonsDropDownEventListener()

  }else{
    TorrentMagnetContainer.style.display = "block";
    selectSeasonContainer.style.display = "none";
  }

  dropDownInit();
  globalLoadingGif.remove();

  middleDiv.classList.add("activate");
}

async function extractMediaInfoFromApiResponse(apiKey,data){
  const Title = data?.title ?? data?.name ?? "Unknown";
  const Duration = data?.runtime
    ? `${data.runtime} min`
    : MediaType === "tv"
      ? "TV Show"
      : null;

  const ReleaseYear = data?.release_date
    ? new Date(data.release_date).getFullYear()
    : data?.first_air_date
      ? new Date(data.first_air_date).getFullYear()
      : null;

  const Rating = data?.vote_average != null 
    ? parseFloat(data.vote_average).toFixed(1) 
    : null;

  const Adult = data?.adult ?? "Unknown";
  let Genres = Array.isArray(data?.genres) 
    ? data.genres.map(el => ({ name: el.name, id: el.id })) 
    : "Unknown";

  const mediaOriginalLanguage = data?.original_language ?? "Unknown";
  const Summary = data?.overview ?? null;
  backgroundImage = data?.backdrop_path
    ? `https://image.tmdb.org/t/p/original/${data.backdrop_path}` 
    : "Unknown";

  const logoFileName = await loadLogoImage(mediaOriginalLanguage,apiKey);

  const Seasons = data?.seasons ?? 0;

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
    addInspectBackdropImage(logoTitleContainer);
  } else {
    logoTitleContainer.style.display = "none";
    addInspectBackdropImage(textTitleElement);
  }

  textTitleElement.innerText = Title;
}

function insertMediaGeneraleInformation(mediaBasicInfo) {
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

async function addImdbRatingEventListener(apiKey) {
  let MediaTypeForSearch = MediaType === "anime" ? "tv" :MediaType;
  const IMDB_RatingElement = document.getElementById("movie-rating-div");
  const imdb_id = await getIMDB_ID(MediaTypeForSearch, movieId, apiKey);
  IMDB_RatingElement.addEventListener("click", async() => {
    const imdbLink = `https://www.imdb.com/title/${imdb_id}`;
    console.log(`Opening IMDB link: ${imdbLink}`);
    window.electronAPI.openExternalLink(imdbLink);
  });
}

function addInspectBackdropImage(titleElement) {
  const toggleBackdropInspection = (inspect) => {
    const mainDiv = document.getElementById("div-main");
    mainDiv.style.opacity = inspect ? "0" : "1";
    mainDiv.inert = inspect;
  }
  titleElement.addEventListener("click", () => {
    toggleBackdropInspection(true);
    setTimeout(() => {
      const restore = () => {
        event.preventDefault();
        event.stopPropagation();
        toggleBackdropInspection(false);
        document.removeEventListener("keydown", restore);
        document.removeEventListener("click", restore);
      };
      document.addEventListener("keydown", restore, { once: true });
      document.addEventListener("click", restore, { once: true });
    }, 100);
  });
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
  selectSeason.addEventListener("dropdownChange",()=>{
    let newDropDownValue = getDropdownValue(selectSeason);
    displaySeason(newDropDownValue);
  });
}

function addSaveDropDownEventListener() {
  selectSave.addEventListener("dropdownChange",(event)=>{
    let newDropDownValue = getDropdownValue(selectSave);
    addToLibraryButton.setAttribute("pressed"," ");
    addMediaToLibrary(newDropDownValue, true);
    event.stopPropagation();
  });
}

function applyBackground(styleObj, opacity) {
  styleObj.backgroundImage = `linear-gradient(rgba(0,0,0,${opacity}), rgba(0,0,0,${opacity})), url('${backgroundImage}')`;
  styleObj.backgroundRepeat = "no-repeat";
  styleObj.backgroundPosition = "center center";
  styleObj.backgroundSize = "cover";
  styleObj.backgroundAttachment = "fixed";
}

function addBackgroundImageToBody(backgroundImage) {
  if (backgroundImage !== "https://image.tmdb.org/t/p/original/null") {
    applyBackground(document.documentElement.style, 0.6);
    applyBackground(document.querySelector('.split-save-btn').style, 0.8);
  }
}

function renderCastInfomation(data) {
  if(data.success === false)
    throw new Error("No Information about the Crew Founded.");

  const Crew = data.crew;
  const Cast = data.cast;
  if(
    !Crew?.[0]?.hasOwnProperty("job") &&
    !Crew?.[0]?.hasOwnProperty("known_for_department")
  ) {
    throw new Error("No Information about the Crew Founded.");
  }
  const MainCastObjects = Cast?.[0]?.hasOwnProperty("name") ? Cast : [];
  let DirectorsObjects = Crew.filter(
    element => 
      element.job === "Director" &&
      element.known_for_department === "Directing"
  );
  if(DirectorsObjects.length){
    DirectorsObjects = Crew.filter(
      element => 
        element.job === "Director" ||
        element.known_for_department === "Directing"
    );
  }

  const loadedDirectors = [];
  for(let directorObject of DirectorsObjects) {
    if(!loadedDirectors.includes(directorObject.id)) {
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

  const loadedCast = [];
  for(let castObject of MainCastObjects) {
    if(!loadedCast.includes(castObject.id)) {
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

function renderMediaTorrent(data, MediaId, MediaType, MediaLibraryInfo, episodeInfo = {}) {
  TorrentMagnetContainer.innerHTML = "";
  addSpaceToTopOfTorrentContainer();

  data.streams.forEach(torrentInfo => {
    const { quality, title, size, seedersNumber, fileName, magnetLink } = parseTorrentInfo(torrentInfo);
    if (parseInt(seedersNumber) && fileName.trim() !== "") {
      const infoToDisplay = [quality, title, size, seedersNumber];
      const advancedInfo = [MediaId, MediaType, fileName, magnetLink, IMDB_ID,
                            backgroundImage, episodeInfo, size, quality, title];
      const torrentElement = createTorrentElement(infoToDisplay, advancedInfo);

      const isCurrentlyWatching = 
        MediaLibraryInfo?.typeOfSave?.includes("Currently Watching") &&
        String(magnetLink) === String(MediaLibraryInfo["Magnet"]) &&
        String(episodeInfo.seasonNumber) === String(MediaLibraryInfo["seasonNumber"]) &&
        String(episodeInfo.episodeNumber) === String(MediaLibraryInfo["episodeNumber"]);

      if (isCurrentlyWatching) createContinueWatchingBtn(torrentElement, MediaLibraryInfo);

      TorrentMagnetContainer.append(torrentElement);
    }
  });

  TorrentMagnetContainer.classList.remove("preloadingTorrent");
  if (TorrentMagnetContainer.innerHTML.trim() === "")
    throw new Error("No Useful Results Were found!");

  loadIconsDynamically();
}

function parseTorrentInfo(torrentInfo) {
  const fullTitle = torrentInfo.title.replace(/\n+/g, "");
  const title = fullTitle.split("👤")[0].split("\n")[0].replace(/\n+/g, "");
  const quality = torrentInfo.name.split("Torrentio")[1].replace(/\n+/g, "");
  const hash = torrentInfo.infoHash;
  const seedersNumber = fullTitle.split("👤")[1].split("💾")[0].replace(/\n+/g, "");
  const size = fullTitle.split("💾")[1].split("⚙️")[0].replace(/\n+/g, "");
  const fileName = torrentInfo?.behaviorHints?.filename || "";
  const magnetLink = `magnet:?xt=urn:btih:${hash}`
  return { title, quality, hash, seedersNumber, size, fileName, magnetLink };
}

function createContinueWatchingBtn(container,MediaLibraryInfo) {
  let continueVideoButton = document.createElement("button");
  continueVideoButton.classList.add("continue-video-button");

  fetch('../../../assets/icons/playVideo.svg')
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
    openMediaVideo(MediaLibraryInfo.TorrentIdentification,MediaLibraryInfo.MediaId, MediaLibraryInfo.MediaType,
      MediaLibraryInfo.Magnet,MediaLibraryInfo.mediaImdbId,MediaLibraryInfo.bgImagePath,episodeInfo);

    event.preventDefault();
    event.stopPropagation();
  });

  container.appendChild(continueVideoButton);
  container.style.backgroundColor ="rgba(255, 255, 255, 10%)";
}


function displaySeason(seasonIndex) {
  let currentSeasonDiv = seasonsDivArray.find(div => parseInt(div.getAttribute("season_number")) === parseInt(seasonIndex));
  if(currentSeasonDiv){
    EpisodesContainer.style.display = "block";
    EpisodesContainer.innerHTML = "";
    setDropdownValue(selectSeason,seasonIndex);
    EpisodesContainer.appendChild(currentSeasonDiv);
  }
}
async function getDefaultRatio() {
  let systemSettings = await window.electronAPI.loadSettings();
  let defaultRatio = systemSettings?.defaultDivRadio;
  if(defaultRatio == null) defaultRatio = 0.3;
  return defaultRatio;
}

async function handleDivsResize() {
  let defaultRatio = await getDefaultRatio();

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

function resizeTorrentAndEpisodeElement(radio,DivElement) {
  DivElement.style.maxWidth = window.innerWidth*radio+"px";
  DivElement.style.minWidth = window.innerWidth*radio+"px";
  addSpaceToTopOfTorrentContainer();
}

function addMediaToLibrary(typeOfSave = "Watch Later", setAsPressed = false) {
  ToggleInLibrary(addToLibraryButton, movieId,MediaType,GlobalTitle, undefined,typeOfSave, setAsPressed);
  addToLibraryButton.innerHTML += 
    addToLibraryButton.hasAttribute("pressed") ?
    typeOfSave ?? "Watch Later" 
    : "Watch Later";
}

async function loadMediaEntryPointLibraryInfo() {
  let MediaLibraryInfo = await window.electronAPI.loadMediaLibraryInfo({MediaId:movieId, MediaType:MediaType})
    .catch((err)=>{
      console.error(err);
      return [];
    });
  return MediaLibraryInfo;
}

async function handleLibraryButton() {
  let MediaLibraryInfo = await loadMediaEntryPointLibraryInfo();
  const typeOfSave = MediaLibraryInfo?.[0]?.typeOfSave;
  if(typeOfSave != null){
    setAddToLibraryButtonToPressed(addToLibraryButton);
    addToLibraryButton.innerHTML += typeOfSave.at(-1) ?? "Watch Later";

  }else{
    setAddToLibraryButtonToNormal(addToLibraryButton);
    addToLibraryButton.innerHTML += "Watch Later";
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

function addEventListenerWithArgs(element,event,handler,...args) {
  const listener = e => handler(e,...args);
  element.addEventListener(event,listener);
  return listener;
}
function removeEventListenerWithArgs(element,event,listener) {
  element.removeEventListener(event,listener);
}


function isMouseOnDiv(div) {
    const rect = div.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}


function isOnLeftBorder(event,ToResizeDiv) {
  const rect = ToResizeDiv.getBoundingClientRect();
  const style = getComputedStyle(ToResizeDiv);
  const borderLeft = parseFloat(style.borderLeftWidth)+10;
  const x = event.clientX - rect.left;

  const onLeftBorder = x < borderLeft;
  return onLeftBorder;
}

function dragResizeDiv(ToResizeDiv) {
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

function calculatingDivRadio(DivElement) {
  return parseFloat(DivElement.style.maxWidth) / window.innerWidth;
}

function moveDiv(event,ToResizeDiv) {
  let leftBorderPos = ToResizeDiv.getBoundingClientRect().left;
  let mousePos = event.clientX; 
  ToResizeDiv.style.maxWidth = parseInt(ToResizeDiv.style.maxWidth) + leftBorderPos-mousePos+"px";
  ToResizeDiv.style.minWidth = parseInt(ToResizeDiv.style.minWidth) + leftBorderPos-mousePos+"px";
}

function addSpaceToTopOfTorrentContainer() {
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

function handleRightClicksForTorrentElement(DownloadTargetInfo) {
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

async function showDownloadInfoInputDiv(DownloadTargetInfo) {
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
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

function setupDownloadDivEvents(DownloadTargetInfo) {
  let cancelButton = DownloadOverlay.querySelector("#cancelBtn");
  let closeBtn = DownloadOverlay.querySelector("#closeBtn");
  let downloadButton = DownloadOverlay.querySelector("#downloadBtn");
  let browseButton = DownloadOverlay.querySelector("#browseBtn");
  let downloadPathInput = DownloadOverlay.querySelector("#downloadPath");
  let rememberPathCheckbox = DownloadOverlay.querySelector("#rememberPath");
  let addSubtitlesCheckbox = DownloadOverlay.querySelector("#addSubtitles");
  
  // Clone and replace elements to remove all event listeners
  const cancelButtonNew = cancelButton.cloneNode(true);
  cancelButton.parentNode.replaceChild(cancelButtonNew, cancelButton);
  
  const closeBtnNew = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(closeBtnNew, closeBtn);
  
  const downloadButtonNew = downloadButton.cloneNode(true);
  downloadButton.parentNode.replaceChild(downloadButtonNew, downloadButton);
  
  const browseButtonNew = browseButton.cloneNode(true);
  browseButton.parentNode.replaceChild(browseButtonNew, browseButton);
  
  // Update references to the new elements
  cancelButton = cancelButtonNew;
  closeBtn = closeBtnNew;
  downloadButton = downloadButtonNew;
  browseButton = browseButtonNew;
  
  // handle closing and canceling buttons event listener
  [cancelButton, closeBtn].forEach((btn) => {
    btn.addEventListener("click", () => {
      DownloadOverlay.classList.remove('active');
    });
  });
  
  // handle the download button event listener
  downloadButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    event.preventDefault();
    console.log(DownloadTargetInfo);
    DownloadTorrent(DownloadTargetInfo, addSubtitlesCheckbox.checked);
    await saveDownloadSettings(downloadPathInput.value, addSubtitlesCheckbox.checked, rememberPathCheckbox.checked);
    DownloadOverlay.classList.remove('active');
  });
  
  // handle browsing fs button
  browseButton.addEventListener("click", async (event) => {
    let pathInputElement = document.getElementById("downloadPath");
    let dirPath = await window.electronAPI.openDirectory_FileSystemBrowser(pathInputElement.value);
    if(dirPath) pathInputElement.value = dirPath;
  });
}

async function loadLogoImage(movieLanguage,apiKey) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${MediaType}/${movieId}/images?api_key=${apiKey}`
  );

  const data = await res.json();

  let originalLanguageLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === movieLanguage) ;
  let englishLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === "en");

  let titleLogo = englishLogos?.[0]?.file_path ?? originalLanguageLogos?.[0]?.file_path ?? null;
  return titleLogo;
}

async function DownloadTorrent(DownloadTargetInfo,downloadSubtitles) {
  const apiKey = await window.electronAPI.getTMDBAPIKEY();
  let userDownloadPath = document.getElementById("downloadPath")?.value;
  let posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  DownloadTargetInfo["posterUrl"] = `https://image.tmdb.org/t/p/w500${posterPath}`;
  DownloadTargetInfo["bgImageUrl"] = backgroundImage;
  DownloadTargetInfo["userDownloadPath"] = userDownloadPath;
  let subsObjects = [];
  if(downloadSubtitles){
    subsObjects = await loadingAllSubs(DownloadTargetInfo.IMDB_ID,DownloadTargetInfo.episodeNumber,DownloadTargetInfo.seasonNumber);
  }

  window.electronAPI.downloadTorrent([DownloadTargetInfo],subsObjects);
}

async function loadDownloadSettings() {
  const Settings = await window.electronAPI.loadSettings();
  return [Settings?.["DefaultDownloadPath"],Settings?.["rememberDownloadLocationByDefault"],Settings?.["DownloadSubtitlesByDefault"]];
}

async function saveDownloadSettings(DefaultDownloadPath, DownloadSubtitlesByDefault, rememberDownloadLocationByDefault) {
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

function focusFunction(element) {
  if (element.classList.contains("div-episodes-Element")) {
    const EpisodeElements = document.querySelectorAll(".div-episodes-Element");

    for(const element of EpisodeElements) {
      if (element.classList.contains("episode_hovered")) {
        element.classList.remove("episode_hovered")
        break;
      }
    }

    element.classList.add("episode_hovered")
    
  } else {
    const TorrentElements = document.querySelectorAll(".div-TorrentMedia");
    for(const element of TorrentElements) {
      if (element.classList.contains("hovered_torrent")) {
        element.classList.remove("hovered_torrent")
        break;
      }
    }
    element.classList.add("hovered_torrent")
  }

  element.focus();
}

manageSaveDropDowns();
addSaveDropDownEventListener();
setupKeyPressesHandler();
handleLibraryButton()
pageInit();
handleDivsResize();
handleFullScreenIcon();
loadIconsDynamically();
handleNavigationButtonsHandler(focusFunction);
