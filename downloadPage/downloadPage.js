async function loadDownloadMediaFromLib(){
  let library = await window.electronAPI.loadDownloadLibraryInfo();

  if(library !== undefined){
    for(let mediaLibEntryPoint of library.downloads){
        createDownloadElement(mediaLibEntryPoint);
    }
  }

  if(library.downloads.length === 0){
    let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
    putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 
  }
}

function createDownloadElement(mediaLibEntryPoint){
  let currentSize = (mediaLibEntryPoint?.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
  let totalSize = (mediaLibEntryPoint?.Total / (1024 * 1024 * 1024)).toFixed(2);
  let progress = (currentSize/totalSize * 100).toFixed(2);

  let  ElementIdentifier = mediaLibEntryPoint?.torrentId;

  let MediaDownloadElement = document.createElement("div");
  MediaDownloadElement.className = "downloaded-movie-div";
  MediaDownloadElement.id = ElementIdentifier;

  MediaDownloadElement.innerHTML = `
    <div class="poster-div">
      <img src="${mediaLibEntryPoint?.posterPath}" class="poster-img"/>
    </div>
    <div class="download-movie-right-div">
      <p class="movie-title-p">${mediaLibEntryPoint?.Title}</p>
      <div class="progress-div">
        <div class="progress-bar-div">
          <div class="inside" style="width:${progress}%;"></div>
        </div>
        <p class="percentage">${progress}%</p>
      </div>
      <div class="movie-size-div">
        <p class="downloaded-size">${currentSize} GB</p>
        <p class="total-size">${totalSize} GB</p>
      </div>
      <div class="download-buttons-div">
        <button class="toggle-pause-button">${playIcon}</button>
        <button class="cancel-button">${xRemoveIcon}</button>
      </div>
    </div>
  `;

  let insiderProgressBar = MediaDownloadElement.querySelector(".progress-bar-div .inside");
  insiderProgressBar.style.width = progress + "%";

  let CancelButton = MediaDownloadElement.querySelector(".cancel-button");
  let PercentageTextElement = MediaDownloadElement.querySelector(".percentage");
  let PosterDiv = MediaDownloadElement.querySelector(".poster-div");
  let PausePlayButton = MediaDownloadElement.querySelector(".toggle-pause-button");

  if(mediaLibEntryPoint?.Status === "done"){
    console.log(`${mediaLibEntryPoint?.Title} is done downloading in ${mediaLibEntryPoint?.downloadPath}`);
    PercentageTextElement.innerText = "✓ Completed";
    CancelButton.innerHTML = closedTrashIcon;
    
    PausePlayButton.classList.add("completed", "just-finished");
    
    setTimeout(() => {
      PausePlayButton.classList.remove("just-finished");
    }, 600);
    
    PausePlayButton.addEventListener("click", () => {
      let episodeInfo = {
        "seasonNumber": mediaLibEntryPoint.seasonNumber, 
        "episodeNumber": mediaLibEntryPoint.episodeNumber
      };
      openMediaVideo(
        mediaLibEntryPoint.torrentId,
        mediaLibEntryPoint.MediaId, 
        mediaLibEntryPoint.MediaType, 
        mediaLibEntryPoint.downloadPath,
        mediaLibEntryPoint.fileName,
        mediaLibEntryPoint.Magnet,
        mediaLibEntryPoint.mediaImdbId,
        mediaLibEntryPoint.bgImagePath,
        episodeInfo
      );
    });
  }

  let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
  MediaDownloadElementContainer.append(MediaDownloadElement);

  handleCancelButton(mediaLibEntryPoint,MediaDownloadElement);
  if(mediaLibEntryPoint?.typeOfSave !== "Download-Complete"){
    handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
  }
  alignSizeDiv();
  
}

function monitorDownloads(){
  window.electronAPI.getDownloadProgress((data) => {
    let JsonData = data;

    let DownloadElementIdentifier = JsonData.TorrentId;

    let TargetDownloadElement = document.getElementById(DownloadElementIdentifier);
    let TotalSizeTextElement = TargetDownloadElement.querySelector(".total-size");
    let DownloadedSizeTextElement = TargetDownloadElement.querySelector(".downloaded-size");
    let PercentageTextElement = TargetDownloadElement.querySelector(".percentage");
    let ProgressBar = TargetDownloadElement.querySelector(".progress-bar-div");
    let insiderProgressBar = TargetDownloadElement.querySelector(".progress-bar-div .inside");
    let PausePlaybutton = TargetDownloadElement.querySelector(".toggle-pause-button");
    let CancelButton = TargetDownloadElement.querySelector(".cancel-button");

    let calculatedProgress = ((JsonData.Downloaded / JsonData.Total) * 100).toFixed(2);
    let calculatedDownloadedSize = (JsonData.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
    let calculatedTotalSize = (JsonData.Total / (1024 * 1024 * 1024)).toFixed(2);
    
    DownloadedSizeTextElement.innerText =  calculatedDownloadedSize + " GB";
    TotalSizeTextElement.innerText = calculatedTotalSize + " GB";
    PercentageTextElement.innerText = calculatedProgress + " %";
    insiderProgressBar.style.width = calculatedProgress+ "%";
    PausePlaybutton.innerHTML = pauseIcon;
    CancelButton.innerHTML = xRemoveIcon;

    if(JsonData?.Status === "done"){
      console.log(`${JsonData?.Title} is done downloading in ${JsonData?.downloadPath}`);
      PercentageTextElement.innerText= "✓ Completed";
      CancelButton.innerHTML = trashIcon;
      PausePlaybutton.innerHTML = playIcon;
      
      PausePlaybutton.classList.add("completed", "just-finished");
      
      setTimeout(() => {
        PausePlaybutton.classList.remove("just-finished");
      }, 600);
      
      let newButton = PausePlaybutton.cloneNode(true);
      PausePlaybutton.parentNode.replaceChild(newButton, PausePlaybutton);
      
      newButton.addEventListener("click", () => {
        let episodeInfo = {
          "seasonNumber": JsonData.seasonNumber, 
          "episodeNumber": JsonData.episodeNumber
        };
        openMediaVideo(
          JsonData.MediaId, 
          JsonData.MediaType, 
          JsonData.Magnet,
          JsonData.mediaImdbId,
          JsonData.bgImagePath,
          episodeInfo
        );
      });
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

function handleTogglingPauseButton(torrentId,MediaDownloadElement){
  let PausePlaybutton = MediaDownloadElement.querySelector(".toggle-pause-button");
    window.electronAPI.toggleTorrentDownload(torrentId);
}

function alignSizeDiv(){
  let downloadTorrent = document.querySelectorAll(".downloaded-movie-div");
  downloadTorrent.forEach(element=>{
    let ProgressBar = element.querySelector(".progress-bar-div");
    let sizeDiv = element.querySelector(".movie-size-div");
    sizeDiv.style.maxWidth = ProgressBar.offsetWidth;
  });
}

window.addEventListener("resize",()=>{
  alignSizeDiv();
});

monitorDownloads();
loadDownloadMediaFromLib();
setLeftButtonStyle("btn-download");
loadIconsDynamically();
