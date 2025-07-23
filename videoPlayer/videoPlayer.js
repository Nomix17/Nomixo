const data = new URLSearchParams(window.location.search);
let Magnet = atob(data.get("MagnetLink"));
let bgImagePath = data.get("bgPath");

let TopButtonsContainer = document.getElementById("div-topButtonsContainer");
let BottomButtonsContainer = document.getElementById("div-bottomButtonsContainer");

let loadingGif = document.getElementById("img-movieMedias-LoadingGif");
let VideoContainer = document.getElementById("div-middle");
let VideoElement = document.getElementsByTagName("video")[0];
let VideoSlider = document.getElementById("input-videoSlider");
let VideoPositionElement = document.getElementById("p-videoPosition");
let VideoDurationElement = document.getElementById("p-videoDuration");
let VolumeButton = document.getElementById("btn-VolumeButton");
let VolumeSliderElement = document.getElementById("input-volumeSlider");
var oldVolume = 0;
let mouseHoveringOnControlDiv;


VideoElement.volume = 0.5;
document.documentElement.style.background = `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${bgImagePath}')`;
document.documentElement.style.backgroundRepeat = `no-repeat`;
document.documentElement.style.backgroundPosition = `center center`;
document.documentElement.style.backgroundSize = `cover`;
document.documentElement.style.backgroundAttachment = `fixed`;

loadVideo(Magnet)

TopButtonsContainer.addEventListener("mouseenter", ()=>{ mouseHoveringOnControlDiv = true });
TopButtonsContainer.addEventListener("mouseleave", ()=>{ mouseHoveringOnControlDiv = false });
BottomButtonsContainer.addEventListener("mouseenter", ()=>{ mouseHoveringOnControlDiv = true });
BottomButtonsContainer.addEventListener("mouseleave", ()=>{ mouseHoveringOnControlDiv = false });

let timeout;
window.addEventListener("mousemove",()=>{
  clearTimeout(timeout);
  TopButtonsContainer.style.top = "0";
  BottomButtonsContainer.style.bottom = "0";
  timeout = setTimeout(()=>{
    if(!mouseHoveringOnControlDiv){
      TopButtonsContainer.style.top = "-50%";
      BottomButtonsContainer.style.bottom = "150%";
    }
  },1000);

});

VideoElement.addEventListener("playing", ()=>{
  loadingGif.setAttribute("style","display:none");
});

VideoElement.addEventListener("waiting", ()=>{
  loadingGif.setAttribute("style","");
});

VideoElement.addEventListener("timeupdate",()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoSlider.value = (VideoElement.currentTime/VideoElement.duration) * 100;
    VideoDurationElement.innerText = gettingformatedTime(VideoElement.duration);
    VideoPositionElement.innerText = gettingformatedTime(VideoElement.currentTime);
  }
});

VolumeSliderElement.addEventListener("input", ()=>{
  VideoElement.volume = VolumeSliderElement.value / 100;
  updateVolumeIcons();
});

VideoSlider.addEventListener("input", ()=>{
  if(isFinite(VideoElement.duration) && isFinite(VideoSlider.value)){
    VideoElement.currentTime = (VideoSlider.value * VideoElement.duration) / 100 ;
  }
});

window.addEventListener("dblclick",()=>{
  window.electronAPI.toggleFullscreen();
});

window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  else if(event.key == "ArrowUp") VideoElement.volume = Math.min(1, VideoElement.volume + 0.1);
  else if(event.key == "ArrowDown") VideoElement.volume = Math.max(0, VideoElement.volume - 0.1);
  else if(event.key == "ArrowRight") VideoElement.currentTime += 10;
  else if(event.key == "ArrowLeft") VideoElement.currentTime -= 10;
  else if(event.key == " ") TogglePauseUnpause();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();

  VolumeSliderElement.value = VideoElement.volume * 100;
  updateVolumeIcons();
});



function gettingformatedTime(time){
  let hours = parseInt((time / 60) / 60);
  let minutes = parseInt((time / 60) - hours * 60);
  let seconds = parseInt(time - minutes * 60 - hours * 60 * 60);
  let results = String(hours).padStart(2,"0")+":"+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
  return results;
}

function loadVideo(Magnet){
  window.electronAPI.getVideoUrl(Magnet).then( url => {
    VideoElement.id = "video-MediaPlayer";
    VideoElement.innerHTML = `<source src=${url} type='video/mp4'>`;
    VideoElement.load();
    VideoElement.play();
    VideoElement.removeAttribute("style");
    document.documentElement.removeAttribute("style");
    document.documentElement.style.backgroundColor = "black";
  });
}

function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
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
  if(VideoElement.volume <= 0.0) VolumeButton.children[0].src = "../cache/icons/BMute.png";
  else if(VideoElement.volume <= 0.25) VolumeButton.children[0].src = "../cache/icons/BVolumeLow.png";
  else if(VideoElement.volume <= 0.75) VolumeButton.children[0].src = "../cache/icons/BVolumeMid.png";
  else if(VideoElement.volume > 0.75) VolumeButton.children[0].src = "../cache/icons/BVolumeControl.png";
} 

