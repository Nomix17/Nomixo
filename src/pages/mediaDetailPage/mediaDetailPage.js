const data = new URLSearchParams(window.location.search);
const MediaId = data.get("MovieId");
const MediaType = data.get("MediaType");
const apiKeyPromise = window.electronAPI.getTMDBAPIKEY();
const IMDB_IDPromise = getIMDB_ID(MediaType, MediaId, apiKeyPromise);
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

const bulkOverlay = document.getElementById("bulkDownloadOverlay");
const bulkContainer = document.getElementById("bulkContainer");
const bulkCloseBtn = document.getElementById("bulkCloseBtn");
const bulkSubtitle = document.getElementById("bulkSubtitle");
const bulkQualitySelect = document.getElementById("bulkQuality");
const bulkSelectAllBtn = document.getElementById("bulkSelectAll");
const bulkClearAllBtn = document.getElementById("bulkClearAll");
const bulkSeasonList = document.getElementById("bulkSeasonList");
const bulkPathInput = document.getElementById("bulkDownloadPath");
const bulkBrowseBtn = document.getElementById("bulkBrowseBtn");
const bulkRememberCheckbox = document.getElementById("bulkRememberPath");
const bulkSubtitlesCheckbox = document.getElementById("bulkAddSubtitles");
const bulkSummary = document.getElementById("bulkSummary");
const bulkMessage = document.getElementById("bulkMessage");
const bulkCancelBtn = document.getElementById("bulkCancelBtn");
const bulkDownloadBtn = document.getElementById("bulkDownloadBtn");
const bulkEpisodeList = document.getElementById("bulkEpisodeList");
const bulkPanelTitle = document.getElementById("bulkPanelTitle");
const bulkPanelMeta = document.getElementById("bulkPanelMeta");
const bulkSeasonToggle = document.getElementById("bulkSeasonToggle");
const bulkProgress = document.getElementById("bulkProgress");
const bulkProgressBar = document.getElementById("bulkProgressBar");
const bulkHeroImage = document.getElementById("bulkHeroImage");
const bulkHeroLogo = document.getElementById("bulkHeroLogo");

torrentSidePanel.classList.add("preloadingTorrent");
if(MediaType === "movie") torrentSidePanel.classList.add("visible-block");

const MAX_NUMBER_OF_DIRECTORS = 5;
const MAX_NUMBER_OF_CAST_MEMBERS = null; //12;

const seasonsDivArray = [];
const seasonsEpisodesData = {};
const seasonNames = {};

async function pageInit() {
  const results = await Promise.allSettled([
    loadMovieInformation(),
    loadCastInformation()
  ]);

  if (results[0].status === "rejected") {
    document.documentElement.classList.add("fetchingFailed");
    handleFetchingError(results[0].reason);
  }
}

async function fetchTMDBJson(url) {
  const res = await fetch(url);
  let json = null;
  try { json = await res.json(); } catch {}

  if (json?.status_code === 7 || res.status === 401)
    throw new Error("We're having trouble loading data.</br>Please make sure TMDB Key is valide!");
  if (res.status === 404 || json?.status_code === 34)
    throw new Error("We couldn't find this title.<br>It may have been removed, try a different one");
  if (!res.ok || !json)
    throw new Error(`We're having trouble loading data.</br>TMDB responded with an error (${res.status}), please retry!`);

  return json;
}

async function loadMovieInformation() {
  try {
    const apiKey = await apiKeyPromise;
    const url = `https://api.themoviedb.org/3/${MediaType}/${MediaId}?api_key=${apiKey}`;
    const mediaInfo = await fetchTMDBJson(url);
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
    const castData = await fetchTMDBJson(url);
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
    const episodesData = await fetchTMDBJson(url);
    await renderEpisodes(episodesData,title,libraryInfo?.[0]);

  } catch(err) {
    console.error(err.message)
    episodeResultsList.innerHTML = "";
    addNothingWasFoundMessage(
      episodeResultsList, err.message,
      "Failed To Fetch Episodes, Please try again",
      refreshEpisodes
    );
  }
}

function addNothingWasFoundMessage(parent, message, defaultMsg, refreshCallback) {
  const isNoResultsError =
    message === "No Useful Results Were found !" ||
    message === "No Results Were found !";

  const nothingWasFoundDiv = document.createElement("div");
  nothingWasFoundDiv.classList.add("div-NothingWasFound");
  addNothingWasFoundDivMargin(nothingWasFoundDiv);
  nothingWasFoundDiv.textContent = 
    isNoResultsError
    ? message
    : defaultMsg;

  if (!isNoResultsError) {
    const refreshButton = createRefreshBtn(refreshCallback);
    nothingWasFoundDiv.appendChild(refreshButton);
  }

  parent.classList.remove("hidden");
  parent.classList.add("visible-flex");
  parent.appendChild(nothingWasFoundDiv);
}

function renderEpisodes(data,title,libraryInfo) {
  const SeasonDiv = document.createElement("div");
  SeasonDiv.id = "main-SeasonDiv";

  const episodes = data.episodes;

  const bulkSeasonKey = data.season_number ?? episodes?.[0]?.season_number;
  if(bulkSeasonKey != null) {
    seasonsEpisodesData[bulkSeasonKey] = episodes.map(episode => ({
      season_number: episode.season_number,
      episode_number: episode.episode_number,
      name: episode.name,
      air_date: episode.air_date
    }));
  }
  episodes.forEach(episode =>{
    const episodeImageUrl = episode.still_path 
      ? `https://image.tmdb.org/t/p/w342/${episode.still_path}` 
      : notFoundSvgPaths["EpisodeNotFound"];

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
    "EpisodeNotFound"
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
      addSpaceToTopOfTorrentContainer();

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
  try {
    const imdb_id = await IMDB_IDPromise;
    const seasonNum = Number(episodeInfo.seasonNumber);
    const episodeNum = Number(episodeInfo.episodeNumber);
    const url = (MediaType === "tv")
      ? `https://torrentio.strem.fun/stream/series/${imdb_id}:${seasonNum}:${episodeNum}.json`
      : `https://torrentio.strem.fun/stream/movie/${imdb_id}.json`;

    const [libraryInfo, mediaTorrentInformation] = await Promise.all([
      loadMediaEntryPointLibraryInfo(),
      fetch(url).then(res => res.json())
    ]);
    await renderMediaTorrent(mediaTorrentInformation, libraryInfo?.[0],episodeInfo);

  } catch (error) {
    console.error(error);
    torrentResultsList.innerHTML = "";
    torrentSidePanel.classList.remove("preloadingTorrent");
    addNothingWasFoundMessage(
      torrentResultsList, error?.message,
      "Failed To Fetch Torrents, Please try again",
      refreshTorrent
    );
  }
}

async function getMediaTrailer() {
  try {
    const apiKey = await apiKeyPromise;
    const res = await fetch(`https://api.themoviedb.org/3/${MediaType}/${MediaId}/videos?api_key=${apiKey}`);
    if(!res.ok) return null;

    const data = await res.json();
    const trailers = (data.results ?? []).filter(
      video => video.type === "Trailer" && video.site === "YouTube" && video.official
    );

    return await Promise.any(
      trailers.map(async trailer => {
        const videoUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${videoUrl}&format=json`);
        if(!oembedRes.ok) throw new Error("Invalid trailer");
        return trailer.key;
      })
    );
  } catch {
    return null;
  }
}

function createRefreshBtn(refreshCallback) {
  const refreshButton = document.createElement("button");
  refreshButton.className = "btn-refreshAfterWarningMessage";
  refreshButton.innerHTML = reloadIcon;
  refreshButton.addEventListener("click", refreshCallback);
  return refreshButton;
}

function refreshTorrent() {
  torrentResultsList.innerHTML = "";
  torrentSidePanel.classList.add("preloadingTorrent");
  setTimeout(() => {
    fetchMediaTorrent();
  },1000);
}

function refreshEpisodes() {
  episodeResultsList.innerHTML = "";
  episodeResultsList.classList.add("preloadingEpisodes");
  setTimeout(() => {
    loadAllEpisodesOfSeason(getDropdownValue(selectSeason), GlobalTitle);
  },1000);
}

async function renderMediaPage(data) {
  const [
    Title, Duration, ReleaseYear, Rating, Adult,
    Genres, logoFileName, Summary, Seasons, Collection
  ] = await extractMediaInfoFromApiResponse(data);

  GlobalTitle = Title;
  document.title = `${Title} - Nomixo`;
  addBackgroundImageToBody(backgroundImage);
  addImdbRatingEventListener();
  addTrailerEventListener();
  insertLogoTitleInformation(logoFileName,Title);

  const mediaGeneraleInfo = [Duration,ReleaseYear,Rating,Summary];
  await insertMediaGeneraleInformation(mediaGeneraleInfo);
  insertGenresOfMedia(Genres);
  insertCollectionOfMedia(Collection);

  if(Duration === "TV Show") torrentResultsList.classList.add("hidden");
  else episodeResultsList.classList.add("hidden");

  if(Seasons) {
    episodeSidePanel.classList.add("visible-flex");
    document.getElementById("bulk-download-div").style.display = "";
    const seasonsNumbers = Seasons.map(season => {
      const [newOption,seasonNumber] = createSeasonOptionElement(season);
      selectSeason.appendChild(newOption);
      return seasonNumber;
    });

    (async() => {
      await Promise.allSettled(
        seasonsNumbers.map(seasonNumber => loadAllEpisodesOfSeason(seasonNumber, Title))
      );
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
  const Collection = data?.belongs_to_collection
    ? { id: data.belongs_to_collection.id, name: data.belongs_to_collection.name }
    : null;
  return [
    Title, Duration ,ReleaseYear, Rating,
    Adult, Genres, logoFileName, Summary,
    Seasons, Collection
  ];
}

function insertLogoTitleInformation(logoFileName,Title){
  const logoTitleContainer = document.getElementById("div-MovieLogoTitleContainer");
  const textTitleElement = document.getElementById("h1-MovieTitle");
  const logoTitleElement = document.getElementById("img-MovieLogoTitle");

  if(logoFileName){
    let logoImage = `https://image.tmdb.org/t/p/w500/${logoFileName}`;
    logoTitleElement.classList.toggle("is-svg", logoFileName.toLowerCase().endsWith(".svg"));
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
  const toggleDownloadBackdropBtn = (create) => {
    if(create) {
      const btn = document.createElement("div");
      btn.classList.add("download-backdrop-btn");
      btn.innerHTML = downloadIcon + "<p>Save Backdrop</p>";
      document.querySelector("body").appendChild(btn);
      btn.classList.add("show");
      btn.addEventListener("click", downloadBackdrop);
    } else {
      const btn = document.querySelector(".download-backdrop-btn");
      btn.classList.add("hide");
      setTimeout(() => {
        btn.remove();
      }, 100);
    }
  };

  const toggleBackdropInspection = (inspect) => {
    const mainDiv = document.getElementById("div-main");
    mainDiv.classList.toggle("backdrop-inspecting", inspect);
    mainDiv.inert = inspect;
  }
  titleElement.addEventListener("click", () => {
    toggleDownloadBackdropBtn(true);
    toggleBackdropInspection(true);
    setTimeout(() => {
      const restore = () => {
        event.preventDefault();
        event.stopPropagation();
        toggleBackdropInspection(false);
        toggleDownloadBackdropBtn(false);
        document.removeEventListener("keydown", restore);
        document.removeEventListener("click", restore);
      };
      document.addEventListener("keydown", restore, { once: true });
      document.addEventListener("click", restore, { once: true });
    }, 100);
  });
}

async function downloadBackdrop(event) {
  try {
    const filePath = await window.electronAPI.downloadBackdrop(backgroundImage, GlobalTitle);
    if (filePath)
      displayMessage({ title: "Backdrop Saved!", body: filePath });
  } catch (err) {
    displayMessage({ title: "Failed to save backdrop" });
  }
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

function insertCollectionOfMedia(Collection){
  const DivCollectionContainer = document.getElementById("div-collectionInfos");
  if(!Collection){
    DivCollectionContainer.style.display = "none";
    return;
  }

  const collectionName = Collection.name.replace(/\s*collection\s*$/i, "").trim() || Collection.name;

  const newCollectionElement = document.createElement("button");
  newCollectionElement.onclick = ()=>{openCollectionPage(Collection.id)};
  newCollectionElement.classList.add("btn-CollectionLink");
  newCollectionElement.innerHTML = `
    <svg class="collectionLinkIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="13" height="13" rx="2.4"></rect>
      <path d="M7.5 8V4.6A1.6 1.6 0 0 1 9.1 3h10.3A1.6 1.6 0 0 1 21 4.6v10.3a1.6 1.6 0 0 1-1.6 1.6H16"></path>
    </svg>
    <span class="collectionLinkName"></span>
    <svg class="collectionLinkArrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6"></path>
    </svg>
  `;
  newCollectionElement.querySelector(".collectionLinkName").textContent = collectionName;

  DivCollectionContainer.append(newCollectionElement);
  DivCollectionContainer.style.display = "";
}

function createSeasonOptionElement(season){
  const name = season.name;
  const seasonNumber = season.season_number;
  seasonNames[seasonNumber] = name;
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
    applyBackground(document.querySelector('#bulk-download-div').style, 0.8);
    // applyBackground(document.querySelector('#bottomButtonsDiv').style, 0.6);
  }
}

function createPeopleRow() {
  const row = document.createElement("div");
  row.classList.add("people-row");
  return row;
}

const PROFILE_NOT_FOUND_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-83 73 640 640" class="person-placeholder" aria-hidden="true">
  <rect x="-200" y="-200" width="874" height="1196" class="svg-notFound-bg"/>
  <circle cx="237" cy="313" r="80" class="svg-notFound-fg"/>
  <path d="M 93 553 A 144 144 0 0 1 381 553 Z" class="svg-notFound-fg"/>
</svg>`;

function createPersonItem(person, subtitle = "") {
  const item = document.createElement("button");
  item.type = "button";
  item.classList.add("person-item");
  item.dataset.personId = person.id;
  item.onclick = () => { openProfilePage(person.id) };

  const avatar = document.createElement("div");
  avatar.classList.add("person-avatar");

  const showPlaceholder = () => {
    avatar.innerHTML = PROFILE_NOT_FOUND_SVG;
    avatar.classList.remove("loading");
  };

  if(person.profile_path) {
    avatar.classList.add("loading");
    const img = document.createElement("img");
    img.alt = person.name;
    img.loading = "lazy";
    img.onload = () => {
      avatar.classList.remove("loading");
      img.classList.add("loaded");
    };
    img.onerror = showPlaceholder;
    img.src = `https://image.tmdb.org/t/p/w185${person.profile_path}`;
    avatar.append(img);
  } else {
    showPlaceholder();
  }

  const nameEl = document.createElement("p");
  nameEl.classList.add("person-name");
  nameEl.textContent = person.name;
  const textBox = document.createElement("div");
  textBox.classList.add("person-text");
  textBox.append(nameEl);
  item.append(avatar, textBox);

  if(subtitle) {
    const roleEl = document.createElement("p");
    roleEl.classList.add("person-role");
    roleEl.textContent = subtitle;
    textBox.append(roleEl);
  }
  return item;
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

  if(!DirectorsObjects.length) {
    DirectorsObjects = Crew.filter(
      element => 
        element.job === "Director" ||
        element.known_for_department === "Directing"
    );
  }
  
  DirectorsObjects = DirectorsObjects.sort((a, b) => b.popularity - a.popularity);

  const directorsRow = createPeopleRow();
  const loadedDirectors = [];
  for(const directorObject of DirectorsObjects) {
    if(!loadedDirectors.includes(directorObject.id)) {
      directorsRow.append(createPersonItem(directorObject, directorObject.job || "Director"));
      loadedDirectors.push(directorObject.id);
      if(MAX_NUMBER_OF_DIRECTORS != null && loadedDirectors.length >= MAX_NUMBER_OF_DIRECTORS) break;
    }
  }
  if(loadedDirectors.length) divDirectoryElement.append(directorsRow);

  const castRow = createPeopleRow();
  const loadedCast = [];
  for(const castObject of MainCastObjects) {
    if(
      !loadedCast.includes(castObject.id) &&
      castObject.name.trim() !== ""
    ) {
      castRow.append(createPersonItem(castObject, castObject.character));
      loadedCast.push(castObject.id);
      if(MAX_NUMBER_OF_CAST_MEMBERS != null && loadedCast.length >= MAX_NUMBER_OF_CAST_MEMBERS) break;
    }
  }
  if(loadedCast.length) divCastElement.append(castRow);

  if(!MainCastObjects.length){
    noCastInfoFounded();
  }
  if(!DirectorsObjects.length){
    noDirectorInfoFounded();
  }
}

async function renderMediaTorrent(data, MediaLibraryInfo, episodeInfo = {}) {
  torrentResultsList.innerHTML = "";
  torrentResultsList.classList.remove("visible-flex");

  const imdb_id = await IMDB_IDPromise;

  const docFragment = document.createDocumentFragment();
  data.streams.forEach(streamData => {
    const parsedTorrentInfo = parseTorrentioStream(streamData);
    if (parsedTorrentInfo.fileName.trim() !== "") {
      const torrentInfo = {
        MediaId: MediaId,
        MediaType: MediaType,
        IMDB_ID: imdb_id,
        Title: GlobalTitle,
        ...parsedTorrentInfo,
        bgImageUrl: backgroundImage,
        seasonNumber: episodeInfo.seasonNumber,
        episodeNumber: episodeInfo.episodeNumber
      };
      const torrentElement = createTorrentElement(torrentInfo);
      // const isCurrentlyWatching = isWatchingLater(
      //   torrentInfo,
      //   episodeInfo,
      //   MediaLibraryInfo
      // );

      docFragment.appendChild(torrentElement);
    }
  });
  torrentResultsList.append(docFragment);

  if (torrentResultsList.innerHTML.trim() === "")
    throw new Error("No Useful Results Were found !");

  await loadIconsDynamically();
  const torrentScrollValue = await loadCachedTorrentsScrollValue();
  document.getElementById("div-movieMedias").scrollTop = torrentScrollValue
  torrentSidePanel.classList.remove("preloadingTorrent");
}

const isWatchingLater = (torrentInfo, episodeInfo, mediaLibraryInfo) => {
  return mediaLibraryInfo?.typeOfSave?.includes("Currently Watching") &&
  String(torrentInfo.MagnetLink) === String(mediaLibraryInfo["MagnetLink"]) &&
  String(episodeInfo.seasonNumber) === String(mediaLibraryInfo["seasonNumber"]) &&
  String(episodeInfo.episodeNumber) === String(mediaLibraryInfo["episodeNumber"]);
};

function createTorrentElement(torrentInfo) {
  const TorrentElement = document.createElement("div");
  TorrentElement.classList.add("div-TorrentMedia");
  TorrentElement.setAttribute("tabindex", "0");

  const qualityDiv = document.createElement("div");
  qualityDiv.classList.add("div-MediaQuality");

  const qualityP = document.createElement("p");
  qualityP.textContent = torrentInfo.Quality;
  qualityDiv.appendChild(qualityP);

  const descriptionDiv = document.createElement("div");
  descriptionDiv.classList.add("div-MediaDescription");

  const titleP = document.createElement("p");
  titleP.textContent = torrentInfo.torrentTitle;

  const infoDiv = document.createElement("div");
  infoDiv.classList.add("torrent-info-div");

  const storageIcon = document.createElement("div");
  storageIcon.classList.add("div-storageImage");

  const seedIcon = document.createElement("div");
  seedIcon.classList.add("div-seedImage");

  const sizeText = document.createTextNode(` ${torrentInfo.Size} \u00A0\u00A0`);
  const seedText = document.createTextNode(` ${torrentInfo.SeedersNumber}`);

  infoDiv.appendChild(storageIcon);
  infoDiv.appendChild(sizeText);
  infoDiv.appendChild(seedIcon);
  infoDiv.appendChild(seedText);

  descriptionDiv.appendChild(titleP);
  descriptionDiv.appendChild(infoDiv);

  const downloadBtn = createTorrentDownloadButton(torrentInfo);

  TorrentElement.appendChild(qualityDiv);
  TorrentElement.appendChild(descriptionDiv);
  TorrentElement.appendChild(downloadBtn);

  addTorrentElementEventListener(TorrentElement, torrentInfo);
  addFloatingDivToDisplayFullTitle(TorrentElement, ".div-MediaDescription p");

  return TorrentElement;
}

function createTorrentDownloadButton(torrentInfo) {
  const downloadBtn = document.createElement("button");
  downloadBtn.classList.add("btn-downloadTorrent");
  downloadBtn.setAttribute("type", "button");
  downloadBtn.setAttribute("aria-label", "Download torrent");

  downloadBtn.innerHTML = downloadIcon;

  downloadBtn.addEventListener("click",(event) => {
    event.stopPropagation();
    event.preventDefault();

    const DownloadTargetInfo = buildDownloadTargetInfo(torrentInfo);
    setupDownloadDivEvents(DownloadTargetInfo);
    showDownloadInfoInputDiv(DownloadTargetInfo);
  });

  return downloadBtn;
}

function buildDownloadTargetInfo(torrentInfo) {
  const mediaTitle = document.getElementById("h1-MovieTitle").innerText;
  const mediaReleaseYear = document.getElementById("p-movieYearOfRelease").innerText;

  return {
    IMDB_ID: torrentInfo.IMDB_ID,
    Title: mediaTitle,
    Size: torrentInfo.Size,
    Quality: torrentInfo.Quality,
    Year: mediaReleaseYear,
    MagnetLink: torrentInfo.MagnetLink,
    fileName: torrentInfo.fileName,
    dirName: torrentInfo.Title,
    MediaId: torrentInfo.MediaId,
    MediaType: torrentInfo.MediaType,
    seasonNumber: torrentInfo.seasonNumber,
    episodeNumber: torrentInfo.episodeNumber,
    rawStreamTitle: torrentInfo.rawStreamTitle
  };
}

function addTorrentElementEventListener(TorrentElement, torrentInfo) {
  torrentInfo.Title = GlobalTitle;
  TorrentElement.addEventListener("click",() => {
    openMediaVideo(torrentInfo);
  });
}

const toIntOrRaw = (target) => {
  const number = Number.parseInt(target, 10);
  return Number.isNaN(number) ? target : number;
};
function parseTorrentioStream(streamData) {
  const fullTitle = streamData.title.replace(/\n+/g, "");
  const torrentTitle = fullTitle.split("👤")[0].split("\n")[0].replace(/\n+/g, "");
  const Quality = streamData.name.split("Torrentio")[1].replace(/\n+/g, "");
  const hash = streamData.infoHash;
  const SeedersNumber = fullTitle.split("👤")[1].split("💾")[0].replace(/\n+/g, "");
  const Size = fullTitle.split("💾")[1].split("⚙️")[0].replace(/\n+/g, "");
  const fileName = streamData?.behaviorHints?.filename || "";
  const MagnetLink = `magnet:?xt=urn:btih:${hash}`
  return { rawStreamTitle: fullTitle, torrentTitle, Quality, hash, SeedersNumber: toIntOrRaw(SeedersNumber), Size, fileName, MagnetLink };
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

function getSelectSeasonContainerHeight() {
  const height = selectSeasonContainer.offsetHeight;
  return height > 0 ? height + "px" : "15px";
}

function addSpaceToTopOfTorrentContainer() {
  const dummyDiv = document.getElementById("dummyDiv");

  requestAnimationFrame(() => {
    const selectSeasonContainerHeight = getSelectSeasonContainerHeight();
    dummyDiv.style.height = selectSeasonContainerHeight;
    torrentSidePanel.style.paddingBottom = selectSeasonContainerHeight;
  });
}

function addNothingWasFoundDivMargin(nothingWasFoundDiv) {
  requestAnimationFrame(() => {
    const selectSeasonContainerHeight = getSelectSeasonContainerHeight();
    if(nothingWasFoundDiv)
      nothingWasFoundDiv.style.marginBottom = selectSeasonContainerHeight;
  });
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
  SeasonEpisodeElement.innerText =
    (DownloadTargetInfo.seasonNumber && DownloadTargetInfo.episodeNumber)
      ? `S${DownloadTargetInfo.seasonNumber}-E${DownloadTargetInfo.episodeNumber}`
      : "";
  applySingleDownloadHero();
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

function applySingleDownloadHero() {
  const hasBackdrop = typeof backgroundImage === "string"
    && backgroundImage.startsWith("http")
    && !backgroundImage.endsWith("/null");
  const heroImage = document.getElementById("singleHeroImage");
  heroImage.classList.toggle("no-backdrop", !hasBackdrop);
  heroImage.style.backgroundImage = hasBackdrop ? `url("${backgroundImage}")` : "";
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

async function DownloadTorrent(DownloadTargetInfo, hasToDownloadSubs) {
  const apiKey = await apiKeyPromise;
  const userDownloadPath = document.getElementById("downloadPath")?.value;
  const posterPath = await getPosterPath(DownloadTargetInfo.IMDB_ID, apiKey);
  DownloadTargetInfo["posterUrl"] = `https://image.tmdb.org/t/p/w500${posterPath}`;
  DownloadTargetInfo["bgImageUrl"] = backgroundImage;
  DownloadTargetInfo["userDownloadPath"] = userDownloadPath;
  window.electronAPI.downloadTorrent([DownloadTargetInfo], hasToDownloadSubs);
}

const BULK_QUALITY_ORDER = ["4K", "1080p", "720p", "480p"];
const BULK_CONCURRENCY = 3;

let bulkBusy = false;
let bulkRunId = 0;

const bulkPad = (n) => String(n).padStart(2, "0");
const bulkEpisodeLabel = (s, e) => `S${bulkPad(s)}E${bulkPad(e)}`;

function getBulkSeasonNumbers() {
  return Object.keys(seasonsEpisodesData)
    .map(Number)
    .sort((a, b) => (a === 0) - (b === 0) || a - b);
}

function isBulkEpisodeAired(episode) {
  if (!episode.air_date) return true;
  const airDate = new Date(episode.air_date);
  return Number.isNaN(airDate.getTime()) || airDate <= new Date();
}

function setBulkMessage(text, type = "success") {
  bulkMessage.textContent = text || "";
  bulkMessage.classList.toggle("show", Boolean(text));
  bulkMessage.classList.toggle("success", type === "success");
  bulkMessage.classList.toggle("error", type === "error");
}

let bulkActiveSeason = null;

function getBulkSeasonName(seasonNumber) {
  return seasonNames[seasonNumber] ?? (seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`);
}

function getBulkQuality() {
  return bulkQualitySelect.querySelector('input[name="bulkQuality"]:checked')?.value ?? "1080p";
}

function getBulkPanel(seasonNumber) {
  return bulkEpisodeList.querySelector(`.bulk-episodes[data-season="${seasonNumber}"]`);
}

function setBulkBusy(busy, label = "", fraction = 0) {
  bulkBusy = busy;
  bulkContainer.classList.toggle("bulk-busy", busy);
  bulkDownloadBtn.classList.toggle("loading", busy);
  bulkProgress.classList.toggle("show", busy);

  if (busy) {
    bulkProgressBar.style.width = `${Math.round(fraction * 100)}%`;
    bulkSummary.textContent = label;
    if (!bulkDownloadBtn.querySelector(".bulk-spinner")) {
      bulkDownloadBtn.innerHTML = `<span class="bulk-spinner"></span>`;
      bulkDownloadBtn.append(document.createTextNode("Finding torrents"));
    }
  } else {
    bulkProgressBar.style.width = "0%";
    refreshBulkSelection();
  }
}

function buildBulkSeasonList(seasonNumbers, preselectSeason) {
  bulkSeasonList.innerHTML = "";
  bulkEpisodeList.innerHTML = "";
  const railFragment = document.createDocumentFragment();
  const panelFragment = document.createDocumentFragment();

  seasonNumbers.forEach(seasonNumber => {
    const episodes = seasonsEpisodesData[seasonNumber] ?? [];
    const seasonName = getBulkSeasonName(seasonNumber);

    // --- left rail item
    const seasonEl = document.createElement("div");
    seasonEl.className = "bulk-season";
    seasonEl.dataset.season = seasonNumber;
    seasonEl.tabIndex = 0;
    seasonEl.setAttribute("role", "button");

    const seasonCheckbox = document.createElement("input");
    seasonCheckbox.type = "checkbox";
    seasonCheckbox.className = "bulk-check bulk-season-checkbox";
    seasonCheckbox.setAttribute("aria-label", `Select every episode of ${seasonName}`);

    const nameEl = document.createElement("span");
    nameEl.className = "bulk-season-name";
    nameEl.textContent = seasonName;

    const countEl = document.createElement("span");
    countEl.className = "bulk-season-count";

    seasonEl.append(seasonCheckbox, nameEl, countEl);
    railFragment.append(seasonEl);

    // --- right panel for this season
    const episodesEl = document.createElement("div");
    episodesEl.className = "bulk-episodes";
    episodesEl.dataset.season = seasonNumber;

    if (!episodes.length) {
      const empty = document.createElement("p");
      empty.className = "bulk-empty";
      empty.textContent = "No episodes available for this season.";
      episodesEl.append(empty);
    }

    episodes.forEach(episode => {
      const aired = isBulkEpisodeAired(episode);

      const row = document.createElement("label");
      row.className = "bulk-episode" + (aired ? "" : " is-disabled");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "bulk-check bulk-episode-checkbox";
      checkbox.dataset.season = episode.season_number;
      checkbox.dataset.episode = episode.episode_number;
      checkbox.disabled = !aired;

      const numberEl = document.createElement("span");
      numberEl.className = "bulk-episode-number";
      numberEl.textContent = bulkPad(episode.episode_number);

      const episodeNameEl = document.createElement("span");
      episodeNameEl.className = "bulk-episode-name";
      episodeNameEl.textContent = episode.name || `Episode ${episode.episode_number}`;

      const dateEl = document.createElement("span");
      dateEl.className = "bulk-episode-date";
      dateEl.textContent = aired ? (episode.air_date ?? "") : "Not aired yet";

      row.append(checkbox, numberEl, episodeNameEl, dateEl);
      episodesEl.append(row);
    });

    if (seasonNumber === preselectSeason) {
      episodesEl.querySelectorAll(".bulk-episode-checkbox:not(:disabled)")
        .forEach(cb => { cb.checked = true; });
    }

    panelFragment.append(episodesEl);
  });

  bulkSeasonList.append(railFragment);
  bulkEpisodeList.append(panelFragment);
}

function setActiveBulkSeason(seasonNumber) {
  bulkActiveSeason = Number(seasonNumber);

  bulkSeasonList.querySelectorAll(".bulk-season").forEach(el => {
    const isActive = Number(el.dataset.season) === bulkActiveSeason;
    el.classList.toggle("active", isActive);
    if (isActive) {
      el.setAttribute("aria-current", "true");
      el.scrollIntoView({ block: "nearest" });
    } else {
      el.removeAttribute("aria-current");
    }
  });

  bulkEpisodeList.querySelectorAll(".bulk-episodes").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.season) === bulkActiveSeason);
  });
  bulkEpisodeList.scrollTop = 0;

  updateBulkPanelHeader();
}

function updateBulkPanelHeader() {
  if (bulkActiveSeason == null) return;
  const panel = getBulkPanel(bulkActiveSeason);
  if (!panel) return;

  const all = [...panel.querySelectorAll(".bulk-episode-checkbox")];
  const enabled = all.filter(cb => !cb.disabled);
  const checked = enabled.filter(cb => cb.checked).length;
  const upcoming = all.length - enabled.length;

  bulkPanelTitle.textContent = getBulkSeasonName(bulkActiveSeason);
  bulkPanelMeta.textContent =
    `${all.length} episode${all.length === 1 ? "" : "s"}` +
    (upcoming ? `, ${upcoming} not aired yet` : "");

  bulkSeasonToggle.hidden = enabled.length === 0;
  bulkSeasonToggle.textContent =
    checked === enabled.length ? "Deselect season" : "Select season";
}

function refreshBulkSelection() {
  let total = 0;
  let seasonsUsed = 0;

  bulkSeasonList.querySelectorAll(".bulk-season").forEach(seasonEl => {
    const panel = getBulkPanel(seasonEl.dataset.season);
    const enabled = [...panel.querySelectorAll(".bulk-episode-checkbox:not(:disabled)")];
    const checkedCount = enabled.filter(cb => cb.checked).length;
    const seasonCheckbox = seasonEl.querySelector(".bulk-season-checkbox");

    seasonCheckbox.disabled = enabled.length === 0;
    seasonCheckbox.checked = enabled.length > 0 && checkedCount === enabled.length;
    seasonCheckbox.indeterminate = checkedCount > 0 && checkedCount < enabled.length;
    seasonEl.querySelector(".bulk-season-count").textContent = `${checkedCount}/${enabled.length}`;
    seasonEl.classList.toggle("has-selection", checkedCount > 0);

    total += checkedCount;
    if (checkedCount > 0) seasonsUsed++;
  });

  updateBulkPanelHeader();
  bulkDownloadBtn.disabled = total === 0;

  if (bulkBusy) return;

  bulkSummary.textContent = total === 0
    ? "Select the episodes you want"
    : `${total} episode${total === 1 ? "" : "s"} from ${seasonsUsed} season${seasonsUsed === 1 ? "" : "s"}`;
  bulkDownloadBtn.textContent = total === 0
    ? "Download"
    : `Download ${total} episode${total === 1 ? "" : "s"}`;
}

function setAllBulkChecked(checked) {
  bulkEpisodeList.querySelectorAll(".bulk-episode-checkbox:not(:disabled)")
    .forEach(cb => { cb.checked = checked; });
  refreshBulkSelection();
}

function setBulkSeasonChecked(seasonNumber, checked) {
  getBulkPanel(seasonNumber)
    ?.querySelectorAll(".bulk-episode-checkbox:not(:disabled)")
    .forEach(cb => { cb.checked = checked; });
  refreshBulkSelection();
}

function getBulkSelectedEpisodes() {
  return [...bulkEpisodeList.querySelectorAll(".bulk-episode-checkbox:checked")]
    .map(cb => ({ season: Number(cb.dataset.season), episode: Number(cb.dataset.episode) }))
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
}

function applyBulkHero() {
  const hasBackdrop = typeof backgroundImage === "string"
    && backgroundImage.startsWith("http")
    && !backgroundImage.endsWith("/null");

  bulkContainer.classList.toggle("no-backdrop", !hasBackdrop);
  bulkHeroImage.style.backgroundImage = hasBackdrop ? `url("${backgroundImage}")` : "";

  // Reuse the title logo already loaded on the page; fall back to the text title.
  const pageLogo = document.getElementById("img-MovieLogoTitle");
  const logoContainer = document.getElementById("div-MovieLogoTitleContainer");
  const hasLogo = Boolean(pageLogo?.getAttribute("src")) && !logoContainer?.classList.contains("hidden");

  bulkHeroLogo.hidden = !hasLogo;
  bulkSubtitle.hidden = hasLogo;
  if (hasLogo) {
    bulkHeroLogo.src = pageLogo.src;
    bulkHeroLogo.alt = GlobalTitle ?? "";
    bulkHeroLogo.classList.toggle("is-svg", pageLogo.classList.contains("is-svg"));
  }

  // restart the one-time reveal each time the dialog opens
  bulkContainer.classList.remove("bulk-reveal");
  void bulkContainer.offsetWidth;
  bulkContainer.classList.add("bulk-reveal");
}

async function openBulkDownload() {
  if (MediaType !== "tv") return;

  const seasonNumbers = getBulkSeasonNumbers();
  if (!seasonNumbers.length) {
    displayMessage({ title: "Episodes are still loading", body: "Please try again in a moment." });
    return;
  }

  setBulkMessage("");
  bulkSubtitle.textContent = GlobalTitle ?? "";
  applyBulkHero();

  const currentSeason = parseInt(getDropdownValue(selectSeason), 10);
  const startSeason = seasonNumbers.includes(currentSeason) ? currentSeason : seasonNumbers[0];
  buildBulkSeasonList(seasonNumbers, startSeason);
  setActiveBulkSeason(startSeason);
  refreshBulkSelection();

  bulkOverlay.classList.add("active");
  dontGoBack = true;

  const [defaultPath, rememberLocation, downloadSubtitles] = await loadDownloadSettings();
  bulkPathInput.value = defaultPath ?? "";
  bulkRememberCheckbox.checked = Boolean(rememberLocation);
  bulkSubtitlesCheckbox.checked = downloadSubtitles ?? true;
}

function closeBulkDownload() {
  if (!bulkOverlay.classList.contains("active")) return;
  bulkRunId++;
  setBulkBusy(false);
  bulkOverlay.classList.remove("active");
}

function getBulkQualityTier(rawQuality) {
  const quality = String(rawQuality ?? "").toLowerCase();
  if (/2160|4k|uhd/.test(quality)) return 0;
  if (/1080/.test(quality)) return 1;
  if (/720/.test(quality)) return 2;
  if (/480|576|360/.test(quality)) return 3;
  return BULK_QUALITY_ORDER.length;
}

async function fetchBulkEpisodeStreams(imdb_id, seasonNumber, episodeNumber) {
  const url = `https://torrentio.strem.fun/stream/series/${imdb_id}:${seasonNumber}:${episodeNumber}.json`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Torrentio responded with ${res.status}`);
      const json = await res.json();
      return json?.streams ?? [];
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
}

function parseBulkStreams(streams) {
  const parsed = [];
  streams.forEach(stream => {
    try {
      const info = parseTorrentioStream(stream);
      if (info.fileName.trim() === "") return;
      parsed.push({
        ...info,
        tier: getBulkQualityTier(info.Quality),
        seeders: Number(info.SeedersNumber) || 0
      });
    } catch {}
  });
  return parsed;
}

function pickBulkStream(parsedStreams, wantedQuality) {
  if (!parsedStreams.length) return null;

  const known = parsedStreams.filter(s => s.tier < BULK_QUALITY_ORDER.length);
  const pool = known.length ? known : parsedStreams;
  const bySeeders = (a, b) => b.seeders - a.seeders;

  if (wantedQuality === "best") {
    const bestTier = Math.min(...pool.map(s => s.tier));
    return { stream: pool.filter(s => s.tier === bestTier).sort(bySeeders)[0], usedFallback: false };
  }

  const targetTier = BULK_QUALITY_ORDER.indexOf(wantedQuality);
  const exact = pool.filter(s => s.tier === targetTier).sort(bySeeders);
  if (exact.length) return { stream: exact[0], usedFallback: false };

  const closest = [...pool].sort((a, b) =>
    Math.abs(a.tier - targetTier) - Math.abs(b.tier - targetTier) ||
    a.tier - b.tier ||
    bySeeders(a, b)
  )[0];
  return { stream: closest, usedFallback: true };
}

async function runBulkWithConcurrency(items, limit, worker, isStale) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length && !isStale()) {
      const index = nextIndex++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function resolveBulkTargets(selected, wantedQuality, imdb_id, onProgress, isStale) {
  const results = new Array(selected.length).fill(null);
  let done = 0;

  await runBulkWithConcurrency(selected, BULK_CONCURRENCY, async ({ season, episode }, index) => {
    try {
      const streams = await fetchBulkEpisodeStreams(imdb_id, season, episode);
      const choice = pickBulkStream(parseBulkStreams(streams), wantedQuality);
      if (choice) {
        const torrentInfo = {
          MediaId: MediaId,
          MediaType: MediaType,
          IMDB_ID: imdb_id,
          Title: GlobalTitle,
          ...choice.stream,
          seasonNumber: bulkPad(season),
          episodeNumber: bulkPad(episode)
        };
        results[index] = { target: buildDownloadTargetInfo(torrentInfo), usedFallback: choice.usedFallback };
      }
    } catch (err) {
      console.error(`Bulk: failed to fetch ${bulkEpisodeLabel(season, episode)}`, err);
    }
    done++;
    if (!isStale()) onProgress(done, selected.length);
  }, isStale);

  const targets = [];
  const missing = [];
  let fallbackCount = 0;
  results.forEach((result, index) => {
    if (result) {
      targets.push(result.target);
      if (result.usedFallback) fallbackCount++;
    } else {
      missing.push(bulkEpisodeLabel(selected[index].season, selected[index].episode));
    }
  });
  return { targets, missing, fallbackCount };
}

async function startBulkDownload() {
  if (bulkBusy) return;

  const selected = getBulkSelectedEpisodes();
  if (!selected.length) return;

  const downloadPath = bulkPathInput.value.trim();
  if (!downloadPath) {
    setBulkMessage("Choose a folder to save the episodes in.", "error");
    return;
  }

  const wantedQuality = getBulkQuality();
  const withSubtitles = bulkSubtitlesCheckbox.checked;
  const runId = ++bulkRunId;
  const isStale = () => runId !== bulkRunId;

  setBulkMessage("");
  setBulkBusy(true, `Looking for torrents: 0 of ${selected.length}`, 0);

  try {
    const imdb_id = await IMDB_IDPromise;
    if (!imdb_id) throw new Error("This title has no IMDb ID, so torrents can't be searched.");

    const { targets, missing, fallbackCount } = await resolveBulkTargets(
      selected,
      wantedQuality,
      imdb_id,
      (done, total) => setBulkBusy(true, `Looking for torrents: ${done} of ${total}`, done / total),
      isStale
    );
    if (isStale()) return;

    if (!targets.length) {
      setBulkMessage("No torrents found for these episodes. Try a different quality or pick other episodes.", "error");
      return;
    }

    const apiKey = await apiKeyPromise;
    let posterUrl = null;
    try {
      const posterPath = await getPosterPath(imdb_id, apiKey);
      if (posterPath) posterUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
    } catch (err) {
      console.error(err);
    }
    targets.forEach(target => {
      target.posterUrl = posterUrl;
      target.bgImageUrl = backgroundImage;
      target.userDownloadPath = downloadPath;
    });

    window.electronAPI.downloadTorrent(targets, withSubtitles);
    await saveDownloadSettings(downloadPath, withSubtitles, bulkRememberCheckbox.checked);
    closeBulkDownload();

    const notes = [];
    if (fallbackCount)
      notes.push(`${fallbackCount} used the closest available quality.`);
    if (missing.length) {
      const shown = missing.slice(0, 5).join(", ");
      const extra = missing.length > 5 ? ` +${missing.length - 5} more` : "";
      notes.push(`No torrents found for ${shown}${extra}.`);
    }
    displayMessage({
      title: `Downloading ${targets.length} episode${targets.length === 1 ? "" : "s"}`,
      body: notes.join(" ")
    });
  } catch (err) {
    console.error(err);
    if (!isStale()) setBulkMessage(err?.message || "Something went wrong while preparing the downloads.", "error");
  } finally {
    if (!isStale()) setBulkBusy(false);
  }
}

function setupBulkDownloadEvents() {
  [bulkCloseBtn, bulkCancelBtn].forEach(btn => btn.addEventListener("click", closeBulkDownload));
  bulkDownloadBtn.addEventListener("click", startBulkDownload);

  // Click outside the dialog to dismiss (not while work is in progress)
  bulkOverlay.addEventListener("mousedown", (event) => {
    if (event.target === bulkOverlay && !bulkBusy) closeBulkDownload();
  });

  bulkBrowseBtn.addEventListener("click", async () => {
    const dirPath = await window.electronAPI.openDirectory_FileSystemBrowser(bulkPathInput.value);
    if (dirPath) bulkPathInput.value = dirPath;
  });

  bulkSelectAllBtn.addEventListener("click", () => setAllBulkChecked(true));
  bulkClearAllBtn.addEventListener("click", () => setAllBulkChecked(false));

  bulkSeasonToggle.addEventListener("click", () => {
    const enabled = [...getBulkPanel(bulkActiveSeason).querySelectorAll(".bulk-episode-checkbox:not(:disabled)")];
    setBulkSeasonChecked(bulkActiveSeason, !enabled.every(cb => cb.checked));
  });

  // Left rail: checkbox toggles the whole season, anywhere else opens it
  bulkSeasonList.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.classList.contains("bulk-season-checkbox")) return;
    setBulkSeasonChecked(target.closest(".bulk-season").dataset.season, target.checked);
  });

  bulkSeasonList.addEventListener("click", (event) => {
    if (event.target.closest(".bulk-season-checkbox")) return;
    const seasonEl = event.target.closest(".bulk-season");
    if (seasonEl) setActiveBulkSeason(seasonEl.dataset.season);
  });

  bulkSeasonList.addEventListener("keydown", (event) => {
    const seasonEl = event.target.closest(".bulk-season");
    if (!seasonEl || event.target.closest(".bulk-season-checkbox")) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveBulkSeason(seasonEl.dataset.season);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const sibling = event.key === "ArrowDown" ? seasonEl.nextElementSibling : seasonEl.previousElementSibling;
      if (sibling) { sibling.focus(); setActiveBulkSeason(sibling.dataset.season); }
    }
  });

  bulkEpisodeList.addEventListener("change", refreshBulkSelection);
}

async function loadLogoImage(movieLanguage) {
  try {
    const apiKey = await apiKeyPromise;
    const data = await fetchTMDBJson(
      `https://api.themoviedb.org/3/${MediaType}/${MediaId}/images?api_key=${apiKey}`
    );
    const logos = data?.logos ?? [];
    const originalLanguageLogos = logos.filter(imageObj => imageObj?.iso_639_1 === movieLanguage);
    const englishLogos = logos.filter(imageObj => imageObj?.iso_639_1 === "en");
    return (
      englishLogos?.[0]?.file_path ??
      originalLanguageLogos?.[0]?.file_path ??
      null
    );
  } catch(err) {
    console.error(err);
    return null;
  }
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
    closeBulkDownload();
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

setupBulkDownloadEvents();
triggerLoadingGif();
manageSaveDropDowns();
addSaveDropDownEventListener();
setupKeyPressesHandler();
handleLibraryButton()
pageInit();
handleDivsResize();
handleFullScreenIcon();
loadIconsDynamically();
handleNavigationWithArrowKeys(focusFunction);
