const data = new URLSearchParams(window.location.search);
const MediaId = data.get("MovieId");
const MediaType = data.get("MediaType");
const apiKeyPromise = window.electronAPI.getTMDBAPIKEY();
const IMDB_IDPromise = getIMDB_ID();
const trailerPromise = getMediaTrailer();

let backgroundImage;
let GlobalTitle = null;

const middleDiv = document.getElementById("div-middle");
const torrentSidePanel = document.getElementById("div-torrentSidePanel");
const episodeSidePanel = document.getElementById("div-episodesSidePanel");

const torrentResultsList = document.getElementById("div-movieMedias");
const episodeResultsList = document.getElementById("EpisodesContainer");

const selectSeasonContainer = document.querySelector(".selectSeason-container");
const selectSeason = document.getElementById("select-Seasons");
const selectSave = document.getElementById("select-save");

const toggleTorrentContainer = document.querySelector(".toggleButton");

const divCastElement = document.getElementById("div-castInfos");
const divDirectoryElement = document.getElementById("div-directorInfos");

const addToLibraryButton = document.querySelector(".split-save-btn__main");

const contextMenu = document.querySelector("#contextMenu");
const DownloadOverlay = document.getElementById('downloadOverlay');

const globalLoadingGif = document.getElementById("div-globlaLoadingGif");

torrentSidePanel.classList.add("preloadingTorrent");
if(MediaType === "movie") torrentSidePanel.classList.add("visible-block");

const seasonsDivArray = [];

async function pageInit() {
  const results = await Promise.allSettled([
    loadMovieInformation(),
    loadCastInformation()
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

async function loadMovieInformation() {
  try {
    const apiKey = await apiKeyPromise;
    const url = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;
    const res = await fetch(url);
    const mediaInfo = await res.json();
    await renderMediaPage(mediaInfo);
    if(MediaType === "movie") {
      await fetchMediaTorrent(); 
    }
  } catch(err) {
    console.error(err);
    throw err;
  }
}

async function loadCastInformation() {
  try {
    const apiKey = await apiKeyPromise;
    const url = `https://api.themoviedb.org/3/${MediaType}/${MediaId}/credits?api_key=${apiKey}`;
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

async function loadAllEpisodesOfSeason(season_number,title) {
  try {
    const apiKey = await apiKeyPromise;
    const libraryInfo = await loadMediaEntryPointLibraryInfo();
    const url = `https://api.themoviedb.org/3/tv/${MediaId}/season/${season_number}?api_key=${apiKey}`;
    const res = await fetch(url);
    const episodesData = await res.json();
    await renderEpisodes(episodesData,title,libraryInfo?.[0]);

  } catch(err) {
    console.error(err.message)
    episodeResultsList.innerHTML = "";
    const NothingWasFound = document.createElement("span");
    NothingWasFound.innerHTML = "No Results Were Found !";
    episodeSidePanel.classList.add("visible-flex");
    episodeResultsList.appendChild(NothingWasFound);
  }
}

function renderEpisodes(data,title,libraryInfo) {
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
      const continueWatchingBtn = createContinueWatchingBtn(libraryInfo);
      EpisodeElement.classList.add("continue_wathing_episode");
      EpisodeElement.appendChild(continueWatchingBtn)
      EpisodeElement.classList.add("continue-watching-highlight");
    }

    createEpisodeEventListeners(SeasonDiv, EpisodeElement, episode);
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

function createEpisodeEventListeners(SeasonDiv, EpisodeElement, episodeInfo) {
  EpisodeElement.addEventListener("mouseenter",() => {
    EpisodeElement.classList.add("episode_hovered")
  });

  EpisodeElement.addEventListener("mouseleave",()=>{
    EpisodeElement.classList.remove("episode_hovered")
  });

  EpisodeElement.addEventListener("click",async () => {
    handleEpisodeElementColoring(SeasonDiv,EpisodeElement);
    try {
      torrentSidePanel.classList.add("preloadingTorrent");
      const defaultRatio = await getDefaultRatio();
      resizeTorrentAndEpisodeElement(defaultRatio,episodeResultsList);
      resizeTorrentAndEpisodeElement(defaultRatio,torrentResultsList);

      document.documentElement.classList.add("torrent-panel-open");
      torrentResultsList.innerHTML = "";

      fetchMediaTorrent ({
        seasonNumber:String(episodeInfo.season_number).padStart(2,"0"),
        episodeNumber:String(episodeInfo.episode_number).padStart(2,"0")
      });
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

async function fetchMediaTorrent(episodeInfo={}) {
  let libraryInfo = await loadMediaEntryPointLibraryInfo();

  try {
    const imdb_id = await IMDB_IDPromise;
    const url = (MediaType === "tv") 
      ? `https://torrentio.strem.fun/stream/series/${imdb_id}:${episodeInfo.seasonNumber}:${episodeInfo.episodeNumber}.json`
      : `https://torrentio.strem.fun/stream/movie/${imdb_id}.json`;

    const mediaTorrentRes = await fetch(url);
    const mediaTorrentInformation = await mediaTorrentRes.json();
    await renderMediaTorrent(mediaTorrentInformation, libraryInfo?.[0],episodeInfo);

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
      const refreshButton = createRefreshTorrentBtn();
      nothingWasFoundDiv.appendChild(refreshButton);
    }

    torrentResultsList.innerHTML = "";
    torrentSidePanel.classList.remove("preloadingTorrent");
    torrentResultsList.classList.add("visible-flex");
    torrentResultsList.appendChild(nothingWasFoundDiv);
  }
}

async function getIMDB_ID() {
  const apiKey = await apiKeyPromise;
  const mediaExternalIdsRes = await fetch(
    `https://api.themoviedb.org/3/${MediaType}/${MediaId}/external_ids?api_key=${apiKey}`
  );
  const mediaExternalIdsData = await mediaExternalIdsRes.json();
  return mediaExternalIdsData?.imdb_id
}

async function getMediaTrailer() {
  const apiKey = await apiKeyPromise;
  const res = await fetch(`https://api.themoviedb.org/3/${MediaType}/${MediaId}/videos?api_key=${apiKey}`);
  if(res.ok) {
    const data = await res.json();
    const trailers = data.results.filter(
      video => video.type === "Trailer" && video.site === "YouTube" && video.official
    );
    for(const trailer of trailers) {
      const videoUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${videoUrl}&format=json`
      );
      if(res.ok)
        return trailer.key;
    }
    return null;
  }
}

function createRefreshTorrentBtn() {
  const refreshButton = document.createElement("button");
  refreshButton.className = "btn-refreshAfterWarningMessage";
  refreshButton.innerHTML = reloadIcon;
  refreshButton.addEventListener("click",() => {
    torrentResultsList.innerHTML = "";
    torrentSidePanel.classList.add("preloadingTorrent");

    setTimeout(() => {
      fetchMediaTorrent();
    },1000);
  });
  return refreshButton;
}

async function renderMediaPage(data) {
  const [Title,Duration,ReleaseYear,Rating,Adult,Genres,logoFileName,Summary,Seasons] = 
    await extractMediaInfoFromApiResponse(data);

  GlobalTitle = Title;
  document.title = Title;
  addBackgroundImageToBody(backgroundImage);
  addImdbRatingEventListener();
  addTrailerEventListener();
  insertLogoTitleInformation(logoFileName,Title);

  const mediaGeneraleInfo = [Duration,ReleaseYear,Rating,Summary];
  await insertMediaGeneraleInformation(mediaGeneraleInfo);
  insertGenresOfMedia(Genres);

  if(Duration === "TV Show") torrentResultsList.classList.add("hidden");
  else episodeResultsList.classList.add("hidden");

  if(Seasons) {
    episodeSidePanel.classList.add("visible-flex");
    const seasonsNumbers = Seasons.map(season => {
      const [newOption,seasonNumber] = createSeasonOptionElement(season);
      selectSeason.appendChild(newOption);
      return seasonNumber;
    });

    (async() => {
      for(const seasonNumber of seasonsNumbers) {
        await loadAllEpisodesOfSeason(seasonNumber,Title);
      }
    })().then(async() => {
      const seasonToDisplay = (await loadCachedSeasonNumber()) ?? 1;
      const cachedEpisodeNumber = await loadCachedEpisodeNumber();
      displaySeason(seasonToDisplay);
      if(cachedEpisodeNumber)
        document.querySelectorAll(".div-episodes-Element")[cachedEpisodeNumber - 1].click();
    });

    addSeasonsDropDownEventListener()

  } else {
    torrentResultsList.classList.add("visible-block");
    selectSeasonContainer.classList.add("hidden");
  }

  dropDownInit();
  globalLoadingGif.remove();

  middleDiv.classList.add("activate");
}

async function extractMediaInfoFromApiResponse(data){
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

  const logoFileName = await loadLogoImage(mediaOriginalLanguage);
  const Seasons = data?.seasons ?? 0;
  return [Title,Duration,ReleaseYear,Rating,Adult,Genres,logoFileName,Summary,Seasons];
}

function insertLogoTitleInformation(logoFileName,Title){
  const logoTitleContainer = document.getElementById("div-MovieLogoTitleContainer");
  const textTitleElement = document.getElementById("h1-MovieTitle");
  const logoTitleElement = document.getElementById("img-MovieLogoTitle");

  if(logoFileName){
    let logoImage = `https://image.tmdb.org/t/p/original/${logoFileName}`;
    logoTitleElement.src = logoImage;
    textTitleElement.classList.add("hidden");
    addInspectBackdropImage(logoTitleContainer);
  } else {
    logoTitleContainer.classList.add("hidden");
    addInspectBackdropImage(textTitleElement);
  }

  textTitleElement.innerText = Title;
}

async function insertMediaGeneraleInformation(mediaBasicInfo) {
  const mediaDurationElement = document.getElementById("p-movieDuration");
  const mediaYearOfReleaseElement = document.getElementById("p-movieYearOfRelease");
  const mediaRatingElement = document.getElementById("p-movieRating");
  const mediaSummaryElement = document.getElementById("p-summaryParagraph");
  const imdbLogoElement = document.getElementById("img-IMDBlogo");
  const mediaTrailerElement = document.getElementById("movie-trailer-div");

  const [Duration,ReleaseYear,Rating,Summary] = mediaBasicInfo;
  const trailerKey = await trailerPromise;
  let summaryExist = true;
  if(!Duration) mediaDurationElement.classList.add("hidden");
  if(!ReleaseYear) mediaYearOfReleaseElement.classList.add("hidden");
  if(!Rating || Rating === "0.0"){
    mediaRatingElement.classList.add("hidden");
    imdbLogoElement.classList.add("hidden");
  }
  if(trailerKey == null || trailerKey.trim == "") {
    mediaTrailerElement.classList.add("hidden");
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

async function addImdbRatingEventListener() {
  const IMDB_RatingElement = document.getElementById("movie-rating-div");
  const imdb_id = await IMDB_IDPromise;
  if(imdb_id == null) {
    IMDB_RatingElement.classList.add("inactive");
    return;
  }
  IMDB_RatingElement.addEventListener("click", async() => {
    const imdbLink = `https://www.imdb.com/title/${imdb_id}`;
    console.log(`Opening IMDB link: ${imdbLink}`);
    window.electronAPI.openExternalLink(imdbLink);
  });
}

async function addTrailerEventListener() {
  const trailerKey = await trailerPromise;
  const trailerDiv = document.getElementById("movie-trailer-div");
  if(trailerKey == null || trailerKey.trim == "")
    return;
  trailerDiv.addEventListener("click", async() => {
    const trailerLink = `https://www.youtube.com/watch?v=${trailerKey}`;
    console.log(`Opening Trailer link: ${trailerLink}`);
    window.electronAPI.openExternalLink(trailerLink);
  });
}

function addInspectBackdropImage(titleElement) {
  const toggleBackdropInspection = (inspect) => {
    const mainDiv = document.getElementById("div-main");
    mainDiv.classList.toggle("backdrop-inspecting", inspect);
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
  const DivGenresContainer = document.getElementById("div-genresInfos");
  for(let genre of Genres){
    const newGenreElement = document.createElement("button");
    newGenreElement.onclick = ()=>{openDiscoveryPage(genre.id,MediaType)};
    newGenreElement.classList.add("btn-MovieDetailsButtons");
    newGenreElement.innerText = genre.name;
    DivGenresContainer.append(newGenreElement);
  }
}

function createSeasonOptionElement(season){
  const name = season.name;
  const seasonNumber = season.season_number;
  const newOption = document.createElement("div");
  newOption.classList.add("select-option");
  newOption.setAttribute("role","option");
  newOption.setAttribute("value",seasonNumber);
  newOption.innerText = name;
  return [newOption,seasonNumber];
}

function addSeasonsDropDownEventListener() {
  selectSeason.addEventListener("dropdownChange",()=>{
    const newDropDownValue = getDropdownValue(selectSeason);
    displaySeason(newDropDownValue);
  });
}

function addSaveDropDownEventListener() {
  selectSave.addEventListener("dropdownChange",(event)=>{
    const newDropDownValue = getDropdownValue(selectSave);
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
    applyBackground(document.querySelector('#movie-trailer-div').style, 0.8);
    // applyBackground(document.querySelector('#bottomButtonsDiv').style, 0.6);
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
  for(const directorObject of DirectorsObjects) {
    if(!loadedDirectors.includes(directorObject.id)) {
      const newDirectorElement = document.createElement("button");
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
  for(const castObject of MainCastObjects) {
    if(
      !loadedCast.includes(castObject.id) &&
      castObject.name.trim() !== ""
    ) {
      const newCastElement = document.createElement("button");
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

async function renderMediaTorrent(data, MediaLibraryInfo, episodeInfo = {}) {
  torrentResultsList.innerHTML = "";
  addSpaceToTopOfTorrentContainer();
  const imdb_id = await IMDB_IDPromise;

  data.streams.forEach(torrentInfo => {
    const { quality, title, size, seedersNumber, fileName, magnetLink } = parseTorrentInfo(torrentInfo);
    if (fileName.trim() !== "") {
      const infoToDisplay = [quality, title, size, seedersNumber];
      const advancedInfo = [MediaId, MediaType, fileName, magnetLink, imdb_id,
                            backgroundImage, episodeInfo, size, quality, title];
      const torrentElement = createTorrentElement(infoToDisplay, advancedInfo);

      const isCurrentlyWatching = 
        MediaLibraryInfo?.typeOfSave?.includes("Currently Watching") &&
        String(magnetLink) === String(MediaLibraryInfo["Magnet"]) &&
        String(episodeInfo.seasonNumber) === String(MediaLibraryInfo["seasonNumber"]) &&
        String(episodeInfo.episodeNumber) === String(MediaLibraryInfo["episodeNumber"]);

      if (isCurrentlyWatching) createContinueWatchingBtn(torrentElement, MediaLibraryInfo);

      torrentResultsList.append(torrentElement);
    }
  });

  if (torrentResultsList.innerHTML.trim() === "")
    throw new Error("No Useful Results Were found !");

  await loadIconsDynamically();
  const torrentScrollValue = await loadCachedTorrentsScrollValue();
  document.getElementById("div-movieMedias").scrollTop = torrentScrollValue
  torrentSidePanel.classList.remove("preloadingTorrent");
}

function createTorrentElement(torrentInfoToDisplay, torrentAdvancedInfo) {
  const [Quality, Title, Size, SeedersNumber] = torrentInfoToDisplay;
  const TorrentElement = document.createElement("div");
  TorrentElement.classList.add("div-TorrentMedia");
  TorrentElement.setAttribute("tabindex", "0");

  const qualityDiv = document.createElement("div");
  qualityDiv.classList.add("div-MediaQuality");

  const qualityP = document.createElement("p");
  qualityP.textContent = Quality;
  qualityDiv.appendChild(qualityP);

  const descriptionDiv = document.createElement("div");
  descriptionDiv.classList.add("div-MediaDescription");

  const titleP = document.createElement("p");
  titleP.textContent = Title;

  const infoDiv = document.createElement("div");
  infoDiv.classList.add("torrent-info-div");

  const storageIcon = document.createElement("div");
  storageIcon.classList.add("div-storageImage");

  const seedIcon = document.createElement("div");
  seedIcon.classList.add("div-seedImage");

  const sizeText = document.createTextNode(` ${Size} \u00A0\u00A0`);
  const seedText = document.createTextNode(` ${SeedersNumber}`);

  infoDiv.appendChild(storageIcon);
  infoDiv.appendChild(sizeText);
  infoDiv.appendChild(seedIcon);
  infoDiv.appendChild(seedText);

  descriptionDiv.appendChild(titleP);
  descriptionDiv.appendChild(infoDiv);

  TorrentElement.appendChild(qualityDiv);
  TorrentElement.appendChild(descriptionDiv);

  addTorrentElementEventListener(TorrentElement,torrentAdvancedInfo);
  addFloatingDivToDisplayFullTitle(TorrentElement, ".div-MediaDescription p");

  return TorrentElement;
}

function addTorrentElementEventListener(TorrentElement, torrentsInfo) {
  const [MediaId, MediaType, fileName, MagnetLink, IMDB_ID,
       backgroundImage, episodeInfo, Size, Quality, Title] = torrentsInfo;

  TorrentElement.addEventListener("click",()=>{
    openMediaVideo(undefined,MediaId,MediaType,undefined,fileName,MagnetLink,IMDB_ID,backgroundImage,episodeInfo);
  });
 
  // right click handeling
  TorrentElement.addEventListener("mousedown",(event)=>{
    if (event.button === 2) {
      const mediaTitle = document.getElementById("h1-MovieTitle").innerText;
      const mediaReleaseYear = document.getElementById("p-movieYearOfRelease").innerText;
      const DownloadTargetInfo = {
        IMDB_ID:IMDB_ID, Title:mediaTitle, Size:Size,
        Quality:Quality, Year:mediaReleaseYear, MagnetLink:MagnetLink,
        fileName:fileName,dirName:Title, MediaId:MediaId, MediaType:MediaType,
        seasonNumber:episodeInfo.seasonNumber,episodeNumber:episodeInfo.episodeNumber
      };
      setupDownloadDivEvents(DownloadTargetInfo);
      handleRightClicksForTorrentElement(DownloadTargetInfo);
    }
  });
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

function displaySeason(seasonIndex) {
  const currentSeasonDiv = seasonsDivArray.find(div => 
    parseInt(div.getAttribute("season_number")) === parseInt(seasonIndex)
  );
  if(currentSeasonDiv){
    episodeResultsList.classList.remove("hidden");
    episodeResultsList.classList.add("visible-block");
    episodeResultsList.innerHTML = "";
    setDropdownValue(selectSeason,seasonIndex);
    episodeResultsList.appendChild(currentSeasonDiv);
  }
}

async function getDefaultRatio() {
  const systemSettings = await window.electronAPI.loadSettings();
  return systemSettings?.defaultDivRadio ?? 0.3;
}

async function handleDivsResize() {
  const defaultRatio = await getDefaultRatio();

  resizeTorrentAndEpisodeElement(defaultRatio,episodeResultsList);
  resizeTorrentAndEpisodeElement(defaultRatio,torrentResultsList);

  window.addEventListener("resize",(event)=>{
    resizeTorrentAndEpisodeElement(defaultRatio,episodeResultsList);
    resizeTorrentAndEpisodeElement(defaultRatio,torrentResultsList);
  });

  dragResizeDiv(episodeResultsList);
  dragResizeDiv(torrentResultsList);

  [episodeResultsList,torrentResultsList].forEach(ToResizeDiv => {
    window.addEventListener("mousemove",(event)=>{
      const onLeftBorder = isOnLeftBorder(event,ToResizeDiv); 
      const mouseTopOfDiv = isMouseOnDiv(ToResizeDiv);
      if(onLeftBorder && mouseTopOfDiv){
        ToResizeDiv.classList.add("cursor-resize");
        ToResizeDiv.classList.remove("cursor-default-override");
      }else{
        ToResizeDiv.classList.remove("cursor-resize");
        ToResizeDiv.classList.add("cursor-default-override");
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
  ToggleInLibrary(addToLibraryButton, MediaId, MediaType, GlobalTitle, undefined,typeOfSave, setAsPressed);
  addToLibraryButton.innerHTML += 
    addToLibraryButton.hasAttribute("pressed") ?
    typeOfSave ?? "Watch Later" 
    : "Watch Later";
}

function loadMediaEntryPointLibraryInfo() {
  return window.electronAPI.loadMediaLibraryInfo({MediaId:MediaId, MediaType:MediaType})
    .catch((err)=>{
      console.error(err);
      return [];
    });
}

async function handleLibraryButton() {
  const MediaLibraryInfo = await loadMediaEntryPointLibraryInfo();
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
  torrentResultsList.classList.add("hidden");
  torrentResultsList.classList.remove("visible-flex", "visible-block");
  document.documentElement.classList.remove("torrent-panel-open");

  // clearing the coloring of all the episode Elements
  const SeasonDiv = document.getElementById("main-SeasonDiv");
  handleEpisodeElementColoring(SeasonDiv,undefined) 
});

function addEventListenerWithArgs(element,event,handler,...args) {
  const listener = e => handler(e,...args);
  element.addEventListener(event,listener);
  return listener;
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
      const listener = addEventListenerWithArgs(window,"mousemove",moveDiv,ToResizeDiv);
      window.addEventListener("mouseup",async()=>{
        const systemSettings = await window.electronAPI.loadSettings();
        systemSettings["defaultDivRadio"] = calculatingDivRadio(ToResizeDiv);
        await window.electronAPI.applySettings(systemSettings);
        window.removeEventListener("mousemove",listener);
      },{once:true});
    }
  });
}

function calculatingDivRadio(DivElement) {
  return parseFloat(DivElement.style.maxWidth) / window.innerWidth;
}

function moveDiv(event,ToResizeDiv) {
  const leftBorderPos = ToResizeDiv.getBoundingClientRect().left;
  const mousePos = event.clientX; 
  ToResizeDiv.style.maxWidth = parseInt(ToResizeDiv.style.maxWidth) + leftBorderPos-mousePos+"px";
  ToResizeDiv.style.minWidth = parseInt(ToResizeDiv.style.minWidth) + leftBorderPos-mousePos+"px";
}

function addSpaceToTopOfTorrentContainer() {
  const dummyDiv = document.getElementById("dummyDiv");
  const selectSeasonContainerHeight = selectSeasonContainer.offsetHeight;

  if(selectSeasonContainerHeight > 0){
    dummyDiv.style.height = selectSeasonContainerHeight+"px";
    torrentSidePanel.style.paddingBottom = selectSeasonContainerHeight+"px";
  }else{
    dummyDiv.style.height = "15px";
    torrentSidePanel.style.paddingBottom = "15px";
  }
}

function handleRightClicksForTorrentElement(DownloadTargetInfo) {
  const DownloadOption = contextMenu.querySelector("#DownloadOption");

  DownloadOption.addEventListener("mousedown",() => {
    showDownloadInfoInputDiv(DownloadTargetInfo),
    {once:true}
  });

  contextMenu.style.top = event.pageY + "px";
  contextMenu.style.left = event.pageX + "px";
  contextMenu.classList.add("context-menu--visible");
  dontGoBack = true;

  event.stopImmediatePropagation();
  event.preventDefault();
  event.stopPropagation();
}

async function showDownloadInfoInputDiv(DownloadTargetInfo) {
  const apiKey = await apiKeyPromise;
  const [defaultPath, rememberDownloadLocation, DownloadSubtitles] = await loadDownloadSettings();
  const MediaPosterContainer = DownloadOverlay.querySelector("#mediaPoster");
  const MediaPosterElement = DownloadOverlay.querySelector("#mediaPosterImg");
  const MediaTitleElement = DownloadOverlay.querySelector("#mediaTitle");
  const SeasonEpisodeElement = DownloadOverlay.querySelector("#season-episode");
  const MediaYearTextElement = DownloadOverlay.querySelector("#mediaYear");
  const MediaSizeAResolutionTextElement = DownloadOverlay.querySelector("#mediaSize");
  const downloadPathInput = DownloadOverlay.querySelector("#downloadPath");
  const rememberPathCheckbox = DownloadOverlay.querySelector("#rememberPath");
  const addSubtitlesCheckbox = DownloadOverlay.querySelector("#addSubtitles");


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
  const posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  loadImageWithAnimation(MediaPosterContainer, MediaPosterElement, `https://image.tmdb.org/t/p/w185${posterPath}`);
}

function freshClone(El) {
  const clone = El.cloneNode(true);
  El.parentNode.replaceChild(clone, El);
  return clone;
}

function setupDownloadDivEvents(DownloadTargetInfo) {
  const downloadPathInput = DownloadOverlay.querySelector("#downloadPath");
  const rememberPathCheckbox = DownloadOverlay.querySelector("#rememberPath");
  const addSubtitlesCheckbox = DownloadOverlay.querySelector("#addSubtitles");
  
  // Update references to the new elements
  const cancelButton = freshClone(DownloadOverlay.querySelector("#cancelBtn"));
  const closeBtn = freshClone(DownloadOverlay.querySelector("#closeBtn"));
  const downloadButton = freshClone(DownloadOverlay.querySelector("#downloadBtn"));
  const browseButton = freshClone(DownloadOverlay.querySelector("#browseBtn"));
  
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
    DownloadTorrent(DownloadTargetInfo, addSubtitlesCheckbox.checked);
    await saveDownloadSettings(downloadPathInput.value, addSubtitlesCheckbox.checked, rememberPathCheckbox.checked);
    DownloadOverlay.classList.remove('active');
  });
  
  // handle browsing fs button
  browseButton.addEventListener("click", async (event) => {
    const pathInputElement = document.getElementById("downloadPath");
    const dirPath = await window.electronAPI.openDirectory_FileSystemBrowser(pathInputElement.value);
    if(dirPath) pathInputElement.value = dirPath;
  });
}

async function DownloadTorrent(DownloadTargetInfo,downloadSubtitles) {
  const apiKey = await apiKeyPromise;
  const userDownloadPath = document.getElementById("downloadPath")?.value;
  const posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  DownloadTargetInfo["posterUrl"] = `https://image.tmdb.org/t/p/w500${posterPath}`;
  DownloadTargetInfo["bgImageUrl"] = backgroundImage;
  DownloadTargetInfo["userDownloadPath"] = userDownloadPath;
  const subsObjects = 
    (downloadSubtitles) 
    ? await loadingAllSubs(
      DownloadTargetInfo.IMDB_ID,
      DownloadTargetInfo.episodeNumber,
      DownloadTargetInfo.seasonNumber
    ) : [];

  window.electronAPI.downloadTorrent([DownloadTargetInfo],subsObjects);
}

async function loadLogoImage(movieLanguage) {
  const apiKey = await apiKeyPromise;
  const res = await fetch(
    `https://api.themoviedb.org/3/${MediaType}/${MediaId}/images?api_key=${apiKey}`
  );
  const data = await res.json();
  const originalLanguageLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === movieLanguage) ;
  const englishLogos = data?.logos.filter(imageObj => imageObj?.iso_639_1 === "en");
  return (
    englishLogos?.[0]?.file_path ??
    originalLanguageLogos?.[0]?.file_path ??
    null
  );
}

async function loadDownloadSettings() {
  const Settings = await window.electronAPI.loadSettings();
  return [
    Settings?.["DefaultDownloadPath"],
    Settings?.["rememberDownloadLocationByDefault"],
    Settings?.["DownloadSubtitlesByDefault"]
  ];
}

async function saveDownloadSettings(
  DefaultDownloadPath,
  DownloadSubtitlesByDefault,
  rememberDownloadLocationByDefault
) {
  const Settings = await window.electronAPI.loadSettings();
  Settings["rememberDownloadLocationByDefault"] = rememberDownloadLocationByDefault;
  Settings["DownloadSubtitlesByDefault"] = DownloadSubtitlesByDefault;
  if(rememberDownloadLocationByDefault)
    Settings["DefaultDownloadPath"] = DefaultDownloadPath;

  window.electronAPI.applySettings(Settings);
}

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

async function loadCachedInformations() {
  setTimeout(async() => {
    const episodeScrollValue = await loadCachedEpisodesScrollValue();
    const torrentScrollValue = await loadCachedTorrentsScrollValue();
    const episodeNumber = await loadCachedEpisodeNumber();

    const targetEpisode = document.querySelectorAll(".div-episodes-Element")[episodeNumber-1];

    document.getElementById("episodeResultsList").scrollTop = episodeScrollValue;
    if(targetEpisode)
      targetEpisode.click();


    setTimeout(()=>{
      document.getElementById("div-movieMedias").scrollTop = torrentScrollValue
      console.log(episodeScrollValue);
      console.log(torrentScrollValue);
    },90);
  },90);
}

async function loadCachedTorrentsScrollValue() {
  const cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const torrentContainerTopScroll = cachedData?.torrent_container_scroll_value;
  return torrentContainerTopScroll;
}

async function loadCachedEpisodeNumber() {
  const cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const episodeNumber = cachedData?.loaded_episode;
  return episodeNumber;
}

async function loadCachedSeasonNumber() {
  const cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const seasonNumber = cachedData?.loaded_season;
  return seasonNumber;
}

async function loadCachedEpisodesScrollValue() {
  const cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  const episodesContainerTopScroll = cachedData?.serie_episodes_scroll_value;
  return episodesContainerTopScroll;
}

document.addEventListener("mousedown", event => {
  contextMenu.classList.remove("context-menu--visible");
  dontGoBack = false;
});

window.addEventListener("keydown",(event)=>{
  if(event.key === "Escape"){
    contextMenu.classList.remove("context-menu--visible");
    DownloadOverlay.classList.remove('active');
  }
});

function triggerLoadingGif() {
  setTimeout(() => {
    try{globalLoadingGif.classList.add("loading-gif--visible")}
    catch(err){console.error(err)}
  },100);
}

(async() => {
  if(await loadCachedEpisodeNumber())
    document.documentElement.classList.add("torrent-panel-open");
})();

triggerLoadingGif();
manageSaveDropDowns();
addSaveDropDownEventListener();
setupKeyPressesHandler();
handleLibraryButton()
pageInit();
handleDivsResize();
handleFullScreenIcon();
loadIconsDynamically();
handleNavigationButtonsHandler(focusFunction);
