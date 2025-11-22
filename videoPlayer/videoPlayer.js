const data = new URLSearchParams(window.location.search);
let Magnet = atob(data.get("MagnetLink"));

let MediaId = data.get("MediaId");
let MediaType = data.get("MediaType");

let bgImagePath = data.get("bgPath");
let mediaImdbId = data.get("id");

let seasonNumber = data.get("seasonNumber");
let episodeNumber = data.get("episodeNumber");

console.log("Video Magnet:",Magnet);

let loadingGif = document.getElementById("img-movieMedias-LoadingGif");

loadVideo(Magnet,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber);

setBackgroundImage();

let timeout;

async function loadingAllSubs(id){
  try{
    const res = await fetch(`https://sub.wyzie.ru/search?id=${id}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    let subObject = data.filter(obj => MOST_POPULAR_LANGUAGES.includes(obj.display));
    subObject = subObject.map(obj=>{return{url:obj.url,language:obj.display}});

    return subObject;
  }catch(err){
    console.error(err);
  }
}

function setBackgroundImage(){
  document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bgImagePath}')`;
  document.documentElement.style.backgroundRepeat = `no-repeat`;
  document.documentElement.style.backgroundPosition = `center center`;
  document.documentElement.style.backgroundSize = `cover`;
  document.documentElement.style.backgroundAttachment = `fixed`;
}

function gettingformatedTime(time){
  let hours = parseInt((time / 60) / 60);
  let minutes = parseInt((time / 60) - hours * 60);
  let seconds = parseInt(time - minutes * 60 - hours * 60 * 60);
  let results = String(hours).padStart(2,"0")+":"+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
  return results;
}

async function loadVideo(Magnet,MediaId,MediaType,mediaImdbId,seasonNumber,episodeNumber){
  let subsObjects = await loadingAllSubs(mediaImdbId);
  let metaData = {"Magnet":Magnet,"bgImagePath":bgImagePath, "mediaImdbId":mediaImdbId,"seasonNumber":seasonNumber,"episodeNumber":episodeNumber};
  window.electronAPI.StreamVideo(Magnet,MediaId,MediaType,subsObjects,metaData);
}

function SubObj(startTime, endTime, content){
  this.startTime = startTime;
  this.endTime = endTime;
  this.content = content;
}

setupKeyPressesHandler();

window.addEventListener("dblclick",()=>{
  fullscreenClicked();
});

loadIconsDynamically();
