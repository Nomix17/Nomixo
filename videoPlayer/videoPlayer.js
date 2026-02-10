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

let subsDelay = 0; // ms
let defaultFontSize = 30; // px

let TopButtonsContainer = document.getElementById("div-topButtonsContainer");
let MiddleContainer = document.getElementById("div-videoContainer");
let BottomButtonsContainer = document.getElementById("div-bottomButtonsContainer");
let SubDivDisplay = document.getElementById("div-Subtitles");
let loadingGif = document.getElementById("LoadingGif");
let VideoElement = document.getElementsByTagName("video")[0];
let VideoSlider = document.getElementById("input-videoSlider");
let VideoPositionElement = document.getElementById("p-videoPosition");
let VideoDurationElement = document.getElementById("p-videoDuration");
let VolumeButton = document.getElementById("btn-VolumeButton");
let VolumeSliderElement = document.getElementById("input-volumeSlider");
let switchToggle = document.getElementById("toggle-subs");
let SubButton = document.getElementById("btn-OpenSubtitle");
let SubDiv = document.getElementById("div-MainSubtitleContainer");
let SubSizeDivInput = document.getElementById("div-subSize").querySelector("input");
let SubDelayDivInput = document.getElementById("div-subDelay").querySelector("input");
let bottomSubElement = document.getElementById("div-BottomSubContainer");

let oldVolume = null;
let mouseHoveringOnControlDiv;
let videoIsPlaying = false;
var SubsStruct = [];
let subtitlesArray = [];
let sliderMaxValue = VideoSlider.max;
VideoElement.volume = 0.5;

setBackgroundImage();
loadSubSettings();

loadVideo(Magnet,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber)

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
    if(!mouseHoveringOnControlDiv && SubDiv.classList.contains("hideElement") && videoIsPlaying){
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
    VideoSlider.value = (VideoElement.currentTime/VideoElement.duration) * sliderMaxValue;
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
    VideoElement.currentTime = (VideoSlider.value * VideoElement.duration) / sliderMaxValue;
  }
});

MiddleContainer.addEventListener("dblclick",(event)=>{
  fullscreenClicked();
});

window.addEventListener("keydown",(event)=>{
  if((event.target.tagName === 'INPUT' && event.target.type !== "range") || event.target.tagName === 'TEXTAREA')
    return;

  if(event.key === "Escape") window.electronAPI.goBack();
  else if(event.key === "ArrowUp") VideoElement.volume = Math.min(1, VideoElement.volume + 0.1);
  else if(event.key === "ArrowDown") VideoElement.volume = Math.max(0, VideoElement.volume - 0.1);
  else if(event.key === "ArrowRight") VideoElement.currentTime += 10;
  else if(event.key === "ArrowLeft") VideoElement.currentTime -= 10;
  else if(event.key === " ") TogglePauseUnpause();
  else if(event.key === "f") fullscreenClicked();
  else if(event.key === "p") togglePIP();
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
  Array.from(subsList.children).forEach(element => element.classList.remove("active"));

  event.stopImmediatePropagation();
});

repositionSubDiv();
window.addEventListener("resize",()=>{
  repositionSubDiv();
});


// ##################### MANAGING SUBS #####################
function insertLanguageButton(subs) {

  // Priority languages in order
  let langArray = [];
  langArray.push({ display:"Built In", languageCode:"built-in" });
  langArray.push({ display:"English", languageCode:"en" });
  langArray.push({ display:"Arabic",  languageCode:"ar" });
  langArray.push({ display:"French",  languageCode:"fr" });

  // Add remaining, avoiding duplicates
  subs.forEach(sub => {
    if (!langArray.some(langObj =>
      langObj.languageCode.toLowerCase() === sub.languageCode.toLowerCase()
    )) {
      langArray.push({
        display: sub.display,
        languageCode: sub.languageCode
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

      buttonElement.value = lang.languageCode;
      buttonElement.innerText = lang.display;

      subBtnDiv.append(buttonElement);
    });
  }
}

function getSubsViaLanguage(languageCode){
  let languageData = subtitlesArray.filter(sub => sub.languageCode === languageCode);
  hideAllSubsInList();
  if(!languageData.length){
    const subsList = document.getElementById("div-subsList");
    subsList.classList.add("no-subs-found");
    return;
  }
  insertSubElements(languageData);
}

async function hideAllSubsInList() {
  let subsList = document.getElementById("div-subsList");
  subsList.classList.remove("no-subs-found");

  let loadedSubsButtonsArray = Array.from(subsList.querySelectorAll("button"));
  loadedSubsButtonsArray.forEach(element=>{
    element.style.display = "none";
    element.style.margin = 0;
  });
}

async function insertSubElements(fetchedData){
  let subsList = document.getElementById("div-subsList");
  let counter = 0;
  for(const subData of fetchedData){
    let subtitlePath = subData.url;
    let subElement = document.createElement("button");
    subElement.id = base64Id(subtitlePath);
    subElement.innerText = subData.display === "Built In" ? subData.languageName : counter;
    subElement.value = subtitlePath;

    let findSimilairSubElement = subsList.querySelector(`#${base64Id(subtitlePath)}`);
    if (!findSimilairSubElement){
      subElement.addEventListener("click", async() => {
        
        Array.from(subsList.children).forEach(element => {element.classList.remove("active")});

        subElement.classList.add("active");

        if(subData?.type === "local"){
          let fileContent = await window.electronAPI.readSubFile(subtitlePath);
          parseSrtSubs(fileContent);

        }else{
          fetch(subtitlePath).then(res => res.text())
          .then(data => {
            parseSrtSubs(data);
          });
        }
      });

      subsList.append(subElement);

    } else {
      findSimilairSubElement.style.display = "block";
    }
    counter ++;
  };
}

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
    let subs = await loadingAllSubs(mediaImdbId,seasonNumber,episodeNumber);
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
        TopButtonsContainer.classList.remove("fixedTopBar");
        BottomButtonsContainer.style.display = "block";
        videoIsPlaying = true;
      }).catch(err=>{
        console.error(err);
        createWarningDiv(err.message);
      });
    }

  }else{
    let identifyingElements = {"IMDB_ID":mediaImdbId,"episodeNumber":episodeNumber,"seasonNumber":seasonNumber,"DownloadDir":downloadPath};
    let videoPath = await window.electronAPI.getFullVideoPath(downloadPath,fileName);
    let subs = await window.electronAPI.loadLocalSubs(videoPath,identifyingElements);
    subtitlesArray = subs;

    if(fileIsMkv){
      // pass to externel Player
      playVideoInMpv(false,undefined,downloadPath,fileName,TorrentIdentification,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber,undefined);

    }else{
      insertLanguageButton(subs); 
      getSubsViaLanguage("built-in");

      VideoElement.id = "video-MediaPlayer";
      VideoElement.innerHTML = `<source src='${videoPath}'>`;
      VideoElement.load();
      VideoElement.play();
      VideoElement.removeAttribute("style");
      document.documentElement.removeAttribute("style");
      document.documentElement.style.backgroundColor = "black";
      TopButtonsContainer.classList.remove("fixedTopBar");
      TopButtonsContainer.style.display = "flex";
      BottomButtonsContainer.style.display = "block";
      videoIsPlaying = true;
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

function parseSrtSubs(SubsText){
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
        if( subLines[startPoint+1] !== undefined && !isNaN(subLines[startPoint]) && subLines[startPoint+1].includes(" --> ") ) break;
        else if(subLines[startPoint].trim() !== "") chunk += subLines[startPoint]+"\n";
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
    if((SubsStruct[i].startTime + (subsDelay / 1000)) <= VideoElement.currentTime &&
       (SubsStruct[i].endTime + (subsDelay / 1000)) >= VideoElement.currentTime){

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
  if (SubDiv.classList.contains("hideElement")) return;

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
  }
}

async function togglePIP(event){
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else {
    await VideoElement.requestPictureInPicture();
  }
}

VideoElement.addEventListener("enterpictureinpicture", (event) => {
  VideoElement.style.display = "none";
  document.getElementById("picture-in-picture-indicator-text").style.display = "block";
  document.getElementById("img-OpenPIP").src = "../assets/icons/closePIP.png";
});

VideoElement.addEventListener("leavepictureinpicture", (event) => {
  VideoElement.style.display = "block";
  document.getElementById("picture-in-picture-indicator-text").style.display = "none";
  document.getElementById("img-OpenPIP").src = "../assets/icons/PIP.png";
});


function OpenSubtitles(){
  repositionSubDiv();
  SubDiv.classList.toggle("hideElement");
}

function repositionSubDiv(){
  SubDiv.style.left = SubButton.getBoundingClientRect().left + SubButton.offsetWidth/2+"px";
}

let subsSizeOffsetPercent = 0;
function SubSize(operation){
  if(operation === "+" && subsSizeOffsetPercent < 200) subsSizeOffsetPercent += 10;
  else if(operation === "-" && subsSizeOffsetPercent > -100 ) subsSizeOffsetPercent -= 10;

  let Sign = subsSizeOffsetPercent >= 0 ?"+":"";
  SubSizeDivInput.value = Sign+subsSizeOffsetPercent+ "%"
  let currentFontSize = defaultFontSize + (defaultFontSize*subsSizeOffsetPercent)/100 + "px";
  SubDivDisplay.style.fontSize = currentFontSize;
}

function SubDelay(operation){
  let valueToAdd = 
     operation === "+" ? 100
    : operation === "-" ? -100
    : 0;

  subsDelay += valueToAdd; // ms

  let Sign = subsDelay >= 0 ?"+":"";
  SubDelayDivInput.value = Sign+subsDelay+ "ms"

}

SubSizeDivInput.value = "+0%";
SubDelayDivInput.value = "+0ms";

[SubSizeDivInput, SubDelayDivInput].forEach(subInputElement => {
  subInputElement.addEventListener("focus" ,() => {
    const formatedValue = getNumberFromStringInput(subInputElement.value);
    subInputElement.setAttribute("old_value", formatedValue);
  });

  subInputElement.addEventListener("keydown",(event) => {
    if(event.key === "Enter")
      subInputElement.blur();
  });
});

SubSizeDivInput.addEventListener("blur" ,() => {
  let inputedValue = getValueForSubInputConfiguration(SubSizeDivInput);

  let currentFontSize = defaultFontSize + (defaultFontSize * Number(inputedValue))/100 + "px";
  SubDivDisplay.style.fontSize = currentFontSize;

  subsDelay += Number(inputedValue);
  SubSizeDivInput.value = `${inputedValue}%`;
});

SubDelayDivInput.addEventListener("blur" ,() => {
  let inputedValue = getValueForSubInputConfiguration(SubDelayDivInput);
  subsDelay = Number(inputedValue);
  SubDelayDivInput.value = `${inputedValue}ms`;
});


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
    MediaLibraryObject = {...metaData,lastPlaybackPosition:lastPbPosition,typeOfSave:["Currently Watching"],timeOfSave:Date.now()}
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

function createWarningDiv(errMessage){
  let WarningDiv = document.getElementById("div-SomethingWentWrong");
  WarningDiv.innerHTML = errMessage;
  loadingGif.style.display = "none";
  WarningDiv.style.display = "flex";
}

function monitoringErrorsCummingFromMainProcess(){
  window.electronAPI.getFetchingTorrentErrors((err) =>{
    console.error(err);
    createWarningDiv(err)
  })
}

function monitorMsgFromMainProcess(){
  window.electronAPI.getMsgFromMainProcess((msg) =>{
    let msgType = msg.type;
    if(msgType === "request"){
      let request = msg.request;
        if(request ===  "exit_video_player")
          window.electronAPI.goBack();

    }
  });
}

function getValueForSubInputConfiguration(inputElement){
  const newValue = getNumberFromStringInput(inputElement.value);
  const oldValue = inputElement.getAttribute("old_value");
  const choosenValue =  newValue ?? oldValue;
  if(choosenValue >= 0) return `+${choosenValue}`;
  return choosenValue
}

function getNumberFromStringInput(rawInput){
  let formatedInput = rawInput
    .replace("ms","")
    .replace("%","");

  const numberInput = Number(formatedInput);
  return !isNaN(numberInput) ? numberInput : null;
}

window.addEventListener("mousedown",hideSubDiv);
monitoringErrorsCummingFromMainProcess();
monitorMsgFromMainProcess();
loadIconsDynamically();
