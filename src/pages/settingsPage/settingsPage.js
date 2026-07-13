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
const DropDownFontMenuInternal = document.getElementById("dropDownMenu-Font-Internal");
const inputTextColorInternal = document.getElementById("input-TextColorInternal");
const inputBackgroundColorInternal = document.getElementById("input-BackgroundColorInternal");

//External Player
const toggleButtonExternal = document.getElementById("toggleDefaultSubtitlesExternal");
const increaseFontSizeExternalButton = document.getElementById("btn-increaseFontSizeExternal"); 
const FontSizeExternalInput = document.getElementById("p-fontSizeExternal");
const decreaseFontSizeExternalButton = document.getElementById("btn-decreaseFontSizeExternal"); 
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
let CurrentTheme;

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

const addCustomThemeBtn = document.getElementById("btn-addCustomTheme");
addCustomThemeBtn.addEventListener("click", async () => {
  await loadCurrentTheme();
  applySelectedColor(ColorInputsWithAlphaValue);
  document.getElementById("theme-overlay").classList.add("active");
});

const newThemeNameInput = document.getElementById("theme-title");
newThemeNameInput.addEventListener("input", () => {
  newThemeNameInput.classList.remove("error-shake");
});

const saveNewThemeBtn = document.querySelector(".save-new-theme-btn");
saveNewThemeBtn.addEventListener("click", async () => {

  const shakeNewThemeInput = () => {
    newThemeNameInput.focus();
    newThemeNameInput.classList.add("error-shake");
    setTimeout(() => {
      newThemeNameInput.classList.remove("error-shake");
    },300);
  }

  const newThemeName = newThemeNameInput?.value;
  if(newThemeName == null || newThemeName.trim() == "") {
    shakeNewThemeInput();
    return;
  }
  const newThemeObj = getNewTheme();
  const res = await window.electronAPI.createPreparedTheme(newThemeName, newThemeObj);

  if(!res.success) {
    shakeNewThemeInput();
    displayMessage(res.message);
    return;
  }
  
  const container = document.querySelector(".prepared-themes-div");
  const newCard = await createThemeCard(newThemeName, res.theme_file_path);
  container.appendChild(newCard);
  selectThemeCard(newCard);

  document.getElementById('cssThemeStylesheet').href = 'theme://theme.css?' + Date.now();
  displayMessage("new theme was saved.");
  document.getElementById("theme-overlay").classList.remove("active");
});

const closeNewThemeDiv = document.querySelector("#details-customizeTheme .floating-x-remove-btn");
closeNewThemeDiv.addEventListener("click", () => {
  document.getElementById("theme-overlay").classList.remove("active");
});

ApplyButton.addEventListener("click",()=> {
  let SettingsObj = getSettings();
  let SubConfigObj = getSubConfig();
  
  if(somethingChanged){
    window.electronAPI.applySettings(SettingsObj);
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

DropDownFontMenuInternal.addEventListener("dropdownChange",(event)=>{
  FontFamilyInternal = event.detail.value;
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

DropDownFontMenuExternal.addEventListener("dropdownChange",(event)=>{
  FontFamilyExternal = event.detail.value;
  somethingChanged = true;
});

inputTextColorExternal.addEventListener("input",(event)=>{
  TextColorExternal = inputTextColorExternal.value;
  somethingChanged = true;
});

inputMpvExecPath.addEventListener("input", (event) => {
  MpvExecPath = inputMpvExecPath.value;
  somethingChanged = true;
});

FontSizeExternalInput.addEventListener("blur",(event) => {commitFontSizeExternal()});
FontSizeExternalInput.addEventListener("keypress",(event) => {
  if(event.key === "Enter")
    commitFontSizeExternal()
});

// global Functions 

async function loadCurrentTheme(){
  let ThemeObj = await window.electronAPI.loadTheme();
  ThemeObj.theme.forEach(obj => {
    let elementId = Object.keys(obj)[0];
    let elementValue = obj[Object.keys(obj)[0]];

    if(elementId === "background-gradient-value"){
      document.getElementById(elementId).value = 100 - (parseFloat(elementValue) * 100); // I want the max value to be 25%
    }else{

      let inputColor;
      let alphaValue;

      let inputElement = document.getElementById(elementId);

      try {
        if(elementValue.split(",").length === 4){
            let alphaInputRange = inputElement.parentElement.querySelector(".alphaRangeValue");
            inputColor = elementValue.split(",")[0]+","+elementValue.split(",")[1]+","+elementValue.split(",")[2];
            alphaValue = elementValue.split(",")[3];
            alphaInputRange.value = parseFloat(alphaValue)*100;
        }else{
          inputColor = elementValue;
        }
        inputElement.value = rgbToHex(inputColor);
      } catch (err) {
        console.error(err.message);
      }
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
  CurrentTheme = SettingsObj.CurrentTheme;
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
  setDropdownValue(DropDownFontMenuInternal, FontFamilyInternal);
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
  setDropdownValue(DropDownFontMenuExternal, FontFamily);
  inputTextColorExternal.value = TextColor;
  applySelectedColor(ColorInputsWithAlphaValue)
}

function getNewTheme() {
  let ThemeObjs = {theme:[]};
  let ThemeSettingsInputElements = document.querySelectorAll('#details-customizeTheme input[type="color"]');
  let backgroundGradientValue = document.getElementById("background-gradient-value");
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
    CurrentTheme: CurrentTheme,
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

async function fetchSVGMarkup() {
  const svgPath = "../../../assets/cardTheme.svg";
  const res = await fetch(svgPath);
  if (!res.ok) {
    console.error(`Failed to load SVG at ${svgPath}`, res.status);
    return "";
  }
  return res.text();
}

async function extractThemeVars(cssPath) {
  const res = await fetch(cssPath);
  if (!res.ok) {
    console.error(`Failed to load theme CSS at ${cssPath}`, res.status);
    return [];
  }
  const css = await res.text();
  return css.match(/--[\w-]+\s*:\s*[^;]+/g) || [];
}

function selectThemeCard(card) {
  document.querySelectorAll(".card")
    .forEach(el => el.classList.remove("selected"));
  card.classList.add("selected");
}

const SVGThemeMarkupPromise = fetchSVGMarkup();
async function createThemeCard(themeName, themePath, isDefault = false) {
  const svgMarkup = await SVGThemeMarkupPromise;
  const vars = await extractThemeVars(themePath);

  const card = document.createElement("div");
  const cardTitle = document.createElement("p");

  const label = themeName.replaceAll(/_/g, " ");
  cardTitle.innerText = label.charAt(0).toUpperCase() + label.slice(1);

  card.classList.add("card");
  card.setAttribute("card-file-name", themeName);
  card.appendChild(cardTitle);
  card.insertAdjacentHTML("beforeend", svgMarkup);

  card.classList.toggle("selected", CurrentTheme === themeName);
  vars.forEach(decl => {
    const [name, value] = decl.split(/:(.+)/).map(s => s.trim());
    card.style.setProperty(name, value);
  });

  if(!isDefault) createThemeCardRemovingBtn(card, themeName, themePath);
  addCardEventListener(card);
  return card;
}

function createThemeCardRemovingBtn(cardEl, themeName, themePath) {
  const removeBtn = document.createElement('button');
  removeBtn.classList.add('floating-x-remove-btn');
  removeBtn.innerHTML = xRemoveIcon;
  
  removeBtn.addEventListener('click', async(event) => {
    event.stopPropagation();
    event.stopImmediatePropagation();
    createRemoveThemeConfirmationPopup(cardEl, themeName, themePath);
  });

  cardEl.appendChild(removeBtn);
}

function createRemoveThemeConfirmationPopup(cardEl, themeName, themePath) {
  const overlay = document.getElementById('deleteOverlay');
  const deleteMsg = overlay.querySelector('.delete-msg');
  const closeBtn = document.getElementById('closeBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  deleteMsg.textContent = `Are you sure you want to delete the theme "${themeName}"?`;

  overlay.classList.add('active');
  overlay.style.display = 'flex';

  [cancelBtn, closeBtn].forEach(el => {
    el.addEventListener('click', function () {
      overlay.classList.remove('active');
    })
  });

  deleteBtn.addEventListener('click', async function () {
    await window.electronAPI.removePreparedTheme(themePath);
    overlay.classList.remove('active');
    cardEl.remove();
  });
}

function addCardEventListener(cardEl) {
  cardEl.addEventListener("click", async () => {
    const themefileName = cardEl.getAttribute("card-file-name");
    await window.electronAPI.applyPreparedTheme(themefileName);
    CurrentTheme = themefileName;
    // setTimeout(() => {
      document.getElementById('cssThemeStylesheet').href = 'theme://theme.css?' + Date.now();
    // },100);
    selectThemeCard(document.querySelector(`[card-file-name="${themefileName}"]`));
  });
}

async function renderPreparedThemeCards() {
  const themesFiles = await window.electronAPI.getPreparedThemes();
  const container = document.querySelector(".prepared-themes-div");
  container.innerHTML = "";

  const cards = await Promise.all(
    themesFiles.map(
      (themeFile) =>
        createThemeCard(themeFile.name, themeFile.path, themeFile.isDefault)
    )
  );

  const defaultIndex = themesFiles.findIndex(themeFile => themeFile.name.toLowerCase() == "default");
  if (defaultIndex !== -1) {
    const [defaultCard] = cards.splice(defaultIndex, 1);
    cards.unshift(defaultCard);
  }

  cards.forEach(card => container.appendChild(card));
}

document.querySelectorAll(".edit-btn").forEach(btn => {
  btn.innerHTML = editIcon;
  btn.addEventListener("click", () => {
    const parent = btn.closest(".input-wrapper");
    const keyInput = parent.querySelector(".api-key-input");
    keyInput.readOnly = !keyInput.readOnly;
    btn.innerHTML = keyInput.readOnly ? editIcon : checkIcon;
    keyInput.type = keyInput.type === "password" ? "text" : "password";
  });
});

document.querySelector(".browse-btn")
.addEventListener("click", async (event) => {
  const execPath = await window.electronAPI.openFile_FileSystemBrowser(inputMpvExecPath.value);
  if(execPath) {
    inputMpvExecPath.value = execPath;
    MpvExecPath = execPath;
  }
  somethingChanged = true;
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

// calling functions
loadCurrentTheme();
loadExternalSubConfigs();
loadApiKeys();
setupKeyPressesHandler();
setLeftButtonStyle("btn-settings");
loadIconsDynamically();
handlingMiddleRightDivResizing();
dropDownInit();
initBackupSection();
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSettings();
    renderPreparedThemeCards();
  } catch (error) {
    console.error("Failed to initialize app settings:", error);
  }
});

async function initBackupSection() {
  const closeImportConfirmBtn = document.querySelector("#import-confirm-overlay .floating-x-remove-btn");
  closeImportConfirmBtn.innerHTML = xRemoveIcon;
}

const importBtn = document.getElementById("btn-importLibrary");
importBtn.addEventListener("click", async () => {
  const libElements = await window.electronAPI.loadMediaLibraryInfo();
  const libraryCountEl = document.getElementById("p-current-library-count");
  libraryCountEl.innerText = `Your current library has ${libElements ? libElements.length : 0} titles.`;

  const mergeRadioInput = document.getElementById("radio-merge");
  mergeRadioInput.checked = true;

  const overlay = document.getElementById("import-confirm-overlay");
  overlay.classList.add("active");
});

const exportBtn = document.getElementById("btn-exportLibrary");
exportBtn.addEventListener("click", async () => {
  const exported = await window.electronAPI.exportLibrary();
  if(exported)
    displayMessage("Library was exported.");
});

const confirmImportBtn = document.getElementById("confirmImportBtn");
confirmImportBtn.addEventListener("click", async() => {
  const mergeRadioInput = document.getElementById("radio-merge");
  const imported = await window.electronAPI.importLibrary(mergeRadioInput.checked);
  if(!imported) return;
  const overlay = document.getElementById("import-confirm-overlay");
  overlay.classList.remove("active");
  displayMessage("Library was imported.");
});

const closeOverlayBtn = document.querySelector("#import-confirm-overlay #cancelBtn");
const closeImportConfirmBtn = document.querySelector("#import-confirm-overlay .floating-x-remove-btn");
[closeOverlayBtn, closeImportConfirmBtn].forEach(el => {
  el.addEventListener("click", () => {
    const overlay = document.getElementById("import-confirm-overlay");
    overlay.classList.remove("active");
  });
});
