const data = new URLSearchParams(window.location.search);
let Magnet = atob(data.get("MagnetLink"));
let downloadPath = data.get("downloadPath");
let fileName = data.get("fileName");

let TorrentIdentification = data.get("TorrentIdentification");

let MediaId = data.get("MediaId");
let MediaType = data.get("MediaType");

let bgImagePath = data.get("bgPath");
let mediaImdbId = data.get("ImdbId");

let seasonNumber = data.get("seasonNumber");
let episodeNumber = data.get("episodeNumber");

let defaultFontSize = 30;

let TopButtonsContainer = document.getElementById("div-topButtonsContainer");
let MiddleContainer = document.getElementById("div-videoContainer");
let BottomButtonsContainer = document.getElementById("div-bottomButtonsContainer");
let SubDivDisplay = document.getElementById("div-Subtitles");
let loadingGif = document.getElementById("LoadingGif");
let VideoContainer = document.getElementById("div-middle");
let VideoElement = document.getElementsByTagName("video")[0];
let VideoSlider = document.getElementById("input-videoSlider");
let VideoPositionElement = document.getElementById("p-videoPosition");
let VideoDurationElement = document.getElementById("p-videoDuration");
let VolumeButton = document.getElementById("btn-VolumeButton");
let VolumeSliderElement = document.getElementById("input-volumeSlider");
let switchToggle = document.getElementById("toggle-subs");
let SubButton = document.getElementById("btn-OpenSubtitle");
let SubDiv = document.getElementById("div-MainSubtitleContainer");
let bottomSubElement = document.getElementById("div-BottomSubContainer");

let oldVolume = null;
let mouseHoveringOnControlDiv;
var SubsStruct = [];
let subtitlesArray = [];

VideoElement.volume = 0.5;

setBackgroundImage();
loadSubSettings();

loadVideo(Magnet,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber)

loadingAllSubs(mediaImdbId);

TopButtonsContainer.addEventListener("mouseenter", ()=>{ mouseHoveringOnControlDiv = true });
TopButtonsContainer.addEventListener("mouseleave", ()=>{ mouseHoveringOnControlDiv = false });
BottomButtonsContainer.addEventListener("mouseenter", ()=>{ mouseHoveringOnControlDiv = true });
BottomButtonsContainer.addEventListener("mouseleave", ()=>{ mouseHoveringOnControlDiv = false });

let timeout;
window.addEventListener("mousemove",()=>{
  clearTimeout(timeout);
  TopButtonsContainer.style.top = "0";
  BottomButtonsContainer.style.bottom = "0";
  SubDiv.style.bottom = BottomButtonsContainer.getBoundingClientRect().height+10+"px";
  SubDivDisplay.style.bottom = BottomButtonsContainer.getBoundingClientRect().height+"px";

  timeout = setTimeout(()=>{
    if(!mouseHoveringOnControlDiv && SubDiv.classList.contains("hideElement")){
      TopButtonsContainer.style.top = "-150%";
      BottomButtonsContainer.style.bottom = "150%";
      SubDivDisplay.style.bottom = "5%";
    }
  },1000);

});

VideoElement.addEventListener("pause", () => ChangePauseUnpauseIcons(false));
VideoElement.addEventListener("play", () => ChangePauseUnpauseIcons(true));
VideoElement.addEventListener("playing", () => {loadingGif.style.display = "none"});

VideoElement.addEventListener("loadedmetadata", async (event)=>{
  let oldPlayBackPosition  = await getLatestPlayBackPosition(MediaId,MediaType,episodeNumber,seasonNumber);
  VideoElement.currentTime = oldPlayBackPosition;
  setInterval(()=>{
    let lastPbPosition = parseInt(VideoElement.currentTime);
    let metaData = {
      seasonNumber:seasonNumber,
      episodeNumber:episodeNumber,
      Magnet:Magnet,
      bgImagePath:bgImagePath,
      mediaImdbId:mediaImdbId,
      MediaId:MediaId,
      MediaType:MediaType,
      downloadPath:downloadPath,
      fileName:fileName
    };
    updateLastSecondBeforeQuit(lastPbPosition,metaData);
  },10000);

},{ once:true });

VideoElement.addEventListener("waiting", ()=>{
  loadingGif.style.display = "block";
});

VideoElement.addEventListener("timeupdate",()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoSlider.value = (VideoElement.currentTime/VideoElement.duration) * 100;
    VideoDurationElement.innerText = gettingformatedTime(VideoElement.duration);
    VideoPositionElement.innerText = gettingformatedTime(VideoElement.currentTime);
  }
});


VideoElement.addEventListener('progress', function() {
  if (VideoElement.buffered.length > 0) {
    const bufferedEnd = VideoElement.buffered.end(VideoElement.buffered.length - 1);
    const bufferedPercent = (bufferedEnd / VideoElement.duration) * 100;
  }
});

VolumeSliderElement.addEventListener("input", ()=>{
  VideoElement.muted = false;
  if(parseInt(VolumeSliderElement.value) === 0) oldVolume = 1;
  VideoElement.volume = VolumeSliderElement.value / 100;
  updateVolumeIcons();
});

VideoSlider.addEventListener("input", ()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoElement.currentTime = (VideoSlider.value * VideoElement.duration) / 100 ;
  }
});

MiddleContainer.addEventListener("dblclick",(event)=>{
  fullscreenClicked();
});

window.addEventListener("keydown",(event)=>{
  if(event.key === "Escape") window.electronAPI.goBack();
  else if(event.key === "ArrowUp") VideoElement.volume = Math.min(1, VideoElement.volume + 0.1);
  else if(event.key === "ArrowDown") VideoElement.volume = Math.max(0, VideoElement.volume - 0.1);
  else if(event.key === "ArrowRight") VideoElement.currentTime += 10;
  else if(event.key === "ArrowLeft") VideoElement.currentTime -= 10;
  else if(event.key === " ") TogglePauseUnpause();
  else if(event.key === "f") fullscreenClicked();
  else if(event.key === "m"){
    if(oldVolume !== null){
      if( oldVolume === 0 ) oldVolume = 1;
      VideoElement.volume = oldVolume;
      oldVolume = null;
    }else{
      oldVolume = VideoElement.volume;
      VideoElement.volume = 0;
    }
  }

  if (event.key === "Tab" ||
      event.key === "Super" ||
      event.key === "Alt" ) event.preventDefault();
  VolumeSliderElement.value = VideoElement.volume * 100;
  updateVolumeIcons();
  event.preventDefault();
  event.stopImmediatePropagation();
});


switchToggle.addEventListener("change",(event)=>{
  let subsList = document.getElementById("div-subsList");
  bottomSubElement.classList.toggle("hideElement");
  SubsStruct = [];
  SubDivDisplay.innerHTML = "";
  Array.from(subsList.children).forEach(element => element.removeAttribute("style"));

  event.stopImmediatePropagation();
});

window.addEventListener("resize",()=>{
  repositionSubDiv();
});


// ##################### MANAGING SUBS #####################
function insertLanguageButton(subs) {

  // Priority languages in order
  let langArray = [];
  langArray.push({ display:"English", language:"en" });
  langArray.push({ display:"Arabic",  language:"ar" });
  langArray.push({ display:"French",  language:"fr" });

  // Add remaining, avoiding duplicates
  subs.forEach(sub => {
    if (!langArray.some(langObj =>
      langObj.language.toLowerCase() === sub.language.toLowerCase()
    )) {
      langArray.push({
        display: sub.display,
        language: sub.language
      });
    }
  });

  // Create UI buttons
  let subBtnDiv = document.getElementById("div-LeftSubContainer");
  if (subBtnDiv) {
    langArray.forEach((lang, index) => {
      let buttonElement = document.createElement("button");

      // Highlight first button
      if (index === 0)
        buttonElement.style.backgroundColor = "rgba(255,255,255,0.1)";

      buttonElement.addEventListener("click", (event) => {
        loadLanguageSub(event.target);
      });

      buttonElement.value = lang.language;
      buttonElement.innerText = lang.display;

      subBtnDiv.append(buttonElement);
    });
  }
}

function getSubsViaLanguage(language){
  let languageData = subtitlesArray.filter(sub => sub.language === language);
  if(!languageData.length){
    document.getElementById("div-subsList").innerHTML = "Cannot Find Subtitles In This Language";
    return;
  }
  insertSubElements(languageData);
}

async function insertSubElements(fetchedData){
  let subsList = document.getElementById("div-subsList");
  subsList.innerHTML = "";
  for(let i=0 ;i<fetchedData.length;i++){
    let subtitlePath = fetchedData[i].url;
    let subElement = document.createElement("button");
    subElement.innerText = i;
    subElement.value = subtitlePath; 
    subElement.addEventListener("click", async() => {
      Array.from(subsList.children).forEach(element => {
        element.style.backgroundColor = "transparent";
        element.style.borderColor = "transparent";
      });
      subElement.style.backgroundColor = "rgba(255,255,255,0.05)";
      subElement.style.borderBottom = "4px solid rgba(var(--secondary-color))"
      if(fetchedData[i]?.type === "local"){
        let fileContent = await window.electronAPI.readSubFile(subtitlePath);
        scrapSubs(fileContent);
      }else{
      fetch(SubSource).then(res => res.text()
        ).then(data => {
          scrapSubs(data);
        });
      }
    });
    subsList.append(subElement);
  };
}

repositionSubDiv()

function gettingformatedTime(time){
  let hours = parseInt((time / 60) / 60);
  let minutes = parseInt((time / 60) - hours * 60);
  let seconds = parseInt(time - minutes * 60 - hours * 60 * 60);
  let results = String(hours).padStart(2,"0")+":"+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
  return results;
}

async function loadVideo(Magnet,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber){
  let usingMagnet = (downloadPath === "undefined");
  let fileIsMkv = (fileName.endsWith("mkv"));

  if(usingMagnet){
    let subs = await loadingAllSubs(mediaImdbId);
    subtitlesArray = subs;
    if(fileIsMkv){
      // pass to externel Player
      playVideoInMpv(true,Magnet,undefined,fileName,undefined,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber,subs);
      
    }else{
      insertLanguageButton(subs); 
      getSubsViaLanguage("en");
      window.electronAPI.getVideoUrl(Magnet,fileName).then( ([url,mimeType]) => {
        console.log(`Video Format: ${mimeType}`);
        if(mimeType === "video/x-matroska") throw new Error(`${mimeType} Video Format is Not Supported.`)
        VideoElement.id = "video-MediaPlayer";
        VideoElement.innerHTML = `<source src=${url} type='${mimeType}'>`;
        VideoElement.load();
        VideoElement.play();
        VideoElement.removeAttribute("style");
        document.documentElement.removeAttribute("style");
        document.documentElement.style.backgroundColor = "black";
        TopButtonsContainer.style.display = "flex";
        BottomButtonsContainer.style.display = "block";
      }).catch(err=>{
        console.error(err);
        let WarningDiv = document.getElementById("div-SomethingWentWrong");
        WarningDiv.innerHTML = err.message;
        loadingGif.remove();
        WarningDiv.style.display = "flex";
      });
    }

  }else{
    let identifyingElements = {"IMDB_ID":mediaImdbId,"episodeNumber":episodeNumber,"seasonNumber":seasonNumber,"TorrentDownloadDir":downloadPath};
    let subs = await window.electronAPI.loadLocalSubs(downloadPath,identifyingElements);
    subtitlesArray = subs;

    let videoPath = await window.electronAPI.getFullVideoPath(downloadPath,fileName);

    if(fileIsMkv){
      // pass to externel Player
      playVideoInMpv(false,undefined,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber,undefined);

    }else{
      insertLanguageButton(subs); 
      getSubsViaLanguage("en");

      VideoElement.id = "video-MediaPlayer";
      VideoElement.innerHTML = `<source src='${videoPath}'>`;
      VideoElement.load();
      VideoElement.play();
      VideoElement.removeAttribute("style");
      document.documentElement.removeAttribute("style");
      document.documentElement.style.backgroundColor = "black";
      TopButtonsContainer.style.display = "flex";
      BottomButtonsContainer.style.display = "block";
    }
  }
}

async function playVideoInMpv(PlayMagnet,Magnet,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber,subs){
  let metaData = {"Magnet":Magnet, "downloadPath":downloadPath,
        "fileName":fileName, "bgImagePath":bgImagePath,
        "MediaId":MediaId,"MediaType":MediaType,
        "TorrentId":TorrentIdentification, "mediaImdbId":mediaImdbId,
        "seasonNumber":seasonNumber, "episodeNumber":episodeNumber
  };

  if(PlayMagnet){
    window.electronAPI.StreamTorrentOverMpv(metaData,subs);
  }else{
    window.electronAPI.PlayVideoOverMpv(metaData);
  }
}

function loadLanguageSub(button){
  Array.from(button.parentElement.children).forEach(element => element.removeAttribute("style"));
  button.style.backgroundColor = "rgba(255,255,255,0.1)";
  getSubsViaLanguage(button.value);
}

function SubObj(startTime, endTime, content){
  this.startTime = startTime;
  this.endTime = endTime;
  this.content = content;
}

function getTimeInSecFromString(text){
  let Hour = parseInt(text.split(":")[0])*60*60;
  let Minute = parseInt(text.split(":")[1])*60;
  let Second = parseInt(text.split(":")[2].split(",")[0]);
  let MilSecond = parseInt(text.split(":")[2].split(",")[1])*0.001;

  let Time  = Hour + Minute + Second + MilSecond;
  
  return Time;
}

function scrapSubs(SubsText){
  SubsStruct = [];
  SubDivDisplay.innerHTML = "";

  let subLines = SubsText.split("\n");  
  subLines.forEach((line, index) => {
    if(line.includes(" --> ")){
      let stringStartTime = line.split(" --> ")[0];
      let stringEndTime = line.split(" --> ")[1];

      let startTime = getTimeInSecFromString(stringStartTime);
      let endTime = getTimeInSecFromString(stringEndTime);
      
      let chunk = "";
      for(let startPoint=index+1; startPoint < subLines.length ;startPoint++){
        if(!isNaN(subLines[startPoint]) && subLines[startPoint+1].includes(" --> ") ) break;
        else if(subLines[startPoint].trim() != "") chunk += subLines[startPoint]+"\n";
      }
      let newSubObj = new SubObj(startTime, endTime, chunk); 
      SubsStruct.push(newSubObj);
    }
  });
  VideoElement.removeEventListener("timeupdate",displaySub);
  VideoElement.addEventListener("timeupdate", displaySub);
}

function displaySub(){
  let founded = false;
  for(let i=0;i<SubsStruct.length;i++){
    if(SubsStruct[i].startTime <= VideoElement.currentTime && SubsStruct[i].endTime >= VideoElement.currentTime){

      if(SubDivDisplay.innerHTML !== SubsStruct[i].content){ 
        SubDivDisplay.innerHTML = SubsStruct[i].content.replaceAll("\n","<br>");
        SubDivDisplay.classList.remove("hideElement");
      }
      founded = true;
      break;
    }
  }
  if(!founded){
    SubDivDisplay.classList.add("hideElement");
  }
}

function goBack(){
  window.electronAPI.goBack();
}

function TogglePauseUnpause(){
  let videoPaused = VideoElement.paused;
  if(videoPaused)
    VideoElement.play();
  else
    VideoElement.pause();
}

function ChangePauseUnpauseIcons(paused){
  let PauseButtonImageElement = document.getElementById("img-PauseButton");
  if(paused)
    PauseButtonImageElement.src="../assets/icons/BPause.png"
  else
    PauseButtonImageElement.src="../assets/icons/BPlay.png"
}

function toggleVolume(){
  VideoElement.muted = !VideoElement.muted;
  updateVolumeIcons();
}

function updateVolumeIcons(){
  if(VideoElement.volume <= 0.0 || VideoElement.muted) VolumeButton.children[0].src = "../assets/icons/BMute.png";
  else if(VideoElement.volume <= 0.25) VolumeButton.children[0].src = "../assets/icons/BVolumeLow.png";
  else if(VideoElement.volume <= 0.75) VolumeButton.children[0].src = "../assets/icons/BVolumeMid.png";
  else if(VideoElement.volume > 0.75) VolumeButton.children[0].src = "../assets/icons/BVolumeControl.png";
} 

function hideSubDiv(event){
  let SubDivPositionXStart =  SubDiv.getBoundingClientRect().left;
  let SubDivPositionYStart = SubDiv.getBoundingClientRect().top;
  let SubDivPositionXEnd =  SubDiv.getBoundingClientRect().right;
  let SubDivPositionYEnd = SubDiv.getBoundingClientRect().bottom;
  
  let SubButtonPositionXStart = SubButton.getBoundingClientRect().left;
  let SubButtonPositionYStart = SubButton.getBoundingClientRect().top;
  let SubButtonPositionXEnd = SubButton.getBoundingClientRect().right;
  let SubButtonPositionYEnd = SubButton.getBoundingClientRect().bottom;
  
  let cursorIsInsideSubDiv =  (event.clientX >= SubDivPositionXStart) && (event.clientX <= SubDivPositionXEnd) &&
                              (event.clientY >= SubDivPositionYStart) && (event.clientY <= SubDivPositionYEnd);

  let cursorIsInsideSubButton = (event.clientX >= SubButtonPositionXStart) && (event.clientX <= SubButtonPositionXEnd) &&
                                (event.clientY >= SubButtonPositionYStart) && (event.clientY <= SubButtonPositionYEnd);

  if(!cursorIsInsideSubDiv && !cursorIsInsideSubButton){
    SubDiv.classList.add("hideElement");
    window.removeEventListener("mousedown",hideSubDiv);
  }
}

function OpenSubtitles(){
  SubDiv.classList.toggle("hideElement");
  window.addEventListener("mousedown",hideSubDiv);
}

function repositionSubDiv(){
  SubDiv.style.left = SubButton.getBoundingClientRect().left + SubButton.offsetWidth/2+"px";
}

let subsSizeOffsetPercent = 0;
function SubSize(event,operation){
  let SubSizeDivP = document.getElementById("div-subSize").querySelector("p");
  if(operation === "+" && subsSizeOffsetPercent < 200) subsSizeOffsetPercent += 10;
  else if(operation === "-" && subsSizeOffsetPercent > -100 ) subsSizeOffsetPercent -= 10;

  let Sign = subsSizeOffsetPercent >= 0 ?"+":"";
  SubSizeDivP.innerText = Sign+subsSizeOffsetPercent+ "%"
  let currentFontSize = defaultFontSize + (defaultFontSize*subsSizeOffsetPercent)/100 + "px";
  console.log(currentFontSize);
  SubDivDisplay.style.fontSize = currentFontSize;
}

async function loadSubSettings(){
  let Settings = await window.electronAPI.loadSettings(); 

  SubDivDisplay.style.fontSize = Settings.SubFontSizeInternal;
  SubDivDisplay.style.fontFamily = Settings.SubFontFamilyInternal;
  SubDivDisplay.style.color = Settings.SubColorInternal;
  let numberInHex = parseInt(Settings.SubBackgroundColorInternal.split("#")[1],16);
  let r = (numberInHex >> 16) & 255;
  let g = (numberInHex >> 8) & 255;
  let b = (numberInHex) & 255;
  SubDivDisplay.style.backgroundColor = `rgba(${r},${g},${b},${Settings.SubBackgroundOpacityLevelInternal/100}`;
  if(Settings.DownloadSubtitlesByDefault){
    switchToggle.checked = true;
    bottomSubElement.classList.toggle("hideElement");
  }
  defaultFontSize = Settings.SubFontSizeInternal;
}

async function getLatestPlayBackPosition(MediaId,MediaType,episodeNumber,seasonNumber){
  let targetIdentification = {MediaId:MediaId,MediaType:MediaType};
  let MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if(MediaLibraryObject == undefined) return 0;
  MediaLibraryObject = MediaLibraryObject[0];

  let mediaIsAnEpisode = (MediaLibraryObject.hasOwnProperty("episodeNumber") && MediaLibraryObject.hasOwnProperty("seasonNumber"));
  let isRequestedEpisode = mediaIsAnEpisode ? (MediaLibraryObject["episodeNumber"] === episodeNumber && MediaLibraryObject["seasonNumber"] === seasonNumber) : true;


  if(MediaLibraryObject.hasOwnProperty("typeOfSave") &&
    MediaLibraryObject["typeOfSave"].includes("Currently Watching") &&
    MediaLibraryObject.hasOwnProperty("lastPlaybackPosition")&& 
    isRequestedEpisode){

      return MediaLibraryObject["lastPlaybackPosition"];
  }
  return 0;
}

async function updateLastSecondBeforeQuit(lastPbPosition,metaData){
  let targetIdentification = {MediaId:metaData?.MediaId,MediaType:metaData?.MediaType};
  let MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if(MediaLibraryObject !== undefined){
    MediaLibraryObject = {...MediaLibraryObject[0], ...metaData,lastPlaybackPosition:lastPbPosition}; 

    if(!MediaLibraryObject?.["typeOfSave"].includes("Currently Watching"))
      MediaLibraryObject["typeOfSave"].push("Currently Watching")
    
    await window.electronAPI.removeMediaFromLibrary(targetIdentification);

  }else{
    MediaLibraryObject = {...metaData,lastPlaybackPosition:lastPbPosition,typeOfSave:["Currently Watching"]}
  }
  window.electronAPI.addMediaToLibrary(MediaLibraryObject);
}

function setBackgroundImage(){
  document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bgImagePath}')`;
  document.documentElement.style.backgroundRepeat = `no-repeat`;
  document.documentElement.style.backgroundPosition = `center center`;
  document.documentElement.style.backgroundSize = `cover`;
  document.documentElement.style.backgroundAttachment = `fixed`;
}

loadIconsDynamically();
