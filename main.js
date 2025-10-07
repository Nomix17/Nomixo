import {BrowserWindow , BaseWindow, BrowserView , app, nativeTheme, ipcMain, protocol} from "electron";
import torrentStream from 'torrent-stream';
import dotenv from "dotenv";
import http from 'http';
import path from "path";
import fs from "fs";
import https from "https";
import os from "os";
import { fileURLToPath} from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __configs = path.join(app.getPath('userData'),"configs");

dotenv.config();

// ======================= PATHS =======================
const SettingsFilePath = path.join(__configs, 'settings.json');
const ThemeFilePath = path.join(__configs, 'Theme.css');
const libraryFilePath = path.join(__configs, "library.json");
const subDirectory="/tmp/tempSubs";

function initializeDataFiles(){
  if(!fs.existsSync(__configs)){
    fs.mkdirSync(__configs, { recursive: true });
  }

  if(!fs.existsSync(SettingsFilePath)){
    let defaultFileData = JSON.stringify(
      {
        "PageZoomFactor": 1,
        "TurnOnSubsByDefault": true,
        "SubFontSize": 16,
        "SubFontFamily": "Montserrat",
        "SubColor": "#ffffff",
        "SubBackgroundColor": "#000000",
        "SubBackgroundOpacityLevel": 0
      }
    );
    fs.writeFileSync(SettingsFilePath,defaultFileData);
  }

  if(!fs.existsSync(ThemeFilePath)){
    let defaultFileData = `
      :root{
      --dont-Smooth-transition-between-pages:0;
      --display-scroll-bar:none;
      --background-gradient-value:0.1;
      --primary-color:0,0,0;
      --secondary-color:64,64,64,0.5;
      --div-containers-borders-color:255,255,255,0;
      --main-buttons-color:0,0,0,0.25;
      --MovieElement-hover-BorderColor:255,255,255;
      --input-backgroundColor:0,0,0,0.25;
      --drop-down-color:0,0,0,1;
      --icon-color:46,46,46;
      --icon-hover-color:189,189,189,0.76;
      --text-color:0,0,0;
      }
    `;
    fs.writeFileSync(ThemeFilePath,defaultFileData);
  }
}

initializeDataFiles();

let win;
let server;
var mainzoomFactor = 1;

nativeTheme.themeSource = "dark";
const createWindow = async () => {
   win = new BrowserWindow({
     width: 1100,
     height: 650,
     show:false,
     webPreferences: {
       preload: path.join(__dirname, 'preload.js'),
       contextIsolation: true,
       nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile("./home/mainPage.html");

  mainzoomFactor = loadSettings().PageZoomFactor;
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(mainzoomFactor);
    win.maximize();
    win.show();
  });

}

var closeWindow = true;

app.on("ready", () =>{
  protocol.handle('theme', async () => {
    const css = await fs.promises.readFile(ThemeFilePath, 'utf8');
    return new Response(css, { headers: { 'content-type': 'text/css' ,'cache-control': 'no-store'} });
  });
  createWindow()
});

app.on("window-all-closed", () => {
  if(closeWindow){
    app.quit();
  }
});

ipcMain.handle("load-settings",() => {
  return new Promise((resolve, reject) => {
    try{
      let settingsObj = loadSettings();
      resolve(settingsObj);
    }catch{
      reject("Something Went Wrong When Loading Settings!");
    }
  });
});

ipcMain.handle("load-theme",()=>{
  return new Promise((resolve,reject) => {
    try{
      let themeObj = loadTheme();
      resolve(themeObj);
    }catch{
      reject("Something Went Wrong When Loading Theme!");
    }
  });
});

ipcMain.handle("apply-settings",(event, SettingsObj) => {
  const webContents = event.sender;
  SettingsObj.PageZoomFactor = Math.max(0.1,SettingsObj.PageZoomFactor);
  mainzoomFactor = SettingsObj.PageZoomFactor;
  webContents.setZoomFactor(SettingsObj.PageZoomFactor);
  fs.writeFile(SettingsFilePath, JSON.stringify(SettingsObj, null, 2), (err) => {console.error(err)});
});

ipcMain.on("apply-theme",(event, ThemeObj) =>{
  let formatedThemeObj = ThemeObj.theme.map(obj=>`${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`);

  let themeFileContent = `:root{
    ${formatedThemeObj.join(";\n")}
  ;}`;

  fs.writeFile(ThemeFilePath,themeFileContent, (err)=>{
    console.error(err)
  });
});

ipcMain.handle("go-back",(event)=>{
  const webContents = event.sender;
  if(webContents.navigationHistory.canGoBack()){
    webContents.navigationHistory.goBack();
  }
});

ipcMain.handle("change-page", (event,page) => {
  if (win) {
    const webContents = event.sender;
    webContents.setZoomFactor(mainzoomFactor);
    const [filePath, query] = page.split('?');
    const fullPath = path.join(__dirname, filePath);
    const url = `file://${fullPath}${query ? '?' + query : ''}`;
    win.loadURL(url);
  }
});

ipcMain.handle("request-fullscreen",()=>{
  if (!win) return undefined;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

ipcMain.handle("get-api-key",()=>{
  return process.env.API_KEY;
});

ipcMain.handle('get-video-url', async (event,magnet) => {
  return new Promise((resolve, reject) => {
    const engine = torrentStream(magnet)

    engine.on('ready', () => {
      const file = engine.files.find(f =>
        (f.name.endsWith('.mp4') ||
         f.name.endsWith('.webm') ||
         f.name.endsWith('.mkv')) && f.length/(10**9) > 0.5 
      )
      if (!file) {
        reject('No video file found in torrent')
        return null;
      }
      let mimeType = file.name.endsWith('.mkv') ? "video/x-matroska" :
           file.name.endsWith('.mp4') ? "video/mp4" :
           file.name.endsWith('.webm') ? "video/webm" :
           "application/octet-stream";

      server = http.createServer((req, res) => {
        const range = req.headers.range
        if (!range) {
          res.statusCode = 416
          return res.end()
        }

        const positions = range.replace(/bytes=/, '').split('-')
        const start = parseInt(positions[0], 10)
        const fileSize = file.length
        const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1
        const chunkSize = (end - start) + 1


        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
        })

        const stream = file.createReadStream({ start, end })
        stream.pipe(res)
      })

      server.listen(0, () => {
        const port = server.address().port
        resolve([`http://localhost:${port}`,mimeType])
      })
    })

    engine.on('error', reject)
  })
});


ipcMain.on("save-video",() => {
  closewindow = false;
  const tmpDir = os.tmpdir()+"/torrent-stream";
  const tmpDirContent = fs.readdir(tmpDir);
  tmpDirContent.forEach(element => {
    let sourcePath = tmpDir+"/"+element;
    let distinationPath =  __dirname+"/Downloads/"+element;

    fs.stat(sourcePath, (err,stats) =>{
      if(stats.isDirectory() || stats.size/(10**9) > 0.5){
        fs.rename(sourcePath,distinationPath,(err) => {
          if(err) throw err;
          closeWindow = true;
          console.log("Media Was Moved");
        });
      }
    });
  });
});

ipcMain.on("add-to-lib", (event,mediaInfo)=>{
  let LibraryInfo = getLibraryInfo() 
  LibraryInfo.media.push(mediaInfo); 
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.on("remove-from-lib", (event,mediaInfo) => {
  let LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(element => !(element.MediaId == mediaInfo.MediaId && element.MediaType == mediaInfo.MediaType));
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.handle("load-from-lib", (event, targetIdentification)=>{
    let LibraryInfo = getLibraryInfo();
    if(LibraryInfo.media.length){
    if(targetIdentification == undefined) return LibraryInfo.media;
      let targetLibraryInfo = LibraryInfo.media.filter(element => element.MediaId == targetIdentification.MediaId && element.MediaType == targetIdentification.MediaType);
      if(targetLibraryInfo.length) return targetLibraryInfo; 
      throw new Error("Target Not Found");
    }else{
      throw new Error("Target Not Found");
    }
});

function getLibraryInfo(){
  try{
    const LibraryData = fs.readFileSync(libraryFilePath,"utf-8");
    return JSON.parse(LibraryData);
  }catch(err){
    return {media:[]};
  }
}

function insertNewInfoToLibrary(newData){
  fs.writeFile(libraryFilePath,JSON.stringify(newData,null,2), err=>{
     if(err){
       console.error(err);
     }
  });
}


function loadSettings() {
  try {
    const data = fs.readFileSync(SettingsFilePath, 'utf-8');
    if(data.trim() == "" || !("TurnOnSubsByDefault" in JSON.parse(data))) throw new Error("empty Sub File");
    return JSON.parse(data);
  } catch (err) {
    return {
      PageZoomFactor: 1,
      TurnOnSubsByDefault: true,
      SubFontSize: 16,
      SubFontFamily: "Montserrat",
      SubColor: "#ffffff",
      SubBackgroundColor: "#000000",
      SubBackgroundOpacityLevel: 0
    };
  }
}

function loadTheme(){
  try{
    let ThemeObj = {theme:[]};
    let savedTheme = fs.readFileSync(ThemeFilePath, "utf-8");
    savedTheme = savedTheme.replaceAll(":root{","").replaceAll("}","").replaceAll("--","").replaceAll(";","").replaceAll(" ","");
    let linesArray = savedTheme.split("\n").filter(line => line != "");
    ThemeObj.theme = linesArray.map(obj => {
      const [key, value] = obj.split(":");
      return {[key]:value};
    });
    return ThemeObj;
  }catch(err){
    console.error("Failed to Load Theme File");
    initializeDataFiles();
    return loadTheme();
  }
}
