const data = new URLSearchParams(window.location.search);
let Magnet = atob(data.get("MagnetLink"));

let MediaId = data.get("MediaId");
let MediaType = data.get("MediaType");

let bgImagePath = data.get("bgPath");
let mediaImdbId = data.get("ImdbId");

let seasonNumber = data.get("seasonNumber");
let episodeNumber = data.get("episodeNumber");

let defaultFontSize = 30;

let TopButtonsContainer = document.getElementById("div-topButtonsContainer");
let BottomButtonsContainer = document.getElementById("div-bottomButtonsContainer");
let SubDivDisplay = document.getElementById("div-Subtitles");
let loadingGif = document.getElementById("img-movieMedias-LoadingGif");
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

var oldVolume = 0;
let mouseHoveringOnControlDiv;
var SubsStruct = [];
let subtitlesArray = [];

VideoElement.volume = 0.5;
document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bgImagePath}')`;
document.documentElement.style.backgroundRepeat = `no-repeat`;
document.documentElement.style.backgroundPosition = `center center`;
document.documentElement.style.backgroundSize = `cover`;
document.documentElement.style.backgroundAttachment = `fixed`;

loadSubSettings();
loadVideo(Magnet);

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

VideoElement.addEventListener("playing", async (event)=>{
  VideoElement.currentTime = await getLatestPlayBackPosition(MediaId,MediaType,episodeNumber,seasonNumber);

  setInterval(()=>{
    let lastPbPosition = parseInt(VideoElement.currentTime);
    console.log("hello");
    let metaData = {seasonNumber:seasonNumber,episodeNumber:episodeNumber,Magnet:Magnet,bgImagePath:bgImagePath,mediaImdbId:mediaImdbId};
    updateLastSecondBeforeQuit(lastPbPosition,MediaId,MediaType,metaData);
    console.log(lastPbPosition);
  },10000);
},{ once:true });

VideoElement.addEventListener("playing", (event)=>{
  loadingGif.setAttribute("style","display:none");
});

VideoElement.addEventListener("waiting", ()=>{
  loadingGif.setAttribute("style","");
});

VideoElement.addEventListener("ended", ()=>{
  window.electronAPI.saveVideo();
});

VideoElement.addEventListener("timeupdate",()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoSlider.value = (VideoElement.currentTime/VideoElement.duration) * 100;
    VideoDurationElement.innerText = gettingformatedTime(VideoElement.duration);
    VideoPositionElement.innerText = gettingformatedTime(VideoElement.currentTime);
  }
});


VideoElement.addEventListener('progress', function() {
  const buffered = VideoElement.buffered;
  for (let i = 0; i < buffered.length; i++) {
    let start = buffered.start(i);
    let end = buffered.end(i);

    start = gettingformatedTime(start);
    end = gettingformatedTime(end);
    console.log(`Buffered range ${i}: ${start} - ${end}`);
 }
});

VolumeSliderElement.addEventListener("input", ()=>{
  VideoElement.muted = false;
  VideoElement.volume = VolumeSliderElement.value / 100;
  updateVolumeIcons();
});

VideoSlider.addEventListener("input", ()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoElement.currentTime = (VideoSlider.value * VideoElement.duration) / 100 ;
  }
});

window.addEventListener("dblclick",(event)=>{
  let ElementsThatWerePressed = document.elementsFromPoint(event.clientX,event.clientY);
  fullscreenClicked();
});

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  else if(event.key == "ArrowUp") VideoElement.volume = Math.min(1, VideoElement.volume + 0.1);
  else if(event.key == "ArrowDown") VideoElement.volume = Math.max(0, VideoElement.volume - 0.1);
  else if(event.key == "ArrowRight") VideoElement.currentTime += 10;
  else if(event.key == "ArrowLeft") VideoElement.currentTime -= 10;
  else if(event.key == " ") TogglePauseUnpause();
  else if(event.key == "f") fullscreenClicked();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();

  VolumeSliderElement.value = VideoElement.volume * 100;
  updateVolumeIcons();
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
  resizeSubMainDiv();
});

async function loadingAllSubs(id){
  try{
    const res = await fetch(`https://sub.wyzie.ru/search?id=${id}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    subtitlesArray = data;
    getSubsViaLanguage("en");
    let languages = [];
    languages.push({display:"English",language:"en"});
    languages.push({display:"Arabic",language:"ar"});
    subtitlesArray.forEach(sub => {
      if(!languages.some(langObj => langObj.display === sub.display && langObj.language === sub.language))
        languages.push({display:sub.display,language:sub.language});
    });
    insertLanguageButton(languages); 
  }catch(err){
    console.error(err);
  }
}
function insertLanguageButton(langArray){
  let subBtnDiv = document.getElementById("div-LeftSubContainer");
  langArray.forEach((lang,index) => {
    let buttonElement = document.createElement("button");
    if(index == 0) buttonElement.style.backgroundColor = "rgba(255,255,255,0.1)";
    buttonElement.setAttribute("onclick","loadLanguageSub(this)");
    buttonElement.value = lang.language;
    buttonElement.innerText = lang.display;
    subBtnDiv.append(buttonElement);
  });
}

function getSubsViaLanguage(language){
  let languageData = subtitlesArray.filter(sub => sub.language == language);
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
    let SubSource = fetchedData[i].url;
    let subElement = document.createElement("button");
    subElement.innerText = i;
    subElement.value = SubSource; 
    subElement.addEventListener("click", () => {
      Array.from(subsList.children).forEach(element => {
        element.style.backgroundColor = "transparent";
        element.style.borderColor = "transparent";
      });
      subElement.style.backgroundColor = "rgba(255,255,255,0.05)";
      subElement.style.borderBottom = "4px solid rgba(var(--secondary-color))"
      fetch(SubSource).then(res => res.text()
        ).then(data => {
          scrapSubs(data);
        });
    });
    subsList.append(subElement);
  };
}

resizeSubMainDiv()

function gettingformatedTime(time){
  let hours = parseInt((time / 60) / 60);
  let minutes = parseInt((time / 60) - hours * 60);
  let seconds = parseInt(time - minutes * 60 - hours * 60 * 60);
  let results = String(hours).padStart(2,"0")+":"+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
  return results;
}

function loadVideo(Magnet){
  window.electronAPI.getVideoUrl(Magnet).then( ([url,mimeType]) => {
    console.log(`Video Format: ${mimeType}`);
    if(mimeType == "video/x-matroska") throw new Error(`${mimeType} Video Format is Not Supported.`)
    VideoElement.id = "video-MediaPlayer";
    VideoElement.innerHTML = `<source src=${url} type='${mimeType}'>`;
    VideoElement.load();
    VideoElement.play();
    VideoElement.removeAttribute("style");
    document.documentElement.removeAttribute("style");
    document.documentElement.style.backgroundColor = "black";
  }).catch(err=>{
    console.error(err);
    let getElementById = document.getElementById("div-SomethingWentWrong");
    getElementById.innerHTML = err.message;
    loadingGif.remove();
    getElementById.style.display = "flex";
  });
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
  let PauseButtonImageElement = document.getElementById("img-PauseButton");
  if(VideoElement.paused){
    VideoElement.play();
    PauseButtonImageElement.src="../cache/icons/BPause.png"
  }else{
    VideoElement.pause();
    PauseButtonImageElement.src="../cache/icons/BPlay.png"
  }
}

function toggleVolume(){
  VideoElement.muted = !VideoElement.muted;
  updateVolumeIcons();
}

function updateVolumeIcons(){
  if(VideoElement.volume <= 0.0 || VideoElement.muted) VolumeButton.children[0].src = "../cache/icons/BMute.png";
  else if(VideoElement.volume <= 0.25) VolumeButton.children[0].src = "../cache/icons/BVolumeLow.png";
  else if(VideoElement.volume <= 0.75) VolumeButton.children[0].src = "../cache/icons/BVolumeMid.png";
  else if(VideoElement.volume > 0.75) VolumeButton.children[0].src = "../cache/icons/BVolumeControl.png";
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

function resizeSubMainDiv(){
  SubDiv.style.left = SubButton.getBoundingClientRect().left + SubButton.offsetWidth/2+"px";
}
let SubSizeCounter = 0;
function SubSize(operation){
  let SubSizeDivP = document.getElementById("div-subSize").querySelector("p");
  if(operation == "+" && SubSizeCounter < 200) SubSizeCounter += 10;
  else if(operation == "-" && SubSizeCounter > -100 ) SubSizeCounter -= 10;
  let Sign = SubSizeCounter >= 0 ?"+":"";
  SubSizeDivP.innerText =  Sign+SubSizeCounter+ "%"
  SubDivDisplay.style.fontSize = (defaultFontSize*(SubSizeCounter+100))/100 + "px";
}

async function loadSubSettings(){
  let Settings = await window.electronAPI.loadSettings(); 

  SubDivDisplay.style.fontSize = (defaultFontSize*Settings.SubFontSize)/100
  SubDivDisplay.style.fontFamily = Settings.SubFontFamily
  SubDivDisplay.style.color = Settings.SubColor;
  let numberInHex = parseInt(Settings.SubBackgroundColor.split("#")[1],16);
  let r = (numberInHex >> 16) & 255;
  let g = (numberInHex >> 8) & 255;
  let b = (numberInHex) & 255;
  SubDivDisplay.style.backgroundColor = `rgba(${r},${g},${b},${Settings.SubBackgroundOpacityLevel/100}`;
  if(Settings.TurnOnSubsByDefault){
    switchToggle.checked = true;
    bottomSubElement.classList.toggle("hideElement");
  }
}

async function getLatestPlayBackPosition(MediaId,MediaType,episodeNumber,seasonNumber){
  let targetIdentification = {MediaId:MediaId,MediaType:MediaType};
  const MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if(MediaLibraryObject == undefined) return 0;

  let mediaIsAnEpisode = (MediaLibraryObject.hasOwnProperty("episodeNumber") && MediaLibraryObject.hasOwnProperty("seasonNumber"));
  let isRequestedEpisode = mediaIsAnEpisode ? (MediaLibraryObject["episodeNumber"] == episodeNumber && MediaLibraryObject["seasonNumber"] == seasonNumber) : true;


  if(MediaLibraryObject.hasOwnProperty("typeOfSave") &&
    MediaLibraryObject["typeOfSave"].includes("Currently Watching") &&
    MediaLibraryObject.hasOwnProperty("lastPlaybackPosition")&& 
    isRequestedEpisode){

      return MediaLibraryObject["lastPlaybackPosition"];
  }
  return 0;
}

async function updateLastSecondBeforeQuit(lastPbPosition,MediaId,MediaType,metaData){
  let targetIdentification = {MediaId:MediaId,MediaType:MediaType};
  let MediaLibraryObject = await window.electronAPI.loadMediaLibraryInfo(targetIdentification);

  if(MediaLibraryObject != undefined){
    MediaLibraryObject = MediaLibraryObject[0]; 
    MediaLibraryObject["lastPlaybackPosition"] = lastPbPosition;
    MediaLibraryObject["seasonNumber"] = metaData.seasonNumber;
    MediaLibraryObject["episodeNumber"] = metaData.episodeNumber;

    if(!MediaLibraryObject["typeOfSave"].includes("Currently Watching")){
      MediaLibraryObject["typeOfSave"].push("Currently Watching")
      MediaLibraryObject["Magnet"] ??= metaData?.Magnet;
      MediaLibraryObject["bgImagePath"] ??= metaData?.bgImagePath;
      MediaLibraryObject["mediaImdbId"] ??= metaData?.mediaImdbId;
    }
    await window.electronAPI.removeMediaFromLibrary(targetIdentification);

  }else{
    
    MediaLibraryObject = {
      MediaId:MediaId,
      MediaType:MediaType,
      Magnet:metaData?.Magnet,
      bgImagePath:metaData?.bgImagePath,
      mediaImdbId:metaData?.mediaImdbId,

      lastPlaybackPosition:lastPbPosition,
      seasonNumber:metaData.seasonNumber,
      episodeNumber:metaData.episodeNumber,
      typeOfSave:["Currently Watching"]
    }
  }
  window.electronAPI.addMediaToLibrary(MediaLibraryObject);
}
