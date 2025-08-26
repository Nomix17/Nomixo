let RightmiddleDiv = document.getElementById("div-middle-right");
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

let ColorInputsWithAlphaValue = document.querySelectorAll('.ElementsTopOfEachOther input[type="color"]');

let ApplyButton = document.getElementById("btn-applySettings");

let ZoomFactorValue=1;
let SubtitlesOnByDefault = false;
let FontSize = 100;
let FontFamily = "monospace";
let TextColor = "white";
let BackgroundColor ="black";
let Opacity = 0;
let choosenTheme;

RightmiddleDiv.style.opacity = 1;

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
    Theme: choosenTheme,
    TurnOnSubsByDefault: SubtitlesOnByDefault,
    SubFontSize: FontSize,
    SubFontFamily: FontFamily,
    SubColor: TextColor,
    SubBackgroundColor: BackgroundColor,
    SubBackgroundOpacityLevel: Opacity
  }

  let ThemeObj = getThemeSettings();
  window.electronAPI.applySettings(SettingsObj);
  window.electronAPI.applyTheme(ThemeObj);
  window.location.reload()
  setFloatingZoomFactorDiv(ZoomFactorInput.value);
});

async function loadTheme(){
  let ThemeObj = await window.electronAPI.loadTheme();
  ThemeObj.theme.forEach(obj => {
  //   if(elementId != 
    let elementId = Object.keys(obj)[0];
    let elementValue = obj[Object.keys(obj)[0]];

    if(elementId == "dont-Smooth-transition-between-pages"){
      if(!parseInt(elementValue)) document.getElementById("dont-Smooth-transition-between-pages").click();
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

function rgbToHex(rgb){
  let parts = rgb.split(",").map(Number);
  return "#" + parts.map(x => x.toString(16).padStart(2,"0")).join("");
}


async function loadSettings(){
  SettingsObj = await window.electronAPI.loadSettings();

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
  if(SubtitlesOnByDefault) toggleButton.click();
  FontSizePara.innerText = FontSize+"%";
  CurrentFont.innerText = FontFamily;
  inputTextColor.value = TextColor;
  inputBackgroundColor.value = BackgroundColor;
  applySelectedColor(ColorInputsWithAlphaValue)
  OpacityPara.innerText = Opacity+"%";
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
  ThemeObjs.theme.push({"--dont-Smooth-transition-between-pages":SmoothTransition.checked?0:1});
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
