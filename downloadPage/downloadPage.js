let monitoringProgress = false;
async function loadDownloadMediaFromLib(){
  let library = await window.electronAPI.loadDownloadLibraryInfo();

  if(library !== undefined){
    for(let mediaLibEntryPoint of library.downloads){
        createDownloadElement(mediaLibEntryPoint);
    }
  }

  if(library.downloads.length === 0){
    let RightmiddleDiv = document.getElementById("div-middle-right");
    let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
    putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 
    RightmiddleDiv.style.opacity = 1;

  }else{
    if(!monitoringProgress){
      monitorDownloads();
      monitorErrors();
    }
  }

  await loadCachedPageInfo();
}

async function createDownloadElement(mediaLibEntryPoint){
  let downloadStatus = mediaLibEntryPoint?.Status;
  
  let currentSize = (mediaLibEntryPoint?.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
  let totalSize = (mediaLibEntryPoint?.Total / (1024 * 1024 * 1024)).toFixed(2);
  let progress = (currentSize/totalSize * 100).toFixed(2);

  let ElementIdentifier = mediaLibEntryPoint?.torrentId;
  if(document.getElementById(ElementIdentifier)) return

  let MediaDownloadElement = document.createElement("div");
  MediaDownloadElement.className = "downloaded-movie-div";
  MediaDownloadElement.id = ElementIdentifier;

  let displayTitle = mediaLibEntryPoint?.Title;
  if(mediaLibEntryPoint.seasonNumber && mediaLibEntryPoint.episodeNumber)
    displayTitle = `${mediaLibEntryPoint?.Title} S${mediaLibEntryPoint.seasonNumber} E${mediaLibEntryPoint.episodeNumber}`;

  MediaDownloadElement.innerHTML = `
    <div class="poster-div">
      <img class="poster-img"/>
    </div>
    <div class="download-movie-right-div">
      <p class="movie-title-p">${displayTitle}</p>
      <div class="progress-div">
        <div class="progress-bar-div">
          <div class="inside" style="width:${progress}%;"></div>
        </div>
        <p class="percentage">${isNaN(progress) ? "0%" : progress+"%"}</p>
      </div>
      <div class="movie-size-div">
        <p class="downloaded-size">${isNaN(currentSize) ? "---" : currentSize+" GB"}</p>
        <p class="total-size">${isNaN(totalSize) ? "---" : totalSize+" GB"} </p>
      </div>
      <div class="download-buttons-div">
        <button class="toggle-pause-button">${downloadStatus === "Downloading" || downloadStatus === "Loading" ? pauseIcon : playIcon }</button>
        <button class="cancel-button">${xRemoveIcon}</button>
        <p class="download-speed-p"></p>
      </div>
    </div>
  `;

  let insiderProgressBar = MediaDownloadElement.querySelector(".progress-bar-div .inside");
  insiderProgressBar.style.width = progress + "%";

  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PosterDiv = MediaDownloadElement.querySelector(".poster-div");
  let PosterElement = MediaDownloadElement.querySelector(".poster-img");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");

  makeSurePosterIsLoaded(mediaLibEntryPoint,PosterElement,mediaLibEntryPoint?.posterPath);
  makeSureBgImageIsDownloaded(mediaLibEntryPoint);

  if(downloadStatus === "Loading"){
    if(!loadingIntervals?.[mediaLibEntryPoint.torrentId])
      addingLoadingAnimation(mediaLibEntryPoint.torrentId,downloadSpeedElement,PausePlayButton);
    

  }else if(downloadStatus.toLowerCase() === "done"){
    MarkDownloadElementAsFinished(MediaDownloadElement,mediaLibEntryPoint);
  }

  let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
  MediaDownloadElementContainer.append(MediaDownloadElement);

  handleCancelButton(mediaLibEntryPoint,MediaDownloadElement);
  if(mediaLibEntryPoint?.typeOfSave !== "Download-Complete"){
    handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
  }
  alignSizeDiv();

  let RightmiddleDiv = document.getElementById("div-middle-right");
  RightmiddleDiv.style.opacity = 1;
}

async function makeSurePosterIsLoaded(libraryEntryPoint,PosterElement){
  let posterPathExist = await imagePathIsValid(libraryEntryPoint?.posterPath);

  if(posterPathExist){
    PosterElement.src = `file://${libraryEntryPoint?.posterPath}?t=${Date.now()}`;
    PosterElement.classList.remove("flashing-Div");

  }else{
    PosterElement.classList.add("flashing-Div");
    let responce = await window.electronAPI.downloadImage(libraryEntryPoint.downloadPath, libraryEntryPoint.posterUrl);

    if(responce.download_result === "success") {
      // close loop
      PosterElement.classList.remove("flashing-Div");
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

async function makeSureBgImageIsDownloaded(libraryEntryPoint){
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


function imagePathIsValid(imagePath){
  return new Promise((res)=>{
    const tmpImg = new Image();
    tmpImg.onload = ()=>res(true);
    tmpImg.onerror = ()=>res(false);
    tmpImg.src = `file://${imagePath}?t=${Date.now()}`;
  });
}

function monitorDownloads(){
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
      MarkDownloadElementAsFinished(TargetDownloadElement,libraryElement);
    }

  });
  monitoringProgress = true;
}

function refreshEnties(){
  window.electronAPI.getDownloadProgress(async (data) => {
    let JsonData = data;
    if(JsonData?.Status === "NewDownload"){
      let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
      let emptyLibText = MediaDownloadElementContainer.querySelector("#div-text");
      if(emptyLibText) emptyLibText.remove()
      loadDownloadMediaFromLib();
    }
  });
}

function handleCancelButton(mediaInfo,MediaDownloadElement){
  let cancelDownloadButton = MediaDownloadElement.querySelector(".cancel-button");
  cancelDownloadButton.addEventListener("click",async()=>{
    await window.electronAPI.cancelDownload(mediaInfo);
    let TargetDownloadElement = document.getElementById(mediaInfo?.torrentId);
    TargetDownloadElement.remove();
    let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
    if(MediaDownloadElementContainer.innerHTML.trim() === "")
      putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 
  });
}

let loadingIntervals = {};
function handleTogglingPauseButton(torrentId,MediaDownloadElement){

  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");

  PausePlayButton.addEventListener("click",async ()=>{
    let pauseResponce = await window.electronAPI.toggleTorrentDownload(torrentId);
    if(pauseResponce?.response  === "paused"){
      PausePlayButton.innerHTML = playIcon;
      downloadSpeedElement.innerHTML ="";
      removeLoadingAnimation(torrentId,PausePlayButton,"Paused");

    }else if(pauseResponce?.response  === "continued"){
      PausePlayButton.innerHTML = pauseIcon;
      downloadSpeedElement.innerHTML = "loading"

      addingLoadingAnimation(torrentId,downloadSpeedElement,PausePlayButton);

      await SaveDownloadStatus(torrentId, "Loading");

    }else{
      MarkDownloadElementAsPaused(torrentId,MediaDownloadElement)
      console.error("Cannot Find Torrent: ",pauseResponce?.torrentId);
    }

  });
}

function addingLoadingAnimation(torrentId,downloadSpeedElement,PausePlayButton){
  PausePlayButton.classList.add("requesting-continue-download");

  let counter = 1;
  downloadSpeedElement.innerHTML = "loading ."
  loadingIntervals[torrentId] = setInterval(()=>{
    let dots = ["",".",". .",". . ."];
    downloadSpeedElement.innerHTML = "loading "+dots[counter % dots.length];
    counter ++;
  },500);
}

async function removeLoadingAnimation(torrentId,PausePlayButton,NewStatus){
  PausePlayButton.classList.remove("requesting-continue-download");
  clearInterval(loadingIntervals[torrentId]);
  delete loadingIntervals[torrentId];
  await SaveDownloadStatus(torrentId, NewStatus);
}

async function SaveDownloadStatus(torrentId, Status){
  await window.electronAPI.editElementInDownloadLibraryInfo(torrentId, "Status", Status);
}


function alignSizeDiv(){
  let downloadTorrent = document.querySelectorAll(".downloaded-movie-div");
  downloadTorrent.forEach(element=>{
    let ProgressBar = element.querySelector(".progress-bar-div");
    let sizeDiv = element.querySelector(".movie-size-div");
    sizeDiv.style.maxWidth = ProgressBar.offsetWidth;
  });
}

function MarkDownloadElementAsFinished(MediaDownloadElement,MediaInfo){
  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  
  PercentageTextElement.innerText = "✓ Completed";
  CancelButton.innerHTML = closedTrashIcon;
  downloadSpeedElement.style.display = "none";
  PausePlayButton.classList.add("completed", "just-finished");
  PausePlayButton.innerHTML = playIcon;

  setTimeout(() => {
    PausePlayButton.classList.remove("just-finished");
  }, 600);
  
  PausePlayButton.addEventListener("click", (event) => {
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
    event.stopPropagation();
  });
}

function MarkDownloadElementAsPaused(torrentId,MediaDownloadElement){
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");
  let downloadSpeedElement = MediaDownloadElement.querySelector(".download-speed-p");
  
  downloadSpeedElement.innerHTML = "";
  PausePlayButton.innerHTML = playIcon;

  setTimeout(() => {
    PausePlayButton.classList.remove("just-finished");
  }, 600);

  removeLoadingAnimation(torrentId,PausePlayButton,"Paused"); 
}

function monitorErrors(){
  window.electronAPI.getDownloadErrorsReports(async (errorReport) => {
    let MediaDownloadElement = document.getElementById(errorReport.torrentId);
    MarkDownloadElementAsPaused(errorReport.torrentId,MediaDownloadElement)
    console.error(`${errorReport?.type} Error: ${errorReport.torrentId}\n${errorReport.err_msg}`);
  });
}

async function loadCachedPageInfo(){
  let cachedData = await window.electronAPI.loadPageCachedDataFromHistory(document.URL);
  if(cachedData){
    console.log("Loading Cached Information");
    let downloadMediaContainerScrollTopValue = cachedData.download_container_top_scroll_value;
    let downloadMediaContainer = document.querySelector(".downloaded-movie-div-container");
    downloadMediaContainer.scrollTop = downloadMediaContainerScrollTopValue;
  }
}

window.addEventListener("resize",()=>{
  alignSizeDiv();
});

setupKeyPressesHandler();
loadDownloadMediaFromLib();
refreshEnties();
setLeftButtonStyle("btn-download");
loadIconsDynamically();
