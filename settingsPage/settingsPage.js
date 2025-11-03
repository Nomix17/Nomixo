let RightmiddleDiv = document.getElementById("div-middle-right");
let ZoomFactorInput = document.getElementById("input-ZoomFactor");
let toggleButton = document.getElementById("toggleDefaultSubtitles");

let increaseFontSizeButton = document.getElementById("btn-increaseFontSize"); 
let FontSizeInput = document.getElementById("p-fontSize");
let decreaseFontSizeButton = document.getElementById("btn-decreaseFontSize"); 

let increaseBackgroundOpacityButton = document.getElementById("btn-increaseOpacity"); 
let backgroundOpacityInput = document.getElementById("p-Opacity");
let decreaseBackgroundOpacityButton = document.getElementById("btn-decreaseOpacity"); 

let CurrentFont = document.getElementById("currrectFont");
let DropDownFontMenu = document.getElementById("dropDownMenu-Font");

let inputTextColor = document.getElementById("input-TextColor");

let inputBackgroundColor = document.getElementById("input-BackgroundColor");

let ColorInputsWithAlphaValue = document.querySelectorAll('.ElementsTopOfEachOther input[type="color"]');

let ApplyButton = document.getElementById("btn-applySettings");

let somethingChanged = false;

let ZoomFactorValue=1;
let SubtitlesOnByDefault = false;
let FontSize = 100;
let FontFamily = "monospace";
let TextColor = "white";
let BackgroundColor ="black";
let Opacity = 0;
let choosenTheme;

RightmiddleDiv.style.opacity = 1;


document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("input").forEach(inputElement=>{
    inputElement.addEventListener("change", ()=>{
      if(!supressInputEventListener){
        somethingChanged = true;
      }
    });
  });
});

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

toggleButton.addEventListener("change",()=>{
  SubtitlesOnByDefault = toggleButton.checked;
});

increaseFontSizeButton.addEventListener("click",()=>{
  if(FontSize < 100) FontSize += 1;
  FontSizeInput.value = FontSize+"px";
  somethingChanged = true;
});

decreaseFontSizeButton.addEventListener("click",()=>{
  if(FontSize > 0) FontSize -= 1;
  FontSizeInput.value = FontSize+"px";
  somethingChanged = true;
});

increaseBackgroundOpacityButton.addEventListener("click",()=>{
  if(Opacity < 100) Opacity += 5;
  backgroundOpacityInput.value = Opacity+"%";
  somethingChanged = true;
});

decreaseBackgroundOpacityButton.addEventListener("click",()=>{
  if(Opacity > 0) Opacity -= 5;
  backgroundOpacityInput.value = Opacity+"%";
  somethingChanged = true;
});

DropDownFontMenu.addEventListener("mousedown",(event)=>{
  FontFamily = event.target.innerText;
  CurrentFont.innerText = FontFamily;
  somethingChanged = true;
});

inputTextColor.addEventListener("input",(event)=>{
  TextColor = inputTextColor.value;
});

inputBackgroundColor.addEventListener("input",(event)=>{
  BackgroundColor = inputBackgroundColor.value;
});

FontSizeInput.addEventListener("blur",(event) => {commitFontSize()});
FontSizeInput.addEventListener("keypress",(event) => {
  if(event.key == "Enter")
    commitFontSize()
});

backgroundOpacityInput.addEventListener("blur",(event) => {commitBgOpacity()});
backgroundOpacityInput.addEventListener("keypress",(event) => {
  if(event.key == "Enter")
    commitBgOpacity()
});

ApplyButton.addEventListener("click",()=>{
  let SettingsObj = {
    PageZoomFactor: ZoomFactorValue,
    Theme: choosenTheme,
    TurnOnSubsByDefault: SubtitlesOnByDefault,
    SubFontSize: FontSize,
    SubFontFamily: FontFamily,
    SubColor: TextColor,
    SubBackgroundColor: BackgroundColor,
    SubBackgroundOpacityLevel: Opacity
  }

  let ThemeObj = getThemeSettings();
  
  if(somethingChanged){
    window.electronAPI.applySettings(SettingsObj);
    window.electronAPI.applyTheme(ThemeObj);
    document.getElementById('test').href = 'theme://theme.css?' + Date.now();
    displayMessage("new settings were saved.");
    somethingChanged = false;
  }
});

async function loadTheme(){
  let ThemeObj = await window.electronAPI.loadTheme();
  ThemeObj.theme.forEach(obj => {
    let elementId = Object.keys(obj)[0];
    let elementValue = obj[Object.keys(obj)[0]];

    if(elementId == "dont-Smooth-transition-between-pages"){
      supressInputEventListener = true;
      if(!parseInt(elementValue)) document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId == "display-scroll-bar"){
      supressInputEventListener = true;
      if(elementValue == "block") document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId == "show-continue-watching-on-home"){
      supressInputEventListener = true;
      if(elementValue == "flex") document.getElementById(elementId).click();
      supressInputEventListener = false;
    }
    else if(elementId == "background-gradient-value"){
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


function commitFontSize(){
  let formatedValue = Number(FontSizeInput.value.toString().replaceAll("px",""));
  if(!isNaN(formatedValue)){
    FontSize = Math.max(0,Math.min(formatedValue,100)); 
  }
  FontSizeInput.value = FontSize+"px";
  FontSizeInput.blur();
  somethingChanged = true;
}

function commitBgOpacity(){
  let formatedValue = Number(backgroundOpacityInput.value.toString().replaceAll("%",""));
  if(!isNaN(formatedValue)){
    Opacity = Math.max(0,Math.min(formatedValue,100)); 
  }
  backgroundOpacityInput.value = Opacity+"%";
  backgroundOpacityInput.blur();
  somethingChanged = true;
}

function rgbToHex(rgb){
  let parts = rgb.split(",").map(Number);
  return "#" + parts.map(x => x.toString(16).padStart(2,"0")).join("");
}

async function loadSettings(){
  SettingsObj = await window.electronAPI.loadSettings();
  oldSettings = SettingsObj;

  ZoomFactorValue = SettingsObj.PageZoomFactor;
  choosenTheme = SettingsObj.Theme;
  SubtitlesOnByDefault = SettingsObj.TurnOnSubsByDefault ;
  FontSize = SettingsObj.SubFontSize;
  FontFamily = SettingsObj.SubFontFamily;
  TextColor = SettingsObj.SubColor;
  BackgroundColor = SettingsObj.SubBackgroundColor;
  Opacity = SettingsObj.SubBackgroundOpacityLevel;

  ZoomFactorInput.value =   ZoomFactorValue*50;
  setFloatingZoomFactorDiv(ZoomFactorValue);
  
  supressInputEventListener = true;
  if(SubtitlesOnByDefault) toggleButton.click();
  supressInputEventListener = false;
  FontSizeInput.value = FontSize+"px";
  backgroundOpacityInput.value = Opacity+"%";
  CurrentFont.innerText = FontFamily;
  inputTextColor.value = TextColor;
  inputBackgroundColor.value = BackgroundColor;
  applySelectedColor(ColorInputsWithAlphaValue)
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

function hexToRgb(hex){
  let HexadisimalColor = parseInt(hex.replace("#",""),16);
  let r = (HexadisimalColor >> 16) & 0xff;
  let g = (HexadisimalColor >> 8) & 0xff;
  let b = (HexadisimalColor) & 0xff;
  return [r,g,b];
}

function getThemeSettings(){
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

(function(){
  ColorInputsWithAlphaValue.forEach(element => {
    element.addEventListener("input",()=>{
      applySelectedColor(Array(element)); 
    });
  });
})();

function changeColorOfInputElement(input){
  let ouputElement = input.parentElement.querySelector("input[type='range']");
  let rgbaColor = hexToRgb(input.value);
  let startingColor = `rgba(${rgbaColor[0]},${rgbaColor[1]},${rgbaColor[2]},0)`;
  let endingColor = `rgba(${rgbaColor[0]},${rgbaColor[1]},${rgbaColor[2]},1)`;
  ouputElement.style.background = `linear-gradient(to right, ${startingColor}, ${endingColor}), url("../cache/transparentBg.png")`;
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
      ouputElement.style.left = 20+inputelement.offsetWidth*(inputelement.value/100);
      ouputElement.innerHTML = `<span style="font-size:13px;white-space:nowrap;background-color:rgba(0,0,0,0)">alpha: ${inputelement.value}%</span>`;
      ouputElement.style.opacity = 1;
    });
    inputelement.addEventListener("mouseenter", () => {
      ouputElement.style.left = 20+inputelement.offsetWidth*(inputelement.value/100);
      ouputElement.innerHTML = `<span style="font-size:13px;white-space:nowrap;background-color:rgba(0,0,0,0)">alpha: ${inputelement.value}%</span>`;
      ouputElement.style.opacity = 1;
    });
    inputelement.addEventListener("mouseleave", () => {
      ouputElement.style.opacity = 0;
    });
  });
})();


addSmoothTransition();

loadTheme();

loadSettings();

setupKeyPressesHandler();

setLeftButtonStyle("btn-settings");

loadIconsDynamically();

handlingMiddleRightDivResizing();

window.addEventListener("keydown",(event)=>{
  if(event.key == "Enter"){
    ApplyButton.click();
  }
});
