let RightmiddleDiv = document.getElementById("div-middle-right");
let ZoomFactorInput = document.getElementById("input-ZoomFactor");
let toggleButton = document.getElementById("toggleDefaultSubtitles");

let increaseFontSizeButton = document.getElementById("btn-increaseFontSize"); 
let FontSizeInput = document.getElementById("p-fontSize");
let decreaseFontSizeButton = document.getElementById("btn-decreaseFontSize"); 

let CurrentFont = document.getElementById("currrectFont");
let DropDownFontMenu = document.getElementById("dropDownMenu-Font");

let inputTextColor = document.getElementById("input-TextColor");

let ColorInputsWithAlphaValue = document.querySelectorAll('.ElementsTopOfEachOther input[type="color"]');

let ApplyButton = document.getElementById("btn-applySettings");

let ZoomFactorValue=1;
let SubtitlesOnByDefault = false;
let FontSize = 24;
let FontFamily = "monospace";
let TextColor = "white";

RightmiddleDiv.style.opacity = 1;

let SettingsObj;
let ThemeObj;
let subConfigObj;

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
  console.log(FontSize);
  FontSizeInput.value = FontSize+"px";
});

decreaseFontSizeButton.addEventListener("click",()=>{
  if(FontSize > 0) FontSize -= 1;
  FontSizeInput.value = FontSize+"px";
});

DropDownFontMenu.addEventListener("mousedown",(event)=>{
  FontFamily = event.target.innerText;
  CurrentFont.innerText = FontFamily;
});

inputTextColor.addEventListener("input",(event)=>{
  TextColor = inputTextColor.value;
});

FontSizeInput.addEventListener("blur",(event) => {commitFontSize()});
FontSizeInput.addEventListener("keypress",(event) => {
  if(event.key == "Enter")
    commitFontSize()
});

ApplyButton.addEventListener("click",()=>{
  SettingsObj = getSettings();
  ThemeObj = getThemeConfig();
  SubConfigObj = getSubConfig();

  window.electronAPI.applySettings(SettingsObj);
  window.electronAPI.applyTheme(ThemeObj);
  window.electronAPI.applySubConfig(SubConfigObj);

  window.location.reload()
  setFloatingZoomFactorDiv(ZoomFactorInput.value);
});

async function loadTheme(){
  ThemeObj = await window.electronAPI.loadTheme();
  ThemeObj.theme.forEach(obj => {
    let elementId = Object.keys(obj)[0];
    let elementValue = obj[Object.keys(obj)[0]];

    if(elementId == "dont-Smooth-transition-between-pages"){
      if(!parseInt(elementValue)) document.getElementById(elementId).click();
    }
    if(elementId == "display-scroll-bar"){
      if(elementValue == "block") document.getElementById(elementId).click();
    }
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
  });
}

function commitFontSize(){
  let formatedValue = Number(FontSizeInput.value.toString().replaceAll("px",""));
  console.log(FontSize);
  if(!isNaN(formatedValue)){
    FontSize = Math.max(0,Math.min(formatedValue,100)); 
  }
  FontSizeInput.value = FontSize+"px";
  FontSizeInput.blur();
}

function rgbToHex(rgb){
  let parts = rgb.split(",").map(Number);
  return "#" + parts.map(x => x.toString(16).padStart(2,"0")).join("");
}

async function loadSettings(){
  SettingsObj = await window.electronAPI.loadSettings();

  ZoomFactorValue = SettingsObj.PageZoomFactor;

  ZoomFactorInput.value =   ZoomFactorValue*50;
  setFloatingZoomFactorDiv(ZoomFactorValue);
}

async function loadSubConfigs(){
  subConfigObj = await window.electronAPI.loadSubConfig();

  SubtitlesOnByDefault = !subConfigObj["no-sub"] ;
  FontSize = parseInt(subConfigObj["sub-font-size"]);
  FontFamily = subConfigObj["sub-font"].replaceAll('"',"");
  TextColor = subConfigObj["sub-color"].replaceAll('"',"");;

  if(SubtitlesOnByDefault) toggleButton.click();
  FontSizeInput.value = FontSize+"px";
  CurrentFont.innerText = FontFamily;
  inputTextColor.value = TextColor;
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

function getSettings(){
  return {
    PageZoomFactor: ZoomFactorValue,
  }
}

function getThemeConfig(){
  let ThemeObjs = {theme:[]};
  let ThemeSettingsInputElements = document.querySelectorAll('#themeTable input[type="color"]');
  let SmoothTransition =  document.getElementById("dont-Smooth-transition-between-pages");
  let DisplayScrollBar = document.getElementById("display-scroll-bar");

  ThemeObjs.theme.push({"--dont-Smooth-transition-between-pages":SmoothTransition.checked?0:1});
  ThemeObjs.theme.push({"--display-scroll-bar":DisplayScrollBar.checked?"block":"none"});

  ThemeSettingsInputElements.forEach(input => {
    let colorValue = [...hexToRgb(input.value)];
    let inputParent = input.parentElement;
    let alphaRangeElement = inputParent.getElementsByClassName("alphaRangeValue")[0];
    if(alphaRangeElement) colorValue.push(alphaRangeElement.value/100);
    let rgbaColor = colorValue.join(",");
    ThemeObjs.theme.push({["--"+input.id]:rgbaColor});
  })
  return ThemeObjs;
}

function getSubConfig(){
  return {
    "no-sub": !SubtitlesOnByDefault,
    "sub-font-size": FontSize,
    "sub-font": '"'+FontFamily+'"',
    "sub-color": '"'+TextColor+'"',
  }
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

loadSubConfigs();

setupKeyPressesHandler();

setLeftButtonStyle("btn-settings");
loadIconsDynamically();
