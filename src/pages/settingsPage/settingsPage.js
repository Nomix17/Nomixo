const RightmiddleDiv = document.getElementById("div-middle-right");
const ZoomFactorInput = document.getElementById("input-ZoomFactor");
const ColorInputsWithAlphaValue = document.querySelectorAll('.ElementsTopOfEachOther input[type="color"]');
const ApplyButton = document.getElementById("btn-applySettings");

// Internal Player
const toggleButtonInternal = document.getElementById("toggleDefaultSubtitlesInternal");
const increaseFontSizeInternalButton = document.getElementById("btn-increaseFontSizeInternal"); 
const FontSizeInternalInput = document.getElementById("p-fontSizeInternal");
const decreaseFontSizeInternalButton = document.getElementById("btn-decreaseFontSizeInternal"); 
const increaseBackgroundOpacityInternalButton = document.getElementById("btn-increaseOpacityInternal"); 
const backgroundOpacityInternalInput = document.getElementById("p-OpacityInternal");
const decreaseBackgroundOpacityInternalButton = document.getElementById("btn-decreaseOpacityInternal"); 
const CurrentFontInternal = document.getElementById("currrectFontInternal");
const DropDownFontMenuInternal = document.getElementById("dropDownMenu-Font-Internal");
const inputTextColorInternal = document.getElementById("input-TextColorInternal");
const inputBackgroundColorInternal = document.getElementById("input-BackgroundColorInternal");

//External Player
const toggleButtonExternal = document.getElementById("toggleDefaultSubtitlesExternal");
const increaseFontSizeExternalButton = document.getElementById("btn-increaseFontSizeExternal"); 
const FontSizeExternalInput = document.getElementById("p-fontSizeExternal");
const decreaseFontSizeExternalButton = document.getElementById("btn-decreaseFontSizeExternal"); 
const CurrentFontExternal = document.getElementById("currrectFontExternal");
const DropDownFontMenuExternal = document.getElementById("dropDownMenu-Font");
const inputTextColorExternal = document.getElementById("input-TextColorExternal");
const inputMpvExecPath = document.getElementById("input-mpv-exec-path");

let ZoomFactorValue=1;
let somethingChanged = false;
let supressInputEventListener = false;

let SubtitlesOnByDefaultInternal = false;
let FontSizeInternal = 100;
let FontFamilyInternal = "monospace";
let TextColorInternal = "white";
let BackgroundColorInternal ="black";
let OpacityInternal = 0;
let choosenTheme;

let SubtitlesOnByDefaultExternal = false;
let FontSizeExternalExternal = 24;
let FontFamilyExternal = "monospace";
let TextColorExternal = "white";
let MpvExecPath = "";

let TMDB_API_KEY = null;
let Wyzie_API_KEY = null;

async function loadApiKeys() {
  TMDB_API_KEY = await window.electronAPI.getTMDBAPIKEY();
  document.querySelector(".api-key-input.tmdb").value = 
    TMDB_API_KEY != null &&
    TMDB_API_KEY !== "undefined" 
      ? TMDB_API_KEY 
      : "";

  Wyzie_API_KEY = await window.electronAPI.getWyzieAPIKey();
  document.querySelector(".api-key-input.wyzie").value =
    Wyzie_API_KEY != null &&
    Wyzie_API_KEY !== "undefined"
      ? Wyzie_API_KEY
      : "";
}

async function saveApiKeys() {
  if(
    TMDB_API_KEY != null &&
    Wyzie_API_KEY != null && 
    TMDB_API_KEY.trim() !== "" &&
    Wyzie_API_KEY.trim() !== ""
  ) {

    await window.electronAPI.saveApiKey( {
      "TMDB_API_KEY":TMDB_API_KEY,
      "Wyzie_API_KEY":Wyzie_API_KEY
    });
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("input").forEach(inputElement=>{
    inputElement.addEventListener("change", ()=>{
      if(!supressInputEventListener){
        somethingChanged = true;
      }
    });
  });
});

// Elements Listeners
ZoomFactorInput.addEventListener("input",(event)=>{
  ZoomFactorValue = ZoomFactorInput.value/50;
  setFloatingZoomFactorDiv(ZoomFactorValue);
});

ZoomFactorInput.addEventListener("mouseenter",()=>{
  let bubble = document.querySelector('output[for="foo"]');
  setFloatingZoomFactorDiv(ZoomFactorValue);
  bubble.style.opacity = "1";
});

ZoomFactorInput.addEventListener("mouseleave",()=>{
  let bubble = document.querySelector('output[for="foo"]');
  bubble.style.opacity = "0";
});

ApplyButton.addEventListener("click",()=>{
  let SettingsObj = getSettings();
  let ThemeObj = getThemeConfig();
  let SubConfigObj = getSubConfig();
  
  if(somethingChanged){
    window.electronAPI.applySettings(SettingsObj);
    window.electronAPI.applyTheme(ThemeObj);
    window.electronAPI.applySubConfig(SubConfigObj);
    document.getElementById('cssThemeStylesheet').href = 'theme://theme.css?' + Date.now();
    displayMessage("new settings were saved.");
    somethingChanged = false;
  }
  saveApiKeys();
});

(function(){
  ColorInputsWithAlphaValue.forEach(element => {
    element.addEventListener("input",()=>{
      applySelectedColor(Array(element)); 
    });
  });
})();

// Internal Player Elements Listener

toggleButtonInternal.addEventListener("change",()=>{
  SubtitlesOnByDefaultInternal = toggleButtonInternal.checked;
});

increaseFontSizeInternalButton.addEventListener("click",()=>{
  if(FontSizeInternal < 100) FontSizeInternal += 1;
  FontSizeInternalInput.value = FontSizeInternal+"px";
  somethingChanged = true;
});

decreaseFontSizeInternalButton.addEventListener("click",()=>{
  if(FontSizeInternal > 0) FontSizeInternal -= 1;
  FontSizeInternalInput.value = FontSizeInternal+"px";
  somethingChanged = true;
});

increaseBackgroundOpacityInternalButton.addEventListener("click",()=>{
  if(OpacityInternal < 100) OpacityInternal += 5;
  backgroundOpacityInternalInput.value = OpacityInternal+"%";
  somethingChanged = true;
});

decreaseBackgroundOpacityInternalButton.addEventListener("click",()=>{
  if(OpacityInternal > 0) OpacityInternal -= 5;
  backgroundOpacityInternalInput.value = OpacityInternal+"%";
  somethingChanged = true;
});

DropDownFontMenuInternal.addEventListener("mousedown",(event)=>{
  FontFamilyInternal = event.target.innerText;
  CurrentFontInternal.innerText = FontFamilyInternal;
  somethingChanged = true;
});

inputTextColorInternal.addEventListener("input",(event)=>{
  TextColorInternal = inputTextColorInternal.value;
});

inputBackgroundColorInternal.addEventListener("input",(event)=>{
  BackgroundColorInternal = inputBackgroundColorInternal.value;
});

FontSizeInternalInput.addEventListener("blur",(event) => {commitFontSizeInternal()});
FontSizeInternalInput.addEventListener("keypress",(event) => {
  if(event.key === "Enter")
    commitFontSizeInternal()
});

backgroundOpacityInternalInput.addEventListener("blur",(event) => {commitBgOpacityInternal()});
backgroundOpacityInternalInput.addEventListener("keypress",(event) => {
  if(event.key === "Enter")
    commitBgOpacityInternal()
});

// External Player Elements Listener

toggleButtonExternal.addEventListener("change",()=>{
  SubtitlesOnByDefaultExternal = toggleButtonExternal.checked;
});

increaseFontSizeExternalButton.addEventListener("click",()=>{
  if(FontSizeExternal < 100) FontSizeExternal += 1;
  FontSizeExternalInput.value = FontSizeExternal+"px";
  somethingChanged = true;
});

decreaseFontSizeExternalButton.addEventListener("click",()=>{
  if(FontSizeExternal > 0) FontSizeExternal -= 1;
  FontSizeExternalInput.value = FontSizeExternal+"px";
  somethingChanged = true;
});

DropDownFontMenuExternal.addEventListener("mousedown",(event)=>{
  FontFamilyExternal = event.target.innerText;
  CurrentFontExternal.innerText = FontFamilyExternal;
  somethingChanged = true;
});

inputTextColorExternal.addEventListener("input",(event)=>{
  TextColorExternal = inputTextColorExternal.value;
});

inputMpvExecPath.addEventListener("input", (event) => {
  MpvExecPath = inputMpvExecPath.value;
});

FontSizeExternalInput.addEventListener("blur",(event) => {commitFontSizeExternal()});
FontSizeExternalInput.addEventListener("keypress",(event) => {
  if(event.key === "Enter")
    commitFontSizeExternal()
});

// global Functions 

async function loadTheme(){
  let ThemeObj = await window.electronAPI.loadTheme();
  ThemeObj.theme.forEach(obj => {
    let elementId = Object.keys(obj)[0];
    let elementValue = obj[Object.keys(obj)[0]];

    if(elementId === "dont-Smooth-transition-between-pages"){
      supressInputEventListener = true;
      if(!parseInt(elementValue)) document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId === "display-scroll-bar"){
      supressInputEventListener = true;
      if(elementValue === "block") document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId === "show-continue-watching-on-home"){
      supressInputEventListener = true;
      if(elementValue === "flex") document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId === "background-gradient-value"){
      document.getElementById(elementId).value = 100 - (parseFloat(elementValue) * 100); // I want the max value to be 25%
    }else{

      let inputColor;
      let alphaValue;

      let inputElement = document.getElementById(elementId);

      if(elementValue.split(",").length === 4){
        let alphaInputRange = inputElement.parentElement.querySelector(".alphaRangeValue");
        inputColor = elementValue.split(",")[0]+","+elementValue.split(",")[1]+","+elementValue.split(",")[2];
        alphaValue = elementValue.split(",")[3];
        alphaInputRange.value = parseFloat(alphaValue)*100;
      }else{
        inputColor = elementValue;
      }

      inputElement.value = rgbToHex(inputColor);
    }
  });
}

async function loadSettings(){
  SettingsObj = await window.electronAPI.loadSettings();

  // load zoom factor value
  ZoomFactorValue = SettingsObj.PageZoomFactor;
  ZoomFactorInput.value = ZoomFactorValue*50;
  setFloatingZoomFactorDiv(ZoomFactorValue);

  // load Internal player sub settings
  choosenTheme = SettingsObj.Theme;
  SubtitlesOnByDefaultInternal = SettingsObj.TurnOnSubsByDefaultInternal ;
  FontSizeInternal = SettingsObj.SubFontSizeInternal;
  FontFamilyInternal = SettingsObj.SubFontFamilyInternal;
  TextColorInternal = SettingsObj.SubColorInternal;
  BackgroundColorInternal = SettingsObj.SubBackgroundColorInternal;
  OpacityInternal = SettingsObj.SubBackgroundOpacityLevelInternal;

  MpvExecPath = SettingsObj?.MpvExecPath ?? "";

  supressInputEventListener = true;
  if(SubtitlesOnByDefaultInternal) toggleButtonInternal.click();
  supressInputEventListener = false;

  FontSizeInternalInput.value = FontSizeInternal+"px";
  backgroundOpacityInternalInput.value = OpacityInternal+"%";
  CurrentFontInternal.innerText = FontFamilyInternal;
  inputTextColorInternal.value = TextColorInternal;
  inputBackgroundColorInternal.value = BackgroundColorInternal;

  inputMpvExecPath.value = MpvExecPath;
  applySelectedColor(ColorInputsWithAlphaValue)

  RightmiddleDiv.classList.add("activate");
}

async function loadExternalSubConfigs(){
  subConfigObj = await window.electronAPI.loadSubConfig();

  SubtitlesOnByDefaultExternal = !subConfigObj["no-sub"] ;
  FontSizeExternal = parseInt(subConfigObj["sub-font-size"]);
  FontFamily = subConfigObj["sub-font"].replaceAll('"',"");
  TextColor = subConfigObj["sub-color"].replaceAll('"',"");;

  supressInputEventListener = true;
  if(SubtitlesOnByDefaultExternal) toggleButtonExternal.click();
  supressInputEventListener = false;

  FontSizeExternalInput.value = FontSizeExternal+"px";
  CurrentFontExternal.innerText = FontFamily;
  inputTextColorExternal.value = TextColor;
  applySelectedColor(ColorInputsWithAlphaValue)
}

function getThemeConfig(){
  let ThemeObjs = {theme:[]};
  let ThemeSettingsInputElements = document.querySelectorAll('#themeTable input[type="color"]');
  let SmoothTransition =  document.getElementById("dont-Smooth-transition-between-pages");
  let DisplayScrollBar = document.getElementById("display-scroll-bar");
  let ShowContinueWatchingOnHome = document.getElementById("show-continue-watching-on-home");
  let backgroundGradientValue = document.getElementById("background-gradient-value");

  ThemeObjs.theme.push({"--dont-Smooth-transition-between-pages":SmoothTransition.checked?0:1});
  ThemeObjs.theme.push({"--display-scroll-bar":DisplayScrollBar.checked?"block":"none"});
  ThemeObjs.theme.push({"--show-continue-watching-on-home":ShowContinueWatchingOnHome.checked?"flex":"none"});
  ThemeObjs.theme.push({"--background-gradient-value":(100-backgroundGradientValue.value)/100});

  ThemeSettingsInputElements.forEach(input => {
    let colorValue = [...hexToRgb(input.value)];
    let inputParent = input.parentElement;
    let alphaRangeElement = inputParent.getElementsByClassName("alphaRangeValue")[0];
    if(alphaRangeElement &&  alphaRangeElement.id != "background-gradient-value") colorValue.push(alphaRangeElement.value/100);
    let rgbaColor = colorValue.join(",");
    ThemeObjs.theme.push({["--"+input.id]:rgbaColor});
  })
  return ThemeObjs;
}

function getSettings(){
  return{
    PageZoomFactor: ZoomFactorValue,
    Theme: choosenTheme,
    TurnOnSubsByDefaultInternal: SubtitlesOnByDefaultInternal,
    SubFontSizeInternal: FontSizeInternal,
    SubFontFamilyInternal: FontFamilyInternal,
    SubColorInternal: TextColorInternal,
    SubBackgroundColorInternal: BackgroundColorInternal,
    SubBackgroundOpacityLevelInternal: OpacityInternal,
    MpvExecPath: MpvExecPath
  }
}

function getSubConfig(){
  return {
    "no-sub": !SubtitlesOnByDefaultExternal,
    "sub-font-size": FontSizeExternal,
    "sub-font": '"'+FontFamilyExternal+'"',
    "sub-color": '"'+TextColorExternal+'"',
  }
}

function setFloatingZoomFactorDiv(value) {
  let bubble = document.querySelector('output[for="foo"]');
  bubble.innerHTML = Math.round(value * 100) + " %";
  let marginLeft = 120;
  let min = 0;
  let max = 2;

  let percent = (value - min) / (max - min);

  let inputBarSize = ZoomFactorInput.offsetWidth;

  let newLeft = percent * inputBarSize;

  bubble.style.left = marginLeft+newLeft + "px";
}

function rgbToHex(rgb){
  let parts = rgb.split(",").map(Number);
  return "#" + parts.map(x => x.toString(16).padStart(2,"0")).join("");
}

function hexToRgb(hex){
  let HexadisimalColor = parseInt(hex.replace("#",""),16);
  let r = (HexadisimalColor >> 16) & 0xff;
  let g = (HexadisimalColor >> 8) & 0xff;
  let b = (HexadisimalColor) & 0xff;
  return [r,g,b];
}

function changeColorOfInputElement(input){
  let ouputElement = input.parentElement.querySelector("input[type='range']");
  let rgbaColor = hexToRgb(input.value);
  let startingColor = `rgba(${rgbaColor[0]},${rgbaColor[1]},${rgbaColor[2]},0)`;
  let endingColor = `rgba(${rgbaColor[0]},${rgbaColor[1]},${rgbaColor[2]},1)`;
  ouputElement.style.background = `linear-gradient(to right, ${startingColor}, ${endingColor}), url("../../../assets/transparentBg.png")`;
}

function applySelectedColor(inputElements){
  inputElements.forEach(element => {
    changeColorOfInputElement(element)
  });
};

(function(){
  let alphaInputs = document.querySelectorAll(".alphaRangeValue");
  alphaInputs.forEach(inputelement => {
    let ouputElement = inputelement.parentElement.querySelector("output[class='alphaValueFloatingDiv']");
    inputelement.addEventListener("input", () => {
      let position = inputelement.offsetWidth * (inputelement.value / 100);
      ouputElement.style.left = position + "px";
      ouputElement.innerHTML = `<span style="font-size:13px;white-space:nowrap;background-color:rgba(0,0,0,0)">alpha: ${inputelement.value}%</span>`;
      ouputElement.style.opacity = 1;
    });
    inputelement.addEventListener("mouseenter", () => {
      let position = inputelement.offsetWidth * (inputelement.value / 100);
      ouputElement.style.left = position + "px";
      ouputElement.innerHTML = `<span style="font-size:13px;white-space:nowrap;background-color:rgba(0,0,0,0)">alpha: ${inputelement.value}%</span>`;
      ouputElement.style.opacity = 1;
    });
    inputelement.addEventListener("mouseleave", () => {
      ouputElement.style.opacity = 0;
    });
  });
})();

// Internal Player related functions

function commitFontSizeInternal(){
  let formatedValue = Number(FontSizeInternalInput.value.toString().replaceAll("px",""));
  if(!isNaN(formatedValue)){
    FontSizeInternal = Math.max(0,Math.min(formatedValue,100)); 
  }
  FontSizeInternalInput.value = FontSizeInternal+"px";
  FontSizeInternalInput.blur();
  somethingChanged = true;
}

function commitBgOpacityInternal(){
  let formatedValue = Number(backgroundOpacityInternalInput.value.toString().replaceAll("%",""));
  if(!isNaN(formatedValue)){
    OpacityInternal = Math.max(0,Math.min(formatedValue,100)); 
  }
  backgroundOpacityInternalInput.value = OpacityInternal+"%";
  backgroundOpacityInternalInput.blur();
  somethingChanged = true;
}

// External Player related functions

function commitFontSizeExternal(){
  let formatedValue = Number(FontSizeExternalInput.value.toString().replaceAll("px",""));
  if(!isNaN(formatedValue)){
    FontSizeExternal = Math.max(0,Math.min(formatedValue,100)); 
  }
  FontSizeExternalInput.value = FontSizeExternal+"px";
  FontSizeExternalInput.blur();
  somethingChanged = true;
}

// calling functions
addSmoothTransition();
loadTheme();
loadSettings();
loadExternalSubConfigs();
loadApiKeys();
setupKeyPressesHandler();
setLeftButtonStyle("btn-settings");
loadIconsDynamically();
handlingMiddleRightDivResizing();

window.addEventListener("keydown",(event)=>{
  if(event.key === "Enter"){
    ApplyButton.click();
  }
});

document.querySelectorAll(".edit-btn").forEach(btn => {
  btn.innerHTML = editIcon;
  btn.addEventListener("click", (event) => {
    const parent = event.target.parentElement;
    const keyInput = parent.querySelector(".api-key-input");
    keyInput.readOnly = !keyInput.readOnly;
    btn.innerHTML = 
      keyInput.readOnly 
      ? editIcon 
      : checkIcon;

    keyInput.type = 
      keyInput.type === "password" 
      ? "text" 
      : "password";
  });
});

document.querySelectorAll(".verify-btn").forEach(btn => {
  btn.addEventListener("click", async(event) => {
    const parent = event.target.parentElement.parentElement;
    const keyInput = parent.querySelector(".api-key-input");
    const responseMessageP  = parent.querySelector(".response-message-p");

    if(keyInput?.value.trim() === "") return;
    btn.classList.add("loading");

    const res = 
      keyInput.classList.contains("tmdb") 
        ? await window.electronAPI.validateTMDBApiKey(keyInput?.value)
      : keyInput.classList.contains("wyzie")
        ? await window.electronAPI.validateWyzieApiKey(keyInput?.value)
        : null;

    btn.classList.remove("loading");

    if(res.response === "api-key-valid") {
      if (keyInput.classList.contains("tmdb")) TMDB_API_KEY = keyInput.value;
      else if (keyInput.classList.contains("wyzie")) Wyzie_API_KEY = keyInput.value;

      btn.classList.add("success");
      setTimeout(() => {
        btn.classList.remove("success");
      },1000);
      somethingChanged = true;
    } else {
      btn.classList.add("failed");
      responseMessageP.innerText = 
        res.response === "api-key-not-valid" 
          ? "Invalid API key"
        : res.response === "no-internet-connection"
          ? "No internet connection"
        : "Something Went Wrong";

      responseMessageP.style.opacity = "1";
      setTimeout(() => {
        btn.classList.remove("failed");
        responseMessageP.style.opacity = "0";
      },1500);
    }
  });
});

document.querySelectorAll(".link-btn").forEach(btn => {
  btn.addEventListener("click",() => {
    const URL = 
      btn.id === "tmdb-get-key"
        ? "https://developer.themoviedb.org/docs/getting-started"
        : "https://sub.wyzie.io/redeem"

    window.electronAPI.openExternalLink(URL);
  });
});
