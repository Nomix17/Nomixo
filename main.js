import {BrowserWindow , BaseWindow, BrowserView , app, nativeTheme, ipcMain, protocol} from "electron";
import downloadMultiple from "./downloadSubtitles.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import WebTorrent from "webtorrent";
import express from "express";
import dotenv from "dotenv";
import mime from "mime";
import path from "path";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __configs = path.join(app.getPath('userData'),"configs");
let __envfile = path.join(__configs,".env");

dotenv.config({path:__envfile});

if (!process.env.API_KEY) {
  console.error(`Missing TMDB API key. Please set API_KEY in your environment. or Add it to the file ${__envfile}`);
  process.exit(1);
}

// ======================= PATHS =======================
const isDev = !app.isPackaged;
const mpvConfigAssetsDirectory = isDev
  ? path.join(__dirname, 'assets/mpvConfigs')
  : path.join(process.resourcesPath, "assets", "mpvConfigs");

const SettingsFilePath = path.join(__configs, 'settings.json');
const ThemeFilePath = path.join(__configs, 'Theme.css');
const mpvConfigDirectory = path.join(__configs, 'mpvConfigs');
const SubConfigFile = path.join(mpvConfigDirectory, 'mpv.conf');
const libraryFilePath = path.join(__configs, "library.json");
const subDirectory="/tmp/tempSubs";

function initializeDataFiles(){
  if(!fs.existsSync(__configs)){
    fs.mkdirSync(__configs, { recursive: true });
  }
  if(!fs.existsSync(SettingsFilePath)){
    let defaultFileData = JSON.stringify({"PageZoomFactor": 1});
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
  
  if(!fs.existsSync(mpvConfigDirectory)){
    fs.cpSync(mpvConfigAssetsDirectory,mpvConfigDirectory,{ recursive: true });
  }

  if(!fs.existsSync(SubConfigFile)){
    let defaultFileData = `
      osc=yes 
      border=no 
      osd-bar=no
      sub-font-size=30
      sub-font="Arial"
      sub-color="#ffffff"
    `;
    fs.writeFileSync(SubConfigFile,defaultFileData);
  }
}

initializeDataFiles();

// ======================= GLOBALS =======================
let mpv;
let dontPlay = false; 
let mainzoomFactor = 1;
let subsPaths;
let torrentInit;
nativeTheme.themeSource = "dark";

// WebTorrent client
const client = new WebTorrent();
let win;

// ======================= ELECTRON WINDOW =======================
const createWindow = async () => {
  win = new BrowserWindow({
    width: 1100,
    height: 650,
    backgroundColor:"black",
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
};

let closeWindow = true;

app.on("ready", () =>{
  protocol.handle('theme', async () => {
    const css = await fs.promises.readFile(ThemeFilePath, 'utf8');
    return new Response(css, { headers: { 'content-type': 'text/css' ,'cache-control': 'no-store'} });
  });
  createWindow()
});

app.on("window-all-closed", () => {
  if (closeWindow) app.quit();
  if(fs.existsSync(subDirectory))
    fs.readdirSync(subDirectory).forEach(file => {fs.unlinkSync(path.join(subDirectory,file))});
});

// ======================= IPC HANDLERS =======================

// Settings & Theme
ipcMain.handle("load-settings", () => {
  try { return loadSettings(); }
  catch { throw new Error("Failed to load settings"); }
});

ipcMain.handle("load-theme", () => {
  try { return loadTheme(); }
  catch { throw new Error("Failed to load theme"); }
});

ipcMain.handle("load-sub", ()=>{
  try { return loadSubConfigs();}
  catch { throw new Error("Failed to load sub configs");}
});


ipcMain.handle("apply-settings", (event, SettingsObj) => {
  const webContents = event.sender;
  SettingsObj.PageZoomFactor = Math.max(0.1, SettingsObj.PageZoomFactor);
  mainzoomFactor = SettingsObj.PageZoomFactor;
  webContents.setZoomFactor(mainzoomFactor);
  fs.writeFileSync(SettingsFilePath, JSON.stringify(SettingsObj, null, 2));
});

ipcMain.on("apply-theme", (event, ThemeObj) => {
  const formatedThemeObj = ThemeObj.theme.map(obj => `${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`);
  const themeFileContent = `:root{\n${formatedThemeObj.join(";\n")};\n}`;
  fs.writeFileSync(ThemeFilePath, themeFileContent);
});

ipcMain.on("apply-sub-config", (event,SubConfig) => {
  applySubConfigs(SubConfig);
});

ipcMain.handle("go-back", (event) => {
  const webContents = event.sender;
  if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
  // dontPlay = true;
  console.log("Go Back was Pressed");
  client.remove(torrentInit);

  if (mpv) mpv.kill();
  if (win && !win.isVisible()) win.show();
});

ipcMain.handle("change-page", (event, page) => {
  if (!win) return;

  const [filePath, query] = page.split('?');
  const fullPath = path.join(__dirname, filePath);
  const url = `file://${fullPath}${query ? '?' + query : ''}`;
  win.webContents.setZoomFactor(mainzoomFactor);
  win.loadURL(url);
});

ipcMain.handle("request-fullscreen", () => {
  if (!win) return undefined;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

ipcMain.handle("get-api-key", () => process.env.API_KEY);

// ======================= PLAY TORRENT =======================
ipcMain.handle('play-torrent', async (event, magnet,MediaId, MediaType, subsObjects,metaData) => {
  return new Promise((resolve, reject) => {
    torrentInit = client.add(magnet, (torrent) => {
      const file = torrent.files.find(f =>
        /\.(mp4|webm|ogv|avi|mkv)$/i.test(f.name) && f.length > 0.5 * 1e9
      );
      if (!file) return reject(new Error('No suitable video file found'));

      const app = express();
      app.get('/video', (req, res) => {
        const range = req.headers.range;
        if (!range) return res.status(416).send('Requires Range header');

        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : file.length - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${file.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime.getType(file.name)
        });

        const stream = file.createReadStream({ start, end });
        let downloaded = 0;
        stream.on("data", chunk => {
          downloaded += chunk.length;
          const percentage = ((downloaded / file.length) * 100).toFixed(2);
        });
        stream.on('error', (err) => {
          console.error('Stream error:', err);
        });
        res.on('close', () => {
          stream.destroy();
        });

        stream.pipe(res);
      });
      const server = app.listen(0, async() => {
        try{
          const port = server.address().port;
          const url = `http://localhost:${port}/video`;
          console.log(`Streaming URL: ${url}`);

          let downloadResponce = await downloadMultiple(subDirectory,subsObjects);
          subsPaths = downloadResponce.filter(responce => responce.status == "success").map(responce => responce.file);
          let subsArgument = subsPaths.map(path => `--sub-file=${path.replaceAll(" ","\ ")}`);
          console.log(`--config-dir=${mpvConfigDirectory}`);
        
          let currentMediaFromLibrary = await loadFromLibrary({MediaId:MediaId,MediaType:MediaType});
          let startFromTime;

          if(currentMediaFromLibrary == undefined || 
            currentMediaFromLibrary[0].episodeNumber != metaData.episodeNumber ||
            currentMediaFromLibrary[0].seasonNumber != metaData.seasonNumber)
              startFromTime = 0;

          else startFromTime = currentMediaFromLibrary[0].lastPlaybackPosition;

          let childProcessArguments = [url, `--config-dir=${mpvConfigDirectory}`,`--start=${startFromTime}`,...subsArgument];
          if(win.isFullScreen()) childProcessArguments = ["--fullscreen",...childProcessArguments];

          mpv = spawn('mpv', childProcessArguments);
          mpv.on('close', () => {
            console.log('Playback finished');
            server.close();
            torrent.destroy();
            updateLastSecondBeforeQuit(lastSecondBeforeQuit,MediaId,MediaType,metaData)
            mpv.stdout.off('data', hideMainWindow);
            mpv.stderr.off('data', hideMainWindow);

            subsPaths.forEach(file => {fs.unlinkSync(file)});
            const webContents = event.sender;
            if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
            if (win) win.show();
            mpv = "";
          });
          mpv.stdout.on('data', hideMainWindow);
          mpv.stderr.on('data', hideMainWindow);
          resolve(url);
        }catch(error){console.error(error.message)};
      });
    });
  });
});
let lastSecondBeforeQuit=0;
const hideMainWindow = (data)=>{
  if(win && win.isVisible()) win.hide();
  let line = data.toString();
  process.stdout.write(line);
  if(line.includes("AV:")){
    let lastTimeBeforeQuit = line.split("AV:")[1].split("/")[0].trim();
    const [hours, minutes, seconds] = lastTimeBeforeQuit.split(":").map(item => parseInt(item));
    lastSecondBeforeQuit = (hours*60+minutes)*60+seconds;
  }
};

function updateLastSecondBeforeQuit(lastPbPosition,MediaId,MediaType,metaData){
  const LibraryInfo = getLibraryInfo();
  let found = false;

  LibraryInfo.media ??= [];

  for(let [index,item] of Object.entries(LibraryInfo.media)){
    if(item["MediaId"] == MediaId && item["MediaType"] == MediaType){
      LibraryInfo.media[index]["lastPlaybackPosition"] = lastPbPosition;
      LibraryInfo.media[index]["seasonNumber"] = metaData?.seasonNumber;
      LibraryInfo.media[index]["episodeNumber"] = metaData?.episodeNumber;
      LibraryInfo.media[index]["Magnet"] = metaData?.Magnet;
      LibraryInfo.media[index]["bgImagePath"] = metaData?.bgImagePath;

      if(!LibraryInfo.media[index]["typeOfSave"].includes("Currently Watching")){
        LibraryInfo.media[index]["typeOfSave"].push("Currently Watching")
        LibraryInfo.media[index]["mediaImdbId"] ??= metaData?.mediaImdbId;
      }
      found = true;
    }
  }
  if(!found){
    let MediaLibraryObject = {
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
    LibraryInfo.media.push(MediaLibraryObject);
  }
  insertNewInfoToLibrary(LibraryInfo);
}

// ======================= LIBRARY & SAVE VIDEO =======================
// ipcMain.on("save-video", () => {
//   closeWindow = false;
//   const tmpDir = path.join(os.tmpdir(), "torrent-stream");
//   if (!fs.existsSync(tmpDir)) return;

//   const tmpDirContent = fs.readdirSync(tmpDir);
//   tmpDirContent.forEach(element => {
//     const sourcePath = path.join(tmpDir, element);
//     const destinationPath = path.join(__dirname, "Downloads", element);
//     const stats = fs.statSync(sourcePath);
//     if (stats.isDirectory() || stats.size / 1e9 > 0.5) {
//       fs.renameSync(sourcePath, destinationPath);
//       closeWindow = true;
//       console.log("Media Was Moved");
//     }
//   });
// });

ipcMain.on("add-to-lib", (event, mediaInfo) => {
  const LibraryInfo = getLibraryInfo();
  let SearchedMediaElement = LibraryInfo.media.filter(item => (mediaInfo.MediaId.toString() == item.MediaId.toString() && mediaInfo.MediaType == item.MediaType));
  let MediaIsDoesExist = SearchedMediaElement.length > 0;
  if(MediaIsDoesExist){
    LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  }
  LibraryInfo.media.push(mediaInfo);
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.on("remove-from-lib", (event, mediaInfo) => {
  const LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.handle("load-from-lib", (event, targetIdentification) => {
  return loadFromLibrary(targetIdentification);
});

function loadFromLibrary(targetIdentification){
    let LibraryInfo = getLibraryInfo();
    if(LibraryInfo.media.length){
      if(targetIdentification == undefined) return LibraryInfo.media;
      let targetLibraryInfo = LibraryInfo.media.filter(element => element.MediaId == targetIdentification.MediaId && element.MediaType == targetIdentification.MediaType);
      if(targetLibraryInfo.length) return targetLibraryInfo; 
      return undefined
    }else{
      return undefined
    }

}

// ======================= SETTINGS & THEME =======================
function getLibraryInfo() {
  try { return JSON.parse(fs.readFileSync(libraryFilePath, "utf-8")); }
  catch { return { media: [] }; }
}

function insertNewInfoToLibrary(newData) {
  fs.writeFileSync(libraryFilePath, JSON.stringify(newData, null, 2));
}

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(SettingsFilePath, "utf-8")); }
  catch {
    return {
      PageZoomFactor: 1
    };
  }
}

function loadSubConfigs(){
  let JsonConfig = {};
  let mpvConfig = fs.readFileSync(SubConfigFile,"utf-8");
  let lines = mpvConfig.split("\n");
  lines.forEach(line=>{
    if(!line.includes("osc") && !line.includes("border") && !line.includes("osd-bar")){
      if(line.includes("no-sub")){
        JsonConfig["no-sub"] = true;
      }else if(line.includes("=")){
        let entitie = line.split("=");
        let value = entitie[1] == "yes" ? true : (entitie[1] == "no" ? false : entitie[1])
        JsonConfig[entitie[0]] = entitie[1];
      }
    }
  });
  if(JsonConfig?.["no-sub"] == undefined) JsonConfig["no-sub"] = false;
  return JsonConfig;
}

function applySubConfigs(jsonContent){
  let mpvConfig = "osc=yes \nborder=no \nosd-bar=no";

  let Entities = Object.entries(jsonContent);
  for(let entry of Entities){
    if(entry[0] == "no-sub"){
      if(entry[1]==true)
        mpvConfig += "\nno-sub";
    }else{
      mpvConfig += "\n";
      let value = (entry[1]==true && entry[0]!="sub-font-size") ? "yes" : (entry[1]==false && entry[0] != "sub-font-size" ? "no" : entry[1]);

      mpvConfig += entry[0] + "=" + value;
    }
  }
  fs.writeFileSync(SubConfigFile,mpvConfig);
}

function loadTheme() {
  try {
    const savedTheme = fs.readFileSync(ThemeFilePath, "utf-8")
      .replaceAll(":root{", "")
      .replaceAll("}", "")
      .replaceAll("--", "")
      .replaceAll(";", "")
      .replaceAll(" ", "");
    const linesArray = savedTheme.split("\n").filter(line => line !== "");
    return { theme: linesArray.map(line => {
      const [key, value] = line.split(":");
      return { [key]: value };
    })};
  } catch {
    console.error("Failed to Load Theme File");
    initializeDataFiles();
    return loadTheme();
  }
}
