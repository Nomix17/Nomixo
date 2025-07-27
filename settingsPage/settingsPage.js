let ZoomFactorInput = document.getElementById("input-ZoomFactor");
let toggleButton = document.getElementById("toggleDefaultSubtitles");

let increaseFontSizeButton = document.getElementById("btn-increaseFontSize"); 
let FontSizePara = document.getElementById("p-fontSize");
let decreaseFontSizeButton = document.getElementById("btn-decreaseFontSize"); 

let CurrentFont = document.getElementById("currrectFont");
let DropDownFontMenu = document.getElementById("dropDownMenu-Font");

let inputTextColor = document.getElementById("input-TextColor");

let inputBackgroundColor = document.getElementById("input-BackgroundColor");

let increaseOpactiy = document.getElementById("btn-increaseOpacity");
let OpacityPara = document.getElementById("p-Opacity");
let decreaseOpacity = document.getElementById("btn-decreaseOpacity");

let ApplyButton = document.getElementById("btn-applySettings");

let ZoomFactorValue=1;
let SubtitlesOnByDefault = false;
let FontSize = 100;
let FontFamily = "monospace";
let TextColor = "white";
let BackgroundColor ="black";
let Opacity = 0;

loadSettings();

ZoomFactorInput.addEventListener("input",(event)=>{
  ZoomFactorValue = ZoomFactorInput.value/50;
});

toggleButton.addEventListener("change",()=>{
  SubtitlesOnByDefault = toggleButton.checked;
});

increaseFontSizeButton.addEventListener("click",()=>{
  if(FontSize < 200) FontSize += 10;
  FontSizePara.innerText = FontSize+"%";
});

decreaseFontSizeButton.addEventListener("click",()=>{
  if(FontSize > 0) FontSize -= 10;
  FontSizePara.innerText = FontSize+"%";
});

DropDownFontMenu.addEventListener("mousedown",(event)=>{
  FontFamily = event.target.innerText;
  CurrentFont.innerText = FontFamily;
});

inputTextColor.addEventListener("input",(event)=>{
  TextColor = inputTextColor.value;
});

inputBackgroundColor.addEventListener("input",(event)=>{
  BackgroundColor = inputBackgroundColor.value;
});

increaseOpactiy.addEventListener("click",()=>{
  if(Opacity < 100) Opacity += 10;
  OpacityPara.innerText = Opacity + "%";
});

decreaseOpacity.addEventListener("click",()=>{
  if(Opacity > 0) Opacity -= 10;
  OpacityPara.innerText = Opacity + "%";
});

ApplyButton.addEventListener("click",()=>{
  let SettingsObj = {
    PageZoomFactor: ZoomFactorValue,
    TurnOnSubsByDefault: SubtitlesOnByDefault,
    SubFontSize: FontSize,
    SubFontFamily: FontFamily,
    SubColor: TextColor,
    SubBackgroundColor: BackgroundColor,
    SubBackgroundOpacityLevel: Opacity
  }

  window.electronAPI.applySettings(SettingsObj);
});
window.addEventListener("keydown",(event)=>{
  if(event.key == "Escape") window.electronAPI.goBack();
  if (event.key == "Tab" ||
      event.key == "Super" ||
      event.key == "Alt" ) event.preventDefault();
});

async function loadSettings(){
  SettingsObj = await window.electronAPI.loadSettings();

  ZoomFactorValue= SettingsObj.PageZoomFactor;
  SubtitlesOnByDefault = SettingsObj.TurnOnSubsByDefault ;
  FontSize = SettingsObj.SubFontSize;
  FontFamily = SettingsObj.SubFontFamily;
  TextColor = SettingsObj.SubColor;
  BackgroundColor = SettingsObj.SubBackgroundColor;
  Opacity = SettingsObj.SubBackgroundOpacityLevel;

  ZoomFactorInput.value =   ZoomFactorValue*50;
  if(SubtitlesOnByDefault) toggleButton.click();
  FontSizePara.innerText = FontSize+"%";
  CurrentFont.innerText = FontFamily;
  inputTextColor.value = TextColor;
  inputBackgroundColor.value = BackgroundColor;
  OpacityPara.innerText = Opacity+"%";
}

function fullscreenClicked(){
  window.electronAPI.toggleFullscreen();
}

function backToHome(){
  let path = "./home/mainPage.html";
  window.electronAPI.navigateTo(path);
}
function openDiscoveryPage(genreId, MediaType){
  let path = `./discovery/discoveryPage.html?GenreId=${genreId}&MediaType=${MediaType}`;
  window.electronAPI.navigateTo(path);
}

function OpenSettingsPage(){
  path = "./settingsPage/settingsPage.html"
  window.electronAPI.navigateTo(path);
}
