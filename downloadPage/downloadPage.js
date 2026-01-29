const currentlyDownloadingDiv = document.getElementById("currently-downloading-div");
const queuedDownloadsDiv  = document.getElementById("download-queue-div");
const doneDownloadsDiv = document.getElementById("download-done-div");
const pausedDownloadsDiv = document.getElementById("download-paused-div");

let monitoringProgress = false;
async function loadDownloadMediaFromLib() {
  let library = await window.electronAPI.loadDownloadLibraryInfo();

  if(library !== undefined){
    for(let mediaLibEntryPoint of library.downloads){
        createDownloadElement(mediaLibEntryPoint);
    }
  }

  if(library.downloads.length === 0){
    let RightmiddleDiv = document.getElementById("div-middle-right");
    let MediaDownloadElementContainer = document.querySelector(".download-categorie-container");
    putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 
    RightmiddleDiv.style.opacity = 1;

  }else{
    if(!monitoringProgress){
      monitorDownloads();
      monitorErrors();
    }
  }

  updateDownloadUI();
  await loadCachedPageInfo();
}

async function createDownloadElement(mediaLibEntryPoint) {
  let downloadStatus = mediaLibEntryPoint?.Status;
  
  let currentSize = (mediaLibEntryPoint?.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
  let totalSize = (mediaLibEntryPoint?.Total / (1024 * 1024 * 1024)).toFixed(2);
  let progress = (currentSize/totalSize * 100).toFixed(2);

  let ElementIdentifier = mediaLibEntryPoint?.torrentId;
  if(document.getElementById(ElementIdentifier)) return

  let displayTitle = mediaLibEntryPoint?.Title;
  if(mediaLibEntryPoint.seasonNumber && mediaLibEntryPoint.episodeNumber)
    displayTitle = `${mediaLibEntryPoint?.Title} S${mediaLibEntryPoint.seasonNumber} E${mediaLibEntryPoint.episodeNumber}`;

  let formatedDownloadInfo = {
    downloadStatus,
    displayTitle,
    progress,
    totalSize,
    currentSize
  }

  let MediaDownloadElement = createMediaDownloadElement(mediaLibEntryPoint,formatedDownloadInfo);
  MediaDownloadElement.className = "download-media";
  MediaDownloadElement.id = ElementIdentifier;

  let insiderProgressBar = MediaDownloadElement.querySelector(".progress-bar-div .inside");
  insiderProgressBar.style.width = progress + "%";

  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PosterDiv = MediaDownloadElement.querySelector(".poster-div");
  let PosterElement = MediaDownloadElement.querySelector(".poster-img");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");

  makeSurePosterIsLoaded(mediaLibEntryPoint,PosterDiv,PosterElement);
  makeSureBgImageIsDownloaded(mediaLibEntryPoint);

  let downloadCategorie;

  if (downloadStatus.toLowerCase() === "downloading" || downloadStatus.toLowerCase() === "loading") {
    downloadCategorie = currentlyDownloadingDiv;
    handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
    addBackgroundImageToDownloadingDiv(MediaDownloadElement,mediaLibEntryPoint?.posterPath);

    if (downloadStatus.toLowerCase() === "loading") {
      if(!loadingIntervals?.[mediaLibEntryPoint.torrentId])
        addingLoadingAnimation(mediaLibEntryPoint.torrentId,downloadSpeedElement,PausePlayButton);
    }

  } else if(downloadStatus.toLowerCase() === "done") {
    downloadCategorie = doneDownloadsDiv;
    MarkDownloadElementAsFinished(MediaDownloadElement,mediaLibEntryPoint);

  } else if(downloadStatus.toLowerCase() === "queued") {
    downloadCategorie = queuedDownloadsDiv;
    handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);

  } else if(downloadStatus.toLowerCase() === "paused") {
    downloadCategorie = pausedDownloadsDiv;
    handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
    MarkDownloadElementAsPaused(MediaDownloadElement);
  }

  const downloadContainer = downloadCategorie.querySelector(".movieContainer");
  downloadContainer.appendChild(MediaDownloadElement);
 
  handleCancelButton(mediaLibEntryPoint,MediaDownloadElement);
  alignSizeDiv();

  let RightmiddleDiv = document.getElementById("div-middle-right");
  RightmiddleDiv.style.opacity = 1;
}

async function makeSurePosterIsLoaded(libraryEntryPoint,PosterDiv,PosterElement) {
  let posterPathExist = await imagePathIsValid(libraryEntryPoint?.posterPath);

  if (posterPathExist) {
    PosterElement.classList.add("show");
    PosterElement.src = `file://${libraryEntryPoint?.posterPath}?t=${Date.now()}`;
    PosterDiv.classList.remove("flashing-Div");

  } else {
    PosterDiv.classList.add("flashing-Div");
    let responce = await window.electronAPI.downloadImage(libraryEntryPoint.downloadPath, libraryEntryPoint.posterUrl);

    if(responce.download_result === "success") {
      // close loop
      PosterDiv.classList.remove("flashing-Div");
      PosterElement.classList.add("show");
      PosterElement.src = `file://${libraryEntryPoint?.posterPath}?t=${Date.now()}`;
      console.log(`Poster was downloaded Successfully: ${libraryEntryPoint.torrentId}`);

    } else {
      // keep trying to download
      console.log(`Failed To download Poster For: ${libraryEntryPoint.torrentId}`)
      setTimeout(()=>{
        makeSurePosterIsLoaded(libraryEntryPoint,PosterElement)
      },5000);
    }
  }
}

async function makeSureBgImageIsDownloaded(libraryEntryPoint) {
  let bgImageIsDownloaded = await imagePathIsValid(libraryEntryPoint.bgImagePath);

  if(!bgImageIsDownloaded){
    let responce = await window.electronAPI.downloadImage(libraryEntryPoint.downloadPath, libraryEntryPoint.bgImageUrl);

    if(responce.download_result === "success") {
      // close loop
      console.log(`Background Image was downloaded Successfully: ${libraryEntryPoint.torrentId}`);

    } else {
      // keep trying to download
      console.log(`Failed To download Background Image For: ${libraryEntryPoint.torrentId}`)
      setTimeout(()=>{
        makeSureBgImageIsDownloaded(libraryEntryPoint)
      },5000);
    }
  }
}

function imagePathIsValid(imagePath) {
  return new Promise((res)=>{
    const tmpImg = new Image();
    tmpImg.onload = ()=>res(true);
    tmpImg.onerror = ()=>res(false);
    tmpImg.src = `file://${imagePath}?t=${Date.now()}`;
  });
}

function monitorDownloads() {
  window.electronAPI.getDownloadProgress(async (data) => {
    let JsonData = data;

    let DownloadElementIdentifier = JsonData.TorrentId;

    let TargetDownloadElement = document.getElementById(DownloadElementIdentifier);
    let TotalSizeTextElement = TargetDownloadElement.querySelector(".total-size");
    let PosterElement = TargetDownloadElement.querySelector(".poster-img");
    let DownloadedSizeTextElement = TargetDownloadElement.querySelector(".downloaded-size");
    let PercentageTextElement = TargetDownloadElement.querySelector(".percentage");
    let ProgressBar = TargetDownloadElement.querySelector(".progress-bar-div");
    let insiderProgressBar = TargetDownloadElement.querySelector(".progress-bar-div .inside");
    let PausePlayButton = TargetDownloadElement.querySelector(".toggle-pause-button");
    let CancelButton = TargetDownloadElement.querySelector(".cancel-button");
    let downloadSpeedElement = TargetDownloadElement.querySelector(".download-speed-p");

    let calculatedProgress = ((JsonData.Downloaded / JsonData.Total) * 100).toFixed(2);
    let calculatedDownloadedSize = (JsonData.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
    let calculatedTotalSize = (JsonData.Total / (1024 * 1024 * 1024)).toFixed(2);
    let calculatedDownloadSpeedInKB = (JsonData.DownloadSpeed / (1024)).toFixed(2);
    let calculatedDownloadSpeedInMB = (calculatedDownloadSpeedInKB / 1024).toFixed(2);

    if(loadingIntervals?.[DownloadElementIdentifier]){
      removeLoadingAnimation(DownloadElementIdentifier,PausePlayButton,"Downloading")
    }

    DownloadedSizeTextElement.innerText =  calculatedDownloadedSize + " GB";
    TotalSizeTextElement.innerText = calculatedTotalSize + " GB";
    downloadSpeedElement.innerText = calculatedDownloadSpeedInKB < 1000 ? calculatedDownloadSpeedInKB + " Kb/s": calculatedDownloadSpeedInMB + " Mb/s";
    PercentageTextElement.innerText = calculatedProgress + " %";
    insiderProgressBar.style.width = calculatedProgress+ "%";

    PausePlayButton.innerHTML = pauseIcon;
    CancelButton.innerHTML = xRemoveIcon;

    if(JsonData?.Status.toLowerCase() === "done"){
      let library = await window.electronAPI.loadDownloadLibraryInfo();
      let libraryElement = library.downloads.find(element => element.torrentId === JsonData.TorrentId);
      let doneDownloadContainer = doneDownloadsDiv.querySelector("movieContainer");
      if(doneDownloadContainer)
        doneDownloadContainer.appendChild(TargetDownloadElement);
      MarkDownloadElementAsFinished(TargetDownloadElement,libraryElement);
      const downloadContainer = doneDownloadsDiv.querySelector(".movieContainer");
      downloadContainer.appendChild(TargetDownloadElement);
      updateDownloadUI();
    }

  });
  monitoringProgress = true;
}

function refreshEnties() {
  window.electronAPI.getDownloadProgress(async (data) => {
    let JsonData = data;
    if(JsonData?.Status === "NewDownload"){
      let MediaDownloadElementContainer = document.querySelector(".download-categorie-container");
      let emptyLibText = MediaDownloadElementContainer.querySelector("#div-text");
      if(emptyLibText) emptyLibText.remove()
      loadDownloadMediaFromLib();
    }
  });
}

function handleCancelButton(mediaInfo,MediaDownloadElement) {
  let cancelDownloadButton = MediaDownloadElement.querySelector(".cancel-button");
  cancelDownloadButton.addEventListener("click",async()=>{
    await window.electronAPI.cancelDownload(mediaInfo);
    let TargetDownloadElement = document.getElementById(mediaInfo?.torrentId);
    TargetDownloadElement.remove();
    let MediaDownloadElementContainer = document.querySelector(".download-categorie-container");
    if(MediaDownloadElementContainer.innerHTML.trim() === "")
      putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 

    updateDownloadUI();
  });
}

let loadingIntervals = {};
function handleTogglingPauseButton(torrentId,MediaDownloadElement) {
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");

  PausePlayButton.addEventListener("click",async ()=>{
    let pauseResponces = await window.electronAPI.toggleTorrentDownload(torrentId);
    await handlingDownloadCategorieChanging(pauseResponces);
  });
}

function addingLoadingAnimation(torrentId,downloadSpeedElement,PausePlayButton) {
  PausePlayButton.classList.add("requesting-continue-download");

  let counter = 1;
  downloadSpeedElement.innerHTML = "loading ."
  loadingIntervals[torrentId] = setInterval(()=>{
    let dots = ["",".",". .",". . ."];
    downloadSpeedElement.innerHTML = "loading "+dots[counter % dots.length];
    counter ++;
  },500);
}

async function removeLoadingAnimation(torrentId,PausePlayButton,NewStatus) {
  PausePlayButton.classList.remove("requesting-continue-download");
  clearInterval(loadingIntervals[torrentId]);
  delete loadingIntervals[torrentId];
  await SaveDownloadStatus(torrentId, NewStatus);
}

async function SaveDownloadStatus(torrentId, Status) {
  await window.electronAPI.editElementInDownloadLibraryInfo(torrentId, "Status", Status);
}

function alignSizeDiv() {
  let downloadTorrent = document.querySelectorAll(".download-media");
  downloadTorrent.forEach(element=>{
    let ProgressBar = element.querySelector(".progress-bar-div");
    let sizeDiv = element.querySelector(".movie-size-div");
    sizeDiv.style.maxWidth = ProgressBar.offsetWidth;
  });
}

// Helper function to hide context menu with animation
function hideContextMenu(menuDiv) {
  menuDiv.classList.remove("visible");
  setTimeout(() => {
    menuDiv.classList.remove("show");
  }, 30);
}

// Helper function to show context menu with animation
function showContextMenu(menuDiv) {
  menuDiv.classList.add("show");
  // Force reflow to ensure transition works
  menuDiv.offsetHeight;
  setTimeout(() => {
    menuDiv.classList.add("visible");
  }, 10);
}

// Updated context menu handler with improved click-outside detection
function setupContextMenuHandler(contextMenuButton, contextMenuDiv) {
  let isMenuOpen = false;

  contextMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    
    if (!isMenuOpen) {
      // Close any other open menus first
      document.querySelectorAll(".select-dropdown.visible").forEach(menu => {
        if (menu !== contextMenuDiv) {
          hideContextMenu(menu);
        }
      });
      
      showContextMenu(contextMenuDiv);
      isMenuOpen = true;
      
      // Add click-outside handler
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
    } else {
      hideContextMenu(contextMenuDiv);
      isMenuOpen = false;
      document.removeEventListener("click", handleClickOutside);
    }
  });

  function handleClickOutside(event) {
    // Check if click is outside both button and menu
    if (!contextMenuButton.contains(event.target) && 
        !contextMenuDiv.contains(event.target)) {
      hideContextMenu(contextMenuDiv);
      isMenuOpen = false;
      document.removeEventListener("click", handleClickOutside);
    }
  }
}

function createContextMenuDiv(totalSizeElement,MediaInfo) {
  const menuDiv = document.createElement("div");
  menuDiv.classList.add("select-dropdown");

  const updateSubtitles = document.createElement("div");
  updateSubtitles.textContent = "Update Subtitles";
  updateSubtitles.classList.add("select-option");

  const updatePosters = document.createElement("div");
  updatePosters.textContent = "Update Posters";
  updatePosters.classList.add("select-option");

  updateSubtitles.addEventListener("click", async(e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);

    const totalSizeElementContaint = totalSizeElement.innerHTML;
    totalSizeElement.innerHTML = `<div class="loading-gif"> </div> updating subtitles`;

    const subsObjects = await loadingAllSubs(MediaInfo.IMDB_ID);

    window.electronAPI.downloadSubtitles(MediaInfo,  subsObjects).then((res) => {
      if (res?.updated) {
        totalSizeElement.innerHTML = "Subtitles Updated ✔";
        setTimeout(() => {
          totalSizeElement.innerHTML = totalSizeElementContaint;
        },3000);

      } else {
        totalSizeElement.innerHTML = "Failed To Update Subtitles ⨯";
        setTimeout(() => {
          totalSizeElement.innerHTML = totalSizeElementContaint;
        },3000);
      }
    });

  });

  updatePosters.addEventListener("click", (e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);
  });

  menuDiv.appendChild(updateSubtitles);
  menuDiv.appendChild(updatePosters);

  return menuDiv;
}

function MarkDownloadElementAsFinished(MediaDownloadElement, MediaInfo) {
  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  let progressBarElement = MediaDownloadElement.querySelector(".progress-div");
  let downloadedSizeElement = MediaDownloadElement.querySelector(".downloaded-size");
  let totalSizeElement = MediaDownloadElement.querySelector(".total-size");
  let rightDiv = MediaDownloadElement.querySelector(".download-movie-right-div");
  let dragButton = MediaDownloadElement.querySelector(".drag-button");
  
  // Remove existing context menu if any
  let existingContextMenu = MediaDownloadElement.querySelector(".context-menu-button");
  if (existingContextMenu) existingContextMenu.remove();
  
  let contextMenuButton = document.createElement("button");
  let contextMenuDiv = createContextMenuDiv(totalSizeElement,MediaInfo);

  PercentageTextElement.style.display = "none";
  downloadSpeedElement.style.display = "none";
  progressBarElement.style.display = "none";
  downloadedSizeElement.style.display = "none";
  if (dragButton) dragButton.remove();

  PausePlayButton.classList.add("completed", "just-finished");
  CancelButton.classList.add("completed", "just-finished");
  contextMenuButton.classList.add("context-menu-button");

  contextMenuButton.innerHTML = menuThreePoints;
  PausePlayButton.innerHTML = `${videoIcon}<p style="margin-bottom:20%"> Watch</p>`;
  totalSizeElement.innerText = `${totalSizeElement.innerText} • Completed`;
  CancelButton.innerHTML = closedTrashIcon;
  
  rightDiv.appendChild(PausePlayButton);
  rightDiv.appendChild(CancelButton);
  MediaDownloadElement.appendChild(contextMenuButton);
  contextMenuButton.appendChild(contextMenuDiv);

  setTimeout(() => {
    PausePlayButton.classList.remove("just-finished");
    CancelButton.classList.remove("just-finished");
  }, 600);

  // Setup context menu with improved handler
  setupContextMenuHandler(contextMenuButton, contextMenuDiv);

  const newPausePlayButton = removeAllListeners(PausePlayButton);

  newPausePlayButton.addEventListener("click", (event) => {
    event.stopPropagation();
    let episodeInfo = {
      "seasonNumber": MediaInfo.seasonNumber, 
      "episodeNumber": MediaInfo.episodeNumber
    };
    openMediaVideo(
      MediaInfo.torrentId,
      MediaInfo.MediaId, 
      MediaInfo.MediaType, 
      MediaInfo.downloadPath,
      MediaInfo.fileName,
      MediaInfo.Magnet,
      MediaInfo.IMDB_ID,
      MediaInfo.bgImagePath,
      episodeInfo
    );
  });
}

function removeAllListeners(elementToReplace){
  const newElement = elementToReplace.cloneNode(true);
  elementToReplace.parentNode.replaceChild(newElement, elementToReplace);
  return newElement;
}

function MarkDownloadElementAsPaused(MediaDownloadElement) {
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  const dragButton = MediaDownloadElement.querySelector(".drag-button");
  let elementId = MediaDownloadElement.id; 

  if(dragButton) dragButton.remove();
  downloadSpeedElement.innerHTML = "";
  PausePlayButton.innerHTML = playIcon;

  setTimeout(() => {
    PausePlayButton.classList.remove("just-finished");
  }, 600);

  removeLoadingAnimation(elementId,PausePlayButton,"Paused"); 
}

function MarkDownloadElementAsLoading(MediaDownloadElement) {
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  let rightDiv = MediaDownloadElement.querySelector(".download-movie-right-div");
  let elementId = MediaDownloadElement.id;
  const dragButton = document.createElement("button")

  dragButton.className = "drag-button";
  dragButton.innerHTML = twoBarsIcon;
  rightDiv.appendChild(dragButton);

  PausePlayButton.innerHTML = pauseIcon;
  downloadSpeedElement.innerHTML = "loading"

  addingLoadingAnimation(elementId,downloadSpeedElement,PausePlayButton);
  let posterImage = MediaDownloadElement.querySelector(".poster-img").src;
  addBackgroundImageToDownloadingDiv(MediaDownloadElement,posterImage);
}

function monitorErrors() {
  window.electronAPI.getDownloadErrorsReports(async (errorReport) => {
    let MediaDownloadElement = document.getElementById(errorReport.torrentId);
    MarkDownloadElementAsPaused(MediaDownloadElement)
    console.error(`${errorReport?.type} Error: ${errorReport.torrentId}\n${errorReport.err_msg}`);
  });
}

async function loadCachedPageInfo() {
  let cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(cachedData){
    console.log("Loading Cached Information");
    let downloadMediaContainerScrollTopValue = cachedData.download_container_top_scroll_value;
    let downloadMediaContainer = document.querySelector(".download-categorie-container");
    downloadMediaContainer.scrollTop = downloadMediaContainerScrollTopValue;
  }
}

function updateDownloadUI() {
  handleEmptyDownloadCategories();
  updateElementsCounterForEachContainer();
}

function handleEmptyDownloadCategories() {
  const categories = document.querySelectorAll(".downloads-categorie:not(#currently-downloading-div)");

  for(const downloadCategorieDiv of categories){

    let downloadElementsContainer = downloadCategorieDiv.querySelector(".movieContainer");
    if(downloadElementsContainer.innerHTML.trim() === "") {
      downloadCategorieDiv.style.display = "none";
    } else {
      downloadCategorieDiv.style.display = "block";

    }
  }
  
  const currentlyDownloadingContainer = currentlyDownloadingDiv.querySelector(".movieContainer");
  if(currentlyDownloadingContainer) {
    if(currentlyDownloadingContainer.innerHTML.trim() === ""){
      currentlyDownloadingContainer.innerHTML = `<p class="empty-container" id="nothing-is-downloading"> Nothing is downloading </p>`;
      removeDownloadBackgroundDiv();

    } else {
      const nothingIsDownloadingElement = document.getElementById("nothing-is-downloading");
      if(nothingIsDownloadingElement)
        nothingIsDownloadingElement.remove();
    }
  }
}

function updateElementsCounterForEachContainer() {
  const categories = document.querySelectorAll(".downloads-categorie");

  for(const downloadCategorieDiv of categories){
    const downloadElementsContainer = downloadCategorieDiv.querySelector(".movieContainer");
    const downloadingMedias = downloadElementsContainer.querySelectorAll(".download-media");
    const counterElement = downloadCategorieDiv.querySelector(".downloads-counter");
    counterElement.innerText = downloadingMedias.length;
  }

}

async function addBackgroundImageToDownloadingDiv(mediaElement, posterImage) {
  removeDownloadBackgroundDiv();
  if(mediaElement && posterImage && posterImage.trim() !== "") {
    let backgroundImageDiv = document.createElement("div");
    backgroundImageDiv.className = "currently-downloading-background-div";

    backgroundImageDiv.classList.remove("shown");   
    await makeSureImageIsLoaded(posterImage);
    backgroundImageDiv.style.backgroundImage = `url('${posterImage}')`;
    currentlyDownloadingDiv.prepend(backgroundImageDiv);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backgroundImageDiv.classList.add("shown");
      });
    });
  }
}

function removeDownloadBackgroundDiv() {
  const downloadBackgroundDiv = document.querySelector(".currently-downloading-background-div");
  if (downloadBackgroundDiv) {
    downloadBackgroundDiv.remove();
  }

}

function makeSureImageIsLoaded(imagePath) {
  return new Promise((resolve) => {
    if (!imagePath) {
      resolve();
      return;
    }

    const tryLoad = () => {
      const img = new Image();

      img.onload = () => {
        console.log(`Image Successfully loaded: ${imagePath}`);
        resolve();
      };

      img.onerror = () => {
        console.log(`Failed To load Image: ${imagePath}, retrying...`);
        setTimeout(tryLoad, 1000);
      };

      img.src = `${imagePath}?t=${Date.now()}`;
    };

    tryLoad();
  });
}


function handleDownloadCategoryUpdateFromMain() {
  window.electronAPI.updateDownloadCategorie(res => {
    handlingDownloadCategorieChanging(res);
  });
}

async function handlingDownloadCategorieChanging(categorieChangedTorrents) {
  for(const res of categorieChangedTorrents) {
    let targetElement = document.getElementById(res?.torrentId);
    let targetElementCategorie;

    if((res?.response  === "paused" || res?.response === "queued") && res?.torrentId){
      if(targetElement){
        if(res?.response  === "paused"){
          targetElementCategorie = pausedDownloadsDiv;
        } else if(res?.response === "queued") {
          targetElementCategorie = queuedDownloadsDiv;
        }
        MarkDownloadElementAsPaused(targetElement);
      }

    } else if(res?.response  === "continued" && res?.torrentId){
      if(targetElement){
        MarkDownloadElementAsLoading(targetElement);
        targetElementCategorie = currentlyDownloadingDiv;
      }
      await SaveDownloadStatus(res.torrentId, "Loading");

    } else if(res?.response === "failed"){
      console.log(`Failed to start: ${res.torrentId}: ${res.error}`);
      if(targetElement){
        MarkDownloadElementAsPaused(targetElement)
        targetElementCategorie = pausedDownloadsDiv;
      }

    } else {
      console.error("Cannot Find Torrent: ",res?.torrentId);
      if(targetElement){
        MarkDownloadElementAsPaused(targetElement)
        targetElementCategorie = pausedDownloadsDiv;
      }
    }

    const targetElementContainer = targetElementCategorie.querySelector(".movieContainer");
    if(targetElementContainer){
      targetElementContainer.appendChild(targetElement);
    }

  }
  updateDownloadUI();
}

window.addEventListener("resize",()=>{
  alignSizeDiv();
});

setupKeyPressesHandler();
loadDownloadMediaFromLib();
handleDownloadCategoryUpdateFromMain();
refreshEnties();
setLeftButtonStyle("btn-download");
loadIconsDynamically();
