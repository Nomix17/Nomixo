const currentlyDownloadingDiv = document.getElementById("currently-downloading-div");
const queuedDownloadsDiv  = document.getElementById("download-queue-div");
const pausedDownloadsDiv = document.getElementById("download-paused-div");
const doneDownloadsDiv = document.getElementById("download-done-div");
const libraryDumpPromise = window.electronAPI.loadDownloadLibraryInfo() 

let monitoringProgress = false;
async function loadDownloadMediaFromLib() {
  const library = await libraryDumpPromise;

  if(library != null){
    const sortedLib = library.downloads
      .sort((item1, item2) =>
        (item1?.["StatusUpdateTime"] ?? 0) - (item2?.["StatusUpdateTime"] ?? 0)
      );

    for(let mediaLibEntryPoint of sortedLib){
      createDownloadElement(mediaLibEntryPoint);
    }
    const queueList = await window.electronAPI.getDownloadQueueList();
    reorderDownloadQueue(queueList, false);
  }

  if(library?.downloads?.length !== 0){
    if(!monitoringProgress){
      monitorDownloads();
      monitorErrors();
    }
  }

  let RightmiddleDiv = document.getElementById("div-middle-right");
  RightmiddleDiv.classList.add("activate");


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
    addBackgroundImageToDownloadingDiv(MediaDownloadElement,mediaLibEntryPoint?.bgImagePath ?? mediaLibEntryPoint?.posterPath);

    if (downloadStatus.toLowerCase() === "loading") {
      if(!loadingIntervals?.[mediaLibEntryPoint.torrentId])
        addingLoadingAnimation(mediaLibEntryPoint.torrentId,downloadSpeedElement,PausePlayButton);
    }

  } else if(downloadStatus.toLowerCase() === "done") {
    downloadCategorie = doneDownloadsDiv;
    MarkDownloadElementAsFinished(MediaDownloadElement,mediaLibEntryPoint);

  } else if(downloadStatus.toLowerCase() === "queued") {
    downloadCategorie = queuedDownloadsDiv;
    MarkDownloadElementAsQueued(MediaDownloadElement);

  } else {
    downloadCategorie = pausedDownloadsDiv;
    MarkDownloadElementAsPaused(MediaDownloadElement);
    if(downloadStatus.toLowerCase() !== "paused")
      console.log(downloadStatus, "Is Unknown Download Status");
  }

  handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
  const downloadContainer = downloadCategorie.querySelector(".movieContainer");
  downloadContainer.appendChild(MediaDownloadElement);

  handleCancelButton(mediaLibEntryPoint,CancelButton);
  alignSizeDiv();

  let RightmiddleDiv = document.getElementById("div-middle-right");
  RightmiddleDiv.classList.add("activate");
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
        makeSurePosterIsLoaded(libraryEntryPoint, PosterDiv,PosterElement)
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

    if(loadingIntervals?.[DownloadElementIdentifier]) {
      removeLoadingAnimation(DownloadElementIdentifier,PausePlayButton);
      SaveDownloadStatus(DownloadElementIdentifier, "Downloading");
    }

    DownloadedSizeTextElement.innerText =  calculatedDownloadedSize + " GB";
    TotalSizeTextElement.innerText = calculatedTotalSize + " GB";
    downloadSpeedElement.innerText = calculatedDownloadSpeedInKB < 1000 ? calculatedDownloadSpeedInKB + " Kb/s": calculatedDownloadSpeedInMB + " Mb/s";
    PercentageTextElement.innerText = calculatedProgress + " %";
    insiderProgressBar.style.width = calculatedProgress+ "%";

    PausePlayButton.innerHTML = pauseIcon;
    CancelButton.innerHTML = xRemoveIcon;

    if(JsonData?.Status.toLowerCase() === "done"){
      const library = await libraryDumpPromise;
      const libraryElement = library.downloads.find(element => element.torrentId === JsonData.TorrentId);
      let doneDownloadContainer = doneDownloadsDiv.querySelector(".movieContainer");
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

function refreshEntries() {
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

function handleCancelButton(mediaInfo,cancelDownloadButton) {
  if(cancelDownloadButton) {
    cancelDownloadButton.addEventListener("click",async () => {
      window.electronAPI.cancelDownload(mediaInfo);
      let TargetDownloadElement = document.getElementById(mediaInfo?.torrentId);
      TargetDownloadElement.remove();
      let MediaDownloadElementContainer = document.querySelector(".download-categorie-container");
      if(MediaDownloadElementContainer.innerHTML.trim() === "")
        putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 

      updateDownloadUI();
    });
  }
}

let loadingIntervals = {};
function handleTogglingPauseButton(torrentId,MediaDownloadElement) {
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  if(PausePlayButton) {
    PausePlayButton.addEventListener("click",async ()=>{
      let pauseResponces = await window.electronAPI.toggleTorrentDownload(torrentId);
      await handleDownloadCategorieChanging(pauseResponces);
    });
  }
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

function removeLoadingAnimation(torrentId,PausePlayButton) {
  PausePlayButton.classList.remove("requesting-continue-download");
  clearInterval(loadingIntervals[torrentId]);
  delete loadingIntervals[torrentId];
}

async function SaveDownloadStatus(torrentId, Status) {
  await window.electronAPI.editElementInDownloadLibraryInfo(
    torrentId, "Status", Status
  );
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

async function createPausedDownloadsContextMenu(torrentId) {
  const menuDiv = document.createElement("div");
  menuDiv.classList.add("select-dropdown");

  const addToQueue = document.createElement("div");
  addToQueue.textContent = "Add to download queue";
  addToQueue.classList.add("select-option");
  
  const cancelDownload = document.createElement("div");
  cancelDownload.textContent = "Cancel the download";
  cancelDownload.classList.add("select-option");

  const library = await libraryDumpPromise;
  const targetLibInfo = library?.downloads.find(element => element.torrentId === torrentId);

  addToQueue.addEventListener("click", async (e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);
    if(targetLibInfo != null) {
      const res = await window.electronAPI.addTorrentToDownloadQueue(torrentId);
      await handleDownloadCategorieChanging(res);
    }
  });

  handleCancelButton(targetLibInfo,cancelDownload);
  cancelDownload.addEventListener("click", async(e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);
  });


  menuDiv.appendChild(addToQueue);
  menuDiv.appendChild(cancelDownload);

  return menuDiv;
}

async function removePausedDownloadsContextMenu(MediaDownloadElement) {
  const contextMenu = MediaDownloadElement.querySelector(".context-menu-button");
  const contextBtn = document.querySelector(".select-dropdown");
  if(contextMenu) contextMenu.remove();
  if(contextBtn) contextBtn.remove();
}

function createFinishedDownloadsContextMenu(totalSizeElement,MediaInfo) {
  const menuDiv = document.createElement("div");
  menuDiv.classList.add("select-dropdown");

  const playWithExternalPlayerOption = document.createElement("div");
  playWithExternalPlayerOption.textContent = "Play Using External Player";
  playWithExternalPlayerOption.classList.add("select-option");

  const playWithInternalPlayerOption = document.createElement("div");
  playWithInternalPlayerOption.textContent = "Play Using Built-in Player";
  playWithInternalPlayerOption.classList.add("select-option");

  const updatePosterOption = document.createElement("div");
  updatePosterOption.textContent = "Update Poster Image";
  updatePosterOption.classList.add("select-option");

  const updateSubtitlesOption = document.createElement("div");
  updateSubtitlesOption.textContent = "Update Subtitles";
  updateSubtitlesOption.classList.add("select-option");

  [playWithExternalPlayerOption, playWithInternalPlayerOption].forEach((option,index) => {
    option.addEventListener("click", (event) => {
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
        episodeInfo,
        (index === 0) ? "external" : "internal"
      );
    });
  });

  updatePosterOption.addEventListener("click", async (e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);
    
    const totalSizeElementContaint = totalSizeElement.innerHTML;
    totalSizeElement.innerHTML = `<div class="loading-gif"> </div> updating poster`;

    const apiKey = await window.electronAPI.getTMDBAPIKEY().then();
    const posterFileName = await getPosterPath(MediaInfo.IMDB_ID, apiKey);
    const res = await window.electronAPI.downloadImage(MediaInfo.downloadPath, `https://image.tmdb.org/t/p/w500/${posterFileName}`);

    if (res.download_result === "success") {
      await window.electronAPI.editElementInDownloadLibraryInfo(
        MediaInfo.torrentId,
        "posterPath",
        res.image_path
      );
    }

    totalSizeElement.innerHTML = 
      res.download_result === "success" 
        ? "Poster Updated ✔" 
        : "Failed To Update Poster ⨯"

    setTimeout(() => {
      totalSizeElement.innerHTML = totalSizeElementContaint;
    },3000);
  });

  updateSubtitlesOption.addEventListener("click", async(e) => {
    e.stopPropagation();
    hideContextMenu(menuDiv);

    const totalSizeElementContaint = totalSizeElement.innerHTML;
    totalSizeElement.innerHTML = `<div class="loading-gif"> </div> updating subtitles`;

    const subsObjects = await loadingAllSubs(MediaInfo.IMDB_ID);

    const res = await window.electronAPI.downloadSubtitles(MediaInfo,  subsObjects);
    totalSizeElement.innerHTML = res?.updated ? "Subtitles Updated ✔" : "Failed To Update Subtitles ⨯";
    setTimeout(() => {
      totalSizeElement.innerHTML = totalSizeElementContaint;
    },3000);

  });

  menuDiv.appendChild(playWithExternalPlayerOption);
  menuDiv.appendChild(playWithInternalPlayerOption);
  menuDiv.appendChild(updatePosterOption);
  menuDiv.appendChild(updateSubtitlesOption);

  return menuDiv;
}

function MarkDownloadElementAsFinished(MediaDownloadElement, MediaInfo) {
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  let progressBarElement = MediaDownloadElement.querySelector(".progress-div");
  let downloadedSizeElement = MediaDownloadElement.querySelector(".downloaded-size");
  let totalSizeElement = MediaDownloadElement.querySelector(".total-size");
  let rightDiv = MediaDownloadElement.querySelector(".download-movie-right-div");
  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  const downloadMovieRightDiv = MediaDownloadElement.querySelector(".download-movie-right-div");

  CancelButton.remove();
  PausePlayButton.remove();

  let existingContextMenu = MediaDownloadElement.querySelector(".context-menu-button");
  if (existingContextMenu) existingContextMenu.remove();
  
  let contextMenuButton = document.createElement("button");
  let contextMenuDiv = createFinishedDownloadsContextMenu(totalSizeElement, MediaInfo);
  
  PercentageTextElement.style.display = "none";
  downloadSpeedElement.style.display = "none";
  progressBarElement.style.display = "none";
  downloadedSizeElement.style.display = "none";

  downloadMovieRightDiv.classList.remove("up-side-down");
  const playMediaButton = document.createElement("button");
  const deleteMediaButton = document.createElement("button");
  playMediaButton.classList.add("play-button");
  deleteMediaButton.classList.add("delete-button");

  playMediaButton.classList.add("completed", "just-finished");
  deleteMediaButton.classList.add("completed", "just-finished");
  contextMenuButton.classList.add("context-menu-button");
  contextMenuButton.innerHTML = menuThreePoints;
  playMediaButton.innerHTML = `${videoIcon}<p style="margin-bottom:20%"> Watch</p>`;
  totalSizeElement.innerText = `${totalSizeElement.innerText} • Completed`;
  deleteMediaButton.innerHTML = closedTrashIcon;
  
  rightDiv.appendChild(playMediaButton);
  rightDiv.appendChild(deleteMediaButton);
  MediaDownloadElement.appendChild(contextMenuButton);
  contextMenuButton.appendChild(contextMenuDiv);
  
  setTimeout(() => {
    playMediaButton.classList.remove("just-finished");
    deleteMediaButton.classList.remove("just-finished");
  }, 600);
  
  setupContextMenuHandler(contextMenuButton, contextMenuDiv);
  
  playMediaButton.addEventListener("click", (event) => {
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

  setupDeleteButtonLogic(MediaInfo, deleteMediaButton);
}

let deleteOverlayEscapeHandler = null;
function setupDeleteButtonLogic(MediaInfo, deleteMediaButton) {
  const deleteMediaOverlay = document.getElementById("deleteOverlay");
  
  const deleteMediaButtonNew = deleteMediaButton.cloneNode(true);
  deleteMediaButton.parentNode.replaceChild(deleteMediaButtonNew, deleteMediaButton);
  
  deleteMediaButtonNew.addEventListener("click", (event) => {
    dontGoBack = true;
    fillingDeleteOverlay(MediaInfo);
    
    let closeBtn = deleteMediaOverlay.querySelector('#closeBtn');
    let cancelBtn = deleteMediaOverlay.querySelector('#cancelBtn');
    let deleteBtn = deleteMediaOverlay.querySelector('#deleteBtn');
    
    const closeBtnNew = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(closeBtnNew, closeBtn);
    
    const cancelBtnNew = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(cancelBtnNew, cancelBtn);
    
    const deleteBtnNew = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(deleteBtnNew, deleteBtn);
    
    closeBtn = closeBtnNew;
    cancelBtn = cancelBtnNew;
    deleteBtn = deleteBtnNew;
    
    deleteMediaOverlay.classList.add("active");
    
    [cancelBtn, closeBtn].forEach(btn => {
      btn.addEventListener("click", () => {
        deleteMediaOverlay.classList.remove("active");
      });
    });
    
    handleCancelButton(MediaInfo, deleteBtn);
    deleteBtn.addEventListener("click", () => {
      deleteMediaOverlay.classList.remove("active");
    });
  });
 
  if (deleteOverlayEscapeHandler) {
    document.removeEventListener("keydown", deleteOverlayEscapeHandler);
  }
  
  deleteOverlayEscapeHandler = (event) => {
    if(event.key === "Escape") {
      deleteMediaOverlay.classList.remove("active");
    }
  };
  
  document.addEventListener("keydown", deleteOverlayEscapeHandler);
}

function fillingDeleteOverlay(MediaInfo) {
  const deleteOverlay = document.getElementById('deleteOverlay');

  const mediaPosterContainer = deleteOverlay.querySelector('#mediaPoster');
  const mediaPosterImg = deleteOverlay.querySelector('#mediaPosterImg');
  const mediaTitle = deleteOverlay.querySelector('#mediaTitle');
  const seasonEpisode = deleteOverlay.querySelector('#season-episode');
  const mediaSize = deleteOverlay.querySelector('#mediaSize');
  const mediaYear = deleteOverlay.querySelector('.media-year');

  loadImageWithAnimation(mediaPosterContainer, mediaPosterImg, MediaInfo.posterPath);

  mediaTitle.innerHTML = MediaInfo.Title;
  mediaSize.innerHTML = MediaInfo.Size +" • "+MediaInfo.Quality;

  mediaYear.innerHTML = MediaInfo.Year;
  if(MediaInfo.seasonNumber && MediaInfo.episodeNumber)
    seasonEpisode.innerText = `S${MediaInfo.seasonNumber}-E${MediaInfo.episodeNumber}`;
}

async function MarkDownloadElementAsIdle(MediaDownloadElement) {
  const PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  const downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  const elementId = MediaDownloadElement.id;

  downloadSpeedElement.innerHTML = "";
  PausePlayButton.innerHTML = playIcon;

  setTimeout(() => {
    PausePlayButton.classList.remove("just-finished");
  }, 600);

  removeLoadingAnimation(elementId,PausePlayButton); 
}

async function MarkDownloadElementAsPaused(MediaDownloadElement) {
  const elementId = MediaDownloadElement.id;
  SaveDownloadStatus(elementId, "Paused");

  MarkDownloadElementAsIdle(MediaDownloadElement);
  const oldContextMenuButton = MediaDownloadElement.querySelector(".context-menu-button");

  if(oldContextMenuButton == null) {
    const contextMenuButton = document.createElement("button");
    contextMenuButton.classList.add("context-menu-button");
    contextMenuButton.innerHTML = menuThreePoints;
    const contextMenuDiv = await createPausedDownloadsContextMenu(elementId);
    contextMenuButton.appendChild(contextMenuDiv);
    setupContextMenuHandler(contextMenuButton, contextMenuDiv);
    MediaDownloadElement.appendChild(contextMenuButton);
  }

  const shiftingArrows = MediaDownloadElement.querySelectorAll(".btn-arrow");
  shiftingArrows.forEach(el => el.remove());
}

async function MarkDownloadElementAsQueued(MediaDownloadElement) {
  const elementId = MediaDownloadElement.id;
  SaveDownloadStatus(elementId, "Queued");

  MarkDownloadElementAsIdle(MediaDownloadElement);
  removePausedDownloadsContextMenu(MediaDownloadElement);

  const shiftingArrows = MediaDownloadElement.querySelector(".btn-arrow");
  const downloadMovieRightDiv = MediaDownloadElement.querySelector(".download-movie-right-div");
  downloadMovieRightDiv.classList.add("up-side-down");
  if(!shiftingArrows) {
    const upArrow = document.createElement("button");
    const downArrow = document.createElement("button");
    upArrow.classList.add("btn-arrow", "up-arrow");
    downArrow.classList.add("btn-arrow", "down-arrow");
    upArrow.innerHTML = upArrowIcon;
    downArrow.innerHTML = downArrowIcon;

    [upArrow,downArrow].forEach((el, elIndex) => {
      el.addEventListener("click", async () => {
        const newOrder = 
          await window.electronAPI.shiftDownloadQueueElement (
            elementId,
            (elIndex * 2) - 1 // either 1 or -1
          );
        reorderDownloadQueue(newOrder);
      });
    });

    downloadMovieRightDiv.append(upArrow, downArrow);
  }
}

async function MarkDownloadElementAsLoading(MediaDownloadElement) {
  const PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  const downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  const elementId = MediaDownloadElement.id;
  const contextMenuButton = MediaDownloadElement.querySelector(".context-menu-button");
  if(contextMenuButton != null) contextMenuButton.remove();
  const shiftingArrows = MediaDownloadElement.querySelectorAll(".btn-arrow");
  shiftingArrows.forEach(el => el.remove());

  PausePlayButton.innerHTML = pauseIcon;
  downloadSpeedElement.innerHTML = "loading"

  addingLoadingAnimation(elementId,downloadSpeedElement,PausePlayButton);
  let posterImage = MediaDownloadElement.querySelector(".poster-img").src;
  const targetTorrentInfo = (await libraryDumpPromise)?.downloads
    .find(el => el.torrentId === elementId);
  addBackgroundImageToDownloadingDiv(
    MediaDownloadElement,
    targetTorrentInfo?.bgImagePath ?? posterImage
  );
}

function reorderDownloadQueue(newOrder, animateTransition=true) {
  try {
    const queuedElContainer = queuedDownloadsDiv.querySelector(".movieContainer");
    const reordedEls = newOrder.map(elId => {
      const targetEl = document.getElementById(elId);
      if (!targetEl)
        throw new Error(`Cannot find media with ID: ${elId}`);
      return targetEl;
    });

    const oldPosition = new Map(
      reordedEls.map(el => [el, el.getBoundingClientRect()])
    );

    queuedElContainer.append(...reordedEls);
    if(animateTransition)
      animateReorder(reordedEls, oldPosition);

  } catch (error) {
    console.error(error.message);
  }

  updateDownloadUI();
}

function animateReorder(elements, beforePositions) {
  elements.forEach(el => {
    const before = beforePositions.get(el);
    const after = el.getBoundingClientRect();

    const delta = {
      x: before.left - after.left,
      y: before.top  - after.top,
    };

    const hasMoved = delta.x !== 0 || delta.y !== 0;
    if (!hasMoved) return;

    el.animate(
      [
        { transform: `translate(${delta.x}px, ${delta.y}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 300, easing: "ease-in-out" }
    );
  });
}

function disableBorderArrowBtnsForQueuedEls() {
  const queuedEls = queuedDownloadsDiv.querySelectorAll(".movieContainer .download-media");
  if(!queuedEls.length) return;
  queuedEls.forEach( el =>
    el.querySelectorAll(".btn-arrow").forEach(arrowEl => {
      arrowEl.classList.remove("disabled");
    })
  );

  const topUpArrow = queuedEls[0].querySelector(".up-arrow");
  const bottomDownArrow = queuedEls[queuedEls.length - 1].querySelector(".down-arrow");
  bottomDownArrow.classList.add("disabled");
  topUpArrow.classList.add("disabled");
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
  disableBorderArrowBtnsForQueuedEls();
}

function handleEmptyDownloadCategories() {
  const categories = document.querySelectorAll(".downloads-categorie");
  
  for(const downloadCategorieDiv of categories){
    const container = downloadCategorieDiv.querySelector('.movieContainer');
    const isEmpty = [...container.children].every(el => el.matches('p.empty-container-text'));
    const emptyParagraph = downloadCategorieDiv.querySelector('.empty-container-text')
    const elementCategoryControllBtn = downloadCategorieDiv.querySelector("button");
    if(emptyParagraph)
      emptyParagraph.classList.toggle('hidden', !isEmpty);
    if(elementCategoryControllBtn)
      elementCategoryControllBtn.classList.toggle("disabled", isEmpty);
    downloadCategorieDiv.style.display = "block";

    if(
      isEmpty &&
      downloadCategorieDiv.id === "currently-downloading-div"
    )
      removeDownloadBackgroundDiv();

    if (
      isEmpty && (
        downloadCategorieDiv.id === "download-queue-div" ||
        downloadCategorieDiv.id === "download-paused-div"
      )
    ) {
      downloadCategorieDiv.style.display = "none";
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
    handleDownloadCategorieChanging(res);
  });
}

async function handleDownloadCategorieChanging(categorieChangedTorrents) {
  const DOWNLOAD_CATEGORIES = {
    paused: {categoryDiv: pausedDownloadsDiv, applyUIState: MarkDownloadElementAsPaused, SaveStatus: "Paused" },
    queued: {categoryDiv: queuedDownloadsDiv, applyUIState: MarkDownloadElementAsQueued, SaveStatus: "Queued"},
    continued: {categoryDiv: currentlyDownloadingDiv, applyUIState: MarkDownloadElementAsLoading, SaveStatus: "Loading"},
    failed: {categoryDiv: pausedDownloadsDiv, applyUIState: MarkDownloadElementAsPaused, SaveStatus: null}
  };

  for(const res of categorieChangedTorrents) {
    let targetElement = document.getElementById(res?.torrentId);
    if(!targetElement) {
      console.error("Cannot find Download Element with Id:", res?.torrentId);
      continue;
    }

    if(loadingIntervals?.[res?.torrentId]) {
      const PausePlayButton = targetElement.querySelector(".toggle-pause-button");
      removeLoadingAnimation(res.torrentId, PausePlayButton);
    }

    const category = DOWNLOAD_CATEGORIES?.[res.response];
    if(category == null) {
      console.error("Undefined category: ", res.response);
      continue;
    }

    category?.applyUIState(targetElement);
    if(res?.response === "failed"){
      console.log(`Failed to start: ${res.torrentId}: ${res.error}`);
    }

    if(category.saveStatus)
      await SaveDownloadStatus(res.torrentId, category.saveStatus);

    const targetElementContainer = category?.categoryDiv?.querySelector(".movieContainer");
    targetElementContainer.appendChild(targetElement);
  }
  updateDownloadUI();
}

function setupCategoryBtn() {
  const queueAllDownloadBtn = pausedDownloadsDiv.querySelector("button");
  const pauseAllDownloadBtn = queuedDownloadsDiv.querySelector("button");

  queueAllDownloadBtn.addEventListener("click", async() => {
    const libraryInfo = await window.electronAPI.loadDownloadLibraryInfo()
    const pausedEntries = libraryInfo?.downloads
      ?.filter(entry =>
        entry.Status.toLowerCase() === "paused"
      );
    for(const entry of pausedEntries) {
      if(entry?.torrentId != null) {
        const res = await window.electronAPI.addTorrentToDownloadQueue(entry?.torrentId);
        await handleDownloadCategorieChanging(res);
      } else {
        console.log("Failed to load torrent id");
      }
    }
  });

  pauseAllDownloadBtn.addEventListener("click", async() => {
    const libraryInfo = await window.electronAPI.loadDownloadLibraryInfo()
    const queuedEntries = libraryInfo?.downloads
      ?.filter(entry =>
        entry.Status.toLowerCase() === "queued"
      );
    for(const entry of queuedEntries) {
      if(entry?.torrentId != null) {
        const res = await window.electronAPI.removeTorrentFromDownloadQueue(entry.torrentId);
        await handleDownloadCategorieChanging(res);
      } else {
        console.log("Failed to load torrent id");
      }
    }
  });
}

window.addEventListener("resize",()=>{
  alignSizeDiv();
});

setupKeyPressesHandler();
loadDownloadMediaFromLib();
setupCategoryBtn();
handleDownloadCategoryUpdateFromMain();
refreshEntries();
setLeftButtonStyle("btn-download");
loadIconsDynamically();
