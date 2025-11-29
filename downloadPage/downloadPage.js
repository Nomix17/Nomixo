async function loadDownloadMediaFromLib(){
  let library = await window.electronAPI.loadDownloadLibraryInfo();
  let counter=0;
  console.log(library);
  if(library !== undefined){
    for(let mediaLibEntryPoint of library.downloads){
      if(mediaLibEntryPoint?.typeOfSave?.includes("Download")){
        createDownloadElement(mediaLibEntryPoint);
        counter++;
      }
    }
  }
  if(counter === 0){
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
    <img src=${mediaLibEntryPoint?.posterPath} class="poster-img"/>
    <div class="download-movie-right-div">
      <p class="movie-title-p">${mediaLibEntryPoint?.Title}</p>
      <div class="progress-div">
        <div class="progress-bar-div"><div style="width:${progress}" class="inside"></div></div>
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
  if(mediaLibEntryPoint?.Status === "done"){
    console.log(`${mediaLibEntryPoint?.Title} is done downloading in ${mediaLibEntryPoint?.downloadPath}`);
    CancelButton.innerHTML = trashIcon
  }

  let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
  MediaDownloadElementContainer.append(MediaDownloadElement);

  handleCancelButton(mediaLibEntryPoint,MediaDownloadElement);
  handleTogglingPauseButton(ElementIdentifier,MediaDownloadElement);
}

function monitorDownloads(){
  window.electronAPI.getDownloadProgress((data) => {
    let JsonData = data;

    let DownloadElementIdentifier = JsonData.TorrentId;

    let TargetDownloadElement = document.getElementById(DownloadElementIdentifier);
    let TotalSizeTextElement = TargetDownloadElement.querySelector(".total-size");
    let DownloadedSizeTextElement = TargetDownloadElement.querySelector(".downloaded-size");
    let PercentageTextElement = TargetDownloadElement.querySelector(".percentage");
    let insiderProgressBar = TargetDownloadElement.querySelector(".progress-bar-div .inside");
    let PausePlaybutton = TargetDownloadElement.querySelector(".toggle-pause-button");
    let CancelButton = TargetDownloadElement.querySelector(".cancel-button");

    // data = "Title" "IMDB_ID" "MediaId" "MediaType" "seasonNumber" "episodeNumber" "Downloaded" "Total" "DownloadPath"
    let calculatedProgress = ((JsonData.Downloaded / JsonData.Total) * 100).toFixed(2);
    let calculatedDownloadedSize = (JsonData.Downloaded / (1024 * 1024 * 1024)).toFixed(2);
    let calculatedTotalSize = (JsonData.Total / (1024 * 1024 * 1024)).toFixed(2);
    
    DownloadedSizeTextElement.innerText =  calculatedDownloadedSize + " GB";
    TotalSizeTextElement.innerText = calculatedTotalSize + " GB";
    PercentageTextElement.innerText = calculatedProgress + " %";
    insiderProgressBar.style.width = calculatedProgress+ "%";
    PausePlaybutton.innerHTML = pauseIcon;
    CancelButton.innerHTML = xRemoveIcon;

  });
}

function handleCancelButton(mediaInfo,MediaDownloadElement){
  let cancelDownloadButton = MediaDownloadElement.querySelector(".cancel-button");
  cancelDownloadButton.addEventListener("click",async()=>{
    await window.electronAPI.cancelDownload(mediaInfo);
    let TargetDownloadElement = document.getElementById(mediaInfo?.torrentId);
    TargetDownloadElement.remove();
    let MediaDownloadElementContainer = document.querySelector(".downloaded-movie-div-container");
    if(MediaDownloadElementContainer.innerHTML)
      putTextIntoDiv(MediaDownloadElementContainer,"Your download list is empty."); 
  });
}

function handleTogglingPauseButton(torrentId,MediaDownloadElement){
  let PausePlaybutton = MediaDownloadElement.querySelector(".toggle-pause-button");
  PausePlaybutton.addEventListener("click",()=>{
    window.electronAPI.toggleTorrentDownload(torrentId);
  });
}

monitorDownloads();
loadDownloadMediaFromLib();
setLeftButtonStyle("btn-download");
loadIconsDynamically();

