import {BrowserWindow, app, nativeTheme, ipcMain, protocol, dialog} from "electron";
import downloadMultipleSubs from "./downloadSubtitles.js";
import { spawn } from "child_process";
import { Worker } from 'worker_threads';
import WebTorrent from 'webtorrent';
import { fileURLToPath} from "url";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import mime from "mime";
import http from 'http';
import path from "path";
import fs from 'fs';

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
const libraryFilePath = path.join(__configs, "library.json");
const downloadLibraryFilePath = path.join(__configs, "downloads.json");
const MPVPlayerWorkerPath = path.join(__dirname, 'MPVStreamingWorker.js');

const subDirectory="/tmp/tempSubs";
const videoCachePath = path.join(__configs,"video_cache");
const postersDirPath = path.join(__configs,"posters");
let defaultDownloadDir = path.join(__configs,"Downloads");

const mpvConfigDirectory = path.join(__configs, 'mpvConfigs');
const SubConfigFile = path.join(mpvConfigDirectory, 'mpv.conf');

initializeDataFiles();

// ======================= GLOBALS =======================

let WINDOW;
let server;
let mpv = null;
let MPVWorker = null;
let dontPlay = false; 
let closeWindow = true;
let InVideoPlayerPage = false;
let mainzoomFactor = 1;
let subsPaths;
let torrentInit;
nativeTheme.themeSource = "dark";

// torrent trackers
const downloadingMediaHashMap = {};
let StreamClient;
const DownloadClient = new WebTorrent();
let lastSecondBeforeQuit=0;

// ======================= WINDOW MANAGER =======================

const createWindow = async () => {
   WINDOW = new BrowserWindow({
     width: 1100,
     height: 650,
     show:false,
     webPreferences: {
       preload: path.join(__dirname, 'preload.js'),
       contextIsolation: true,
       nodeIntegration: false
    }
  });
  WINDOW.setMenuBarVisibility(false);
  WINDOW.loadFile("./home/mainPage.html");
  
  let defaultSettings = loadSettings();
  mainzoomFactor = defaultSettings.PageZoomFactor;
  let settingDefaultDownloadingPath = defaultSettings?.defaultDownloadPath;
  if(settingDefaultDownloadingPath !== undefined)
    defaultDownloadDir = settingDefaultDownloadingPath;

  WINDOW.webContents.on('did-finish-load', () => {
    WINDOW.webContents.setZoomFactor(mainzoomFactor);
    // WINDOW.maximize();
    WINDOW.show();
  });
}

app.on("ready", () =>{
  protocol.handle('theme', async () => {
    const css = await fs.promises.readFile(ThemeFilePath, 'utf8');
    return new Response(css, { headers: { 'content-type': 'text/css' ,'cache-control': 'no-store'} });
  });
  createWindow()
});

app.on("window-all-closed", async() => {
  if(closeWindow){
    app.quit();
  }

  let wholeDownloadLibrary = await loadDownloadLibrary();
  let torrentsIds = wholeDownloadLibrary.downloads
    .filter(torrentElement => torrentElement?.Status === "Downloading" || torrentElement?.Status === "Loading" )
    .map(torrent => torrent.torrentId);

  await editDownloadLibraryElements(torrentsIds,"Status","Paused");
});

// ======================= IPC HANDLERS =======================

//      ================ SETTINGS & THEME ================

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

ipcMain.handle("load-sub", ()=>{
  try { return loadSubConfigs();}
  catch { throw new Error("Failed to load sub configs");}
});

ipcMain.handle("apply-settings",async(event, SettingsObj) => {
  let oldSettings = await loadSettings();
  let FullSettings = {...oldSettings,...SettingsObj};

  const webContents = event.sender;
  FullSettings.PageZoomFactor = Math.max(0.1,FullSettings.PageZoomFactor);
  webContents.setZoomFactor(FullSettings.PageZoomFactor);
  mainzoomFactor = FullSettings.PageZoomFactor;
  fs.writeFileSync(SettingsFilePath, JSON.stringify(FullSettings, null, 2), (err) => {
    if(err) console.error(err)
    return err;
  });
  return null
});

ipcMain.on("apply-theme",(event, ThemeObj) =>{
  let formatedThemeObj = ThemeObj.theme.map(obj=>`${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`);

  let themeFileContent = `:root{
    ${formatedThemeObj.join(";\n")}
  ;}`;

  fs.writeFile(ThemeFilePath,themeFileContent, (err)=>{
    if(err) console.error(err)
  });
});

ipcMain.on("apply-sub-config", (event,SubConfig) => {
  applySubConfigs(SubConfig);
});

// ======================= NAVIGATION =======================

ipcMain.handle("can-go-back",(event)=>{
  const webContents = WINDOW.webContents;
  return webContents.navigationHistory.canGoBack();
});

ipcMain.handle("go-back",(event)=>{
  NavigateToPreviousPage();
});

ipcMain.handle("change-page", (event,page) => {
  if (WINDOW) {
    const webContents = event.sender;
    const [filePath, query] = page.split('?');
    const fullPath = path.join(__dirname, filePath);
    webContents.setZoomFactor(mainzoomFactor);
    const url = `file://${fullPath}${query ? '?' + query : ''}`;
    WINDOW.loadURL(url);
  }
});

ipcMain.handle("request-fullscreen",()=>{
  if (!WINDOW) return undefined;
  WINDOW.setFullScreen(!WINDOW.isFullScreen());
  return WINDOW.isFullScreen();
});

ipcMain.handle("get-full-video-path",async(event,dirPath,fileName)=>{
  return await findFile(dirPath,fileName);
});

ipcMain.handle("open-filesystem-browser",async(event,currentPath)=>{
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: currentPath
  });
  if (!canceled) {
    return filePaths[0];
  }
  return null
});

ipcMain.handle("get-api-key",() => process.env.API_KEY);

// ======================= VIDEO STREAMING =======================

ipcMain.handle('get-video-url', async (event, magnet,fileName) => {
  return new Promise((resolve, reject) => {
    InVideoPlayerPage = true;

    console.log("\nLoading Torrent:",fileName);
    if (!fs.existsSync(videoCachePath)) {
      fs.mkdirSync(videoCachePath, { recursive: true });
    }
    const client = new WebTorrent();
    const torrent = client.add(magnet,{path: videoCachePath});
    StreamClient = torrent;
    torrent.on('ready', () => {
      torrent.deselect(0, torrent.pieces.length - 1, false);

      console.log("\nTorrent Files:-----------------------------------------------------");
      torrent.files.forEach(f => { console.log(f.name) });
      console.log("-------------------------------------------------------------------\n");

      const file = torrent.files.find(f => normaliseFileName(f.name) === normaliseFileName(fileName));

      if (!file) {
        return reject('No video file found in torrent');
      }

      file.select();

      const mimeType = file.name.endsWith('.mkv') ? "video/x-matroska" :
                       file.name.endsWith('.mp4') ? "video/mp4" :
                       file.name.endsWith('.webm') ? "video/webm" :
                       "application/octet-stream";

      const server = http.createServer((req, res) => {
        const range = req.headers.range;
        if (!range) {
          res.statusCode = 416;
          return res.end();
        }

        const positions = range.replace(/bytes=/, '').split('-');
        const start = parseInt(positions[0], 10);
        const fileSize = file.length;
        const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
        });

        const stream = file.createReadStream({ start, end });
        stream.pipe(res);
      });

      server.listen(0, () => {
        const port = server.address().port;
        resolve([`http://localhost:${port}`, mimeType]);
      });
    });

    torrent.on('error', reject);
  });
});

ipcMain.handle('play-torrent-over-mpv', async (event,metaData,subsObjects) => {
  let startFromTime = await getLastestPlayBackPostion(metaData);

  MPVWorker = new Worker(MPVPlayerWorkerPath, {
    workerData: {
      typeOfPlay:"StreamTorrent",
      metaData,
      subsObjects,
      startFromTime,
      videoCachePath,
      subDirectory,
      mpvConfigDirectory
    },
    type: 'module'
  });

  handleMpvWorker(metaData);
  InVideoPlayerPage = true;
});

ipcMain.handle('play-video-over-mpv', async(event,metaData) => {
  let startFromTime = await getLastestPlayBackPostion(metaData);

  let subIdentifyingElements = {
    IMDB_ID:metaData.mediaImdbId,
    episodeNumber:metaData.episodeNumber,
    seasonNumber:metaData.seasonNumber,
    TorrentDownloadDir:metaData.downloadPath
  };

  let subsPaths = await loadSubsFromSubDir(metaData.downloadPath,subIdentifyingElements).map(sub=>sub.url);

  MPVWorker = new Worker(MPVPlayerWorkerPath, {
    workerData: {
      typeOfPlay:"LocalFile",
      metaData,
      startFromTime,
      subsPaths,
      mpvConfigDirectory
    },
    type: 'module'
  });

  handleMpvWorker(metaData);
  InVideoPlayerPage = true;
});

// ======================= TORRENT DOWNLOADING =======================

ipcMain.handle("download-torrent", async (event, torrentsInformation, subsObjects) => {
  const results = [];
  
  for (const torrentInfo of torrentsInformation) {
    try {
      // Determine download path
      let userDownloadPath = torrentInfo?.userDownloadPath;
      if (userDownloadPath) {
        defaultDownloadDir = userDownloadPath;
      }
      
      const TorrentDownloadDir = path.join(defaultDownloadDir, torrentInfo.dirName);
      fs.mkdirSync(TorrentDownloadDir, { recursive: true });
      
      const torrentId = generateUniqueId(
        `${torrentInfo.IMDB_ID}-${torrentInfo.episodeNumber ?? "undefined"}-${torrentInfo.seasonNumber ?? "undefined"}-${TorrentDownloadDir}`
      );

      torrentInfo["torrentId"] = torrentId;
      torrentInfo["downloadPath"] = TorrentDownloadDir;

      // download Subs
      try {
        downloadSubs(subsObjects, torrentId, TorrentDownloadDir);
      } catch (error) {
        reportDownloadError("Subtitles Download",torrentId,error);
        console.error(error);
      }

      // download the torrent
      try {
        await downloadTorrent(torrentInfo);
        results.push({ success: true, torrentId });
      } catch (error) {
        reportDownloadError("Torrent Download",torrentId,error);
        console.error(error);
        results.push({ success: false, error: error.message, torrentId });
      }

    } catch (err) {
      console.error(`Error processing torrent:`, err);
      results.push({ success: false, error: err.message });
    }
  }
  return results;
});

function findFileInsideTorrent(torrent, targetFileName){
  let filesPathsHashMap = {};
  let files = torrent.files ?? [];
  for(let fileInsideTorrent of files){
    if (targetFileName === fileInsideTorrent.name) {
      return fileInsideTorrent;
    }
    filesPathsHashMap[normaliseFileName(fileInsideTorrent.name)] = fileInsideTorrent;
  }
  return filesPathsHashMap[normaliseFileName(targetFileName)] ?? null;
}

ipcMain.handle("cancel-torrent-download", async (event, mediaInfo) => {
  const torrentId = mediaInfo.torrentId;
  const targetTorrent = downloadingMediaHashMap?.[torrentId];

  if (targetTorrent) {
    await new Promise((resolve) => {
      targetTorrent.destroy(() => {
        delete downloadingMediaHashMap[torrentId];
        console.log(`Torrent cancelled: ${torrentId}`);
        resolve();
      });
    });
  }
  
  // Remove the download directory
  const downloadPath = mediaInfo.downloadPath;
  if (downloadPath && fs.existsSync(downloadPath)) {
    await fs.promises.rm(downloadPath, { recursive: true, force: true });
    console.log(`Removed directory: ${downloadPath}`);
  }
  
  await removeFromDownloadLibrary(torrentId);
  
  return { success: true, torrentId };
});

ipcMain.handle("toggle-torrent-download", async (event, torrentId) => {
  const torrent = downloadingMediaHashMap[torrentId];
  if (!torrent){
    let wholeDownloadLibrary = await loadDownloadLibrary();

    if(wholeDownloadLibrary.downloads.length){
      let torrentInfo = wholeDownloadLibrary.downloads.find(element => element.torrentId === torrentId);
      torrentInfo["torrentId"] = torrentId;
      
      downloadTorrent(torrentInfo)
      .catch(
        (err)=>{
          console.error(err.message);
          reportDownloadError("Torrent Download",torrentId,err);
          const loadedTorrent = downloadingMediaHashMap[torrentId];
          if(loadedTorrent){
            loadedTorrent.destroy(() => {
              delete downloadingMediaHashMap[torrentId];
            });
          }
        }
      );
      return {response: "continued", torrentId:torrentId};

    }else{
      console.error("Empty download library, cannot continue download for",torrentId);
      return {response: "empty download library",torrentId:torrentId};
    }

  }else{
    await new Promise((resolve) => {
      torrent.destroy(() => {
        delete downloadingMediaHashMap[torrentId];
        console.log(`Torrent Paused: ${torrentId}`);
        resolve();
      });
    });

    return {response: "paused", torrentId:torrentId};
  }

});

// ======================= Download OTHER THINGS =======================

ipcMain.handle("download-image",async(event,downloadPath, imageUrl) => {
  let posterDownloadPath = path.join(downloadPath, "POSTERS") 
  let ImagePath = await downloadImage(posterDownloadPath, imageUrl);
  if(ImagePath){
    return {download_result:"success",image_path:ImagePath}
  }

  return {download_result:"failed"}
});

// ======================= LIBRARY MANAGEMENT =======================

ipcMain.on("add-to-lib", (event, mediaInfo) => {
  const LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  LibraryInfo.media.push(mediaInfo);
  insertNewInfoToLibrary(libraryFilePath,LibraryInfo);
});

ipcMain.on("remove-from-lib", (event, mediaInfo) => {
  const LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  insertNewInfoToLibrary(libraryFilePath,LibraryInfo);
});

ipcMain.on("edit-element-lib", async (event, mediaInfo) => {
  const LibraryInfo = await getLibraryInfo();
  let elementIndex = LibraryInfo.media.findIndex(
    e => e.MediaId.toString() === mediaInfo.MediaId.toString() &&
         e.MediaType === mediaInfo.MediaType
  );
  if(elementIndex !== -1) {
    for(let [key, value] of Object.entries(mediaInfo)) {
      LibraryInfo.media[elementIndex][key] = value;
    }
    insertNewInfoToLibrary(libraryFilePath, LibraryInfo);
  }
});

ipcMain.handle("load-from-lib", (event, targetIdentification) => {
  return loadFromLibrary(targetIdentification);
});

// ############################## DOWNLOAD LIBRARY MANAGEMENT ##############################

ipcMain.on("add-to-download-lib", async(event, torrentId, mediaInfo) => {
  const downloadLibraryInfo = await loadDownloadLibrary();
  downloadLibraryInfo.media = downloadLibraryInfo.downloads.filter(e => !(e.torrentId === torrentId));
  downloadLibraryInfo.media.push(mediaInfo);
  await insertNewInfoToLibrary(downloadLibraryFilePath,downloadLibraryInfo);
  return null;
});

ipcMain.on("remove-from-download-lib", async(event, torrentId) => {
  const downloadLibraryInfo = await loadDownloadLibrary();
  downloadLibraryInfo.media = downloadLibraryInfo.downloads.filter(e => !(e.torrentId === torrentId));
  await insertNewInfoToLibrary(downloadLibraryFilePath,downloadLibraryInfo);
  return null;
});

ipcMain.handle("edit-download-lib", async(event, torrentId, key, value) => {
  await editDownloadLibraryElements([torrentId],key,value);
  return null;
});

ipcMain.handle("load-from-download-lib",async(event,targetIdentification)=>{
  let wholeDownloadLibrary = await loadDownloadLibrary();
  return wholeDownloadLibrary;
});

// ############################## SUBTITLES FILES MANAGEMENT ##############################

ipcMain.handle("load-local-subs",async(event,downloadPath,identifyingElements)=>{
  return loadSubsFromSubDir(downloadPath,identifyingElements);
});

ipcMain.handle("read-sub-file",async(event,filePath)=>{
  return fs.readFileSync(filePath, 'utf8');
});

// ################# functions ######################## 

// ########## SETTINGS RELATED #################

function loadSettings() {
  try {
    const data = fs.readFileSync(SettingsFilePath, 'utf-8');
    if(data.trim() === "" || !("TurnOnSubsByDefaultInternal" in JSON.parse(data))) throw new Error("empty Settings File");
    return JSON.parse(data);
  } catch (err) {
    return {
      PageZoomFactor: 1,
      TurnOnSubsByDefaultInternal: true,
      SubFontSizeInternal: 16,
      SubFontFamilyInternal: "Montserrat",
      SubColorInternal: "#ffffff",
      SubBackgroundColorInternal: "#000000",
      SubBackgroundOpacityLevelInternal: 0
    };
  }
}

function loadTheme(){
  try{
    let ThemeObj = {theme:[]};
    let savedTheme = fs.readFileSync(ThemeFilePath, "utf-8");
    savedTheme = savedTheme.replaceAll(":root{","")
      .replaceAll("}","")
      .replaceAll("--","")
      .replaceAll(";","")
      .replaceAll(" ","");
    let linesArray = savedTheme.split("\n").filter(line => line !== "");
    ThemeObj.theme = linesArray.map(obj => {
      const [key, value] = obj.split(":");
      return {[key]:value};
    });
    return ThemeObj;
  }catch(err){
    console.error("Failed to Load Theme File");
    console.error(err.message);
    initializeDataFiles();
    return loadTheme();
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
        let value = entitie[1] === "yes" ? true : (entitie[1] === "no" ? false : entitie[1])
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
    if(entry[0] === "no-sub"){
      if(entry[1] === true)
        mpvConfig += "\nno-sub";
    }else{
      mpvConfig += "\n";
      let value = (entry[1] === true && entry[0] !== "sub-font-size") ? "yes" : (entry[1] === false && entry[0] !== "sub-font-size" ? "no" : entry[1]);

      mpvConfig += entry[0] + "=" + value;
    }
  }
  fs.writeFileSync(SubConfigFile,mpvConfig);
}

function initializeDataFiles(){
  if(!fs.existsSync(__configs)){
    fs.mkdirSync(__configs, { recursive: true });
  }
  if(!fs.existsSync(postersDirPath)){
    fs.mkdirSync(postersDirPath, { recursive: true });
  }
  if (!fs.existsSync(videoCachePath)) {
    fs.mkdirSync(videoCachePath, { recursive: true });
  }
  if(!fs.existsSync(SettingsFilePath)){
    let defaultFileData = JSON.stringify(
      {
        "PageZoomFactor": 1,
        "TurnOnSubsByDefaultInternal": true,
        "SubFontSizeInternal": 16,
        "SubFontFamilyInternal": "Montserrat",
        "SubColorInternal": "#ffffff",
        "SubBackgroundColorInternal": "#000000",
        "SubBackgroundOpacityLevelInternal": 0
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

  if(!fs.existsSync(defaultDownloadDir)){
    fs.mkdirSync(defaultDownloadDir, { recursive: true });
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

// ########## DOWLOAD RELATED #################

async function downloadTorrent(torrentInfo) {
  // Add torrent
  const torrent = DownloadClient.add(torrentInfo.MagnetLink, {
    path: torrentInfo.downloadPath
  });

  downloadingMediaHashMap[torrentInfo.torrentId] = torrent;

  insertNewDownloadEntryPoint(torrentInfo);

  return new Promise((resolve, reject) => {
    console.log("Loading Torrent:", torrentInfo.torrentId);
    
    torrent.on("ready", () => {
     
      console.log("\nDownload Target: " + torrentInfo?.fileName);
      console.log("\nTorrent Files:-----------------------------------------------------");
      torrent.files.forEach(f => { console.log(f.name) });
      console.log("-------------------------------------------------------------------\n");

      let targetFile = findFileInsideTorrent(torrent, torrentInfo?.fileName);

      if (!targetFile) {
        reject(new Error('No suitable video file found'));
      }

      // Deselect all files first
      torrent.files.forEach(file => {file.deselect()});
      
      // Select only the file that match the name
      targetFile.select();


      // Calculate total size of only selected file
      const totalSize = targetFile.length;
      let LibraryStartTime = 0;
      let PipingStartTime = 0;
      const DelayBeforeLibrarySave = 1000;
      const DelayBeforePiping = 400;

      torrent.on("download", () => {
        const now = Date.now();
        // Calculate downloaded bytes for selected files only
        const downloadedDataLength = targetFile.downloaded;

        torrentInfo["Total"] = totalSize;
        torrentInfo["Downloaded"] = downloadedDataLength;
        torrentInfo["poster"] = torrentInfo.posterUrl;

        // Check if download is complete
        if (totalSize <= downloadedDataLength) {
          const jsonMessage = {
            TorrentId: torrentInfo.torrentId,
            Downloaded: downloadedDataLength,
            Total: totalSize,
            DownloadPath: torrentInfo.downloadPath,
            Status: "Done"
          };
          
          torrentInfo["Status"] = "Done";
          updateElementDownloadLibrary(torrentInfo, downloadedDataLength,totalSize);
          
          WINDOW.webContents.send("download-progress-stream", jsonMessage);
          
          torrent.destroy(() => {
            delete DownloadingTorrents[torrentInfo.torrentId];
            console.log(`Torrent cleaned up: ${torrentInfo.torrentId}`);
          });
          
          resolve();
          return;
        }

        // Update library periodically
        if (now - LibraryStartTime >= DelayBeforeLibrarySave) {
          updateElementDownloadLibrary(torrentInfo, downloadedDataLength, totalSize);
          LibraryStartTime = now;
        }

        // Send progress updates
        if (now - PipingStartTime >= DelayBeforePiping) {
          const downloadSpeed = torrent.downloadSpeed; // b/s

          const jsonMessage = {
            TorrentId: torrentInfo.torrentId,
            Downloaded: downloadedDataLength,
            Total: totalSize,
            DownloadPath: torrentInfo.downloadPath,
            DownloadSpeed:downloadSpeed,
            Status: "Downloading"
          };

          WINDOW.webContents.send("download-progress-stream", jsonMessage);
          PipingStartTime = now;

          console.log(`Downloading ${torrentInfo.dirName}: ${((downloadedDataLength / totalSize) * 100).toFixed(2)}%, ${(downloadSpeed / (1024)).toFixed(2)} Kb/s`);
        }
      });
    });

    torrent.on("error", (err) => {
      console.error(`Torrent error: ${torrentInfo.torrentId}, ${err}`);
      
      WINDOW.webContents.send("download-progress-stream", {
        TorrentId: torrentInfo.torrentId,
        Status: "error",
        Error: err.message
      });
      
      reject(err);
    });
  });
}

function downloadSubs(subsObjects, torrentId, TorrentDownloadDir) {
  // Download subtitles
  if (subsObjects.length) {
    try {
      let subDownloadDir = path.join(TorrentDownloadDir, `SUBS_${torrentId}`);
      fs.mkdirSync(subDownloadDir, { recursive: true });
      downloadMultipleSubs(subDownloadDir, subsObjects);
    } catch (err) {
      reportDownloadError("Subtitles Download", torrentId, err);
      console.error("Subtitle download error:", err);
    }
  }
}


async function downloadImage(downloadDir, posterUrl) {
  fs.mkdirSync(downloadDir, { recursive: true });
  try {
    const controller = new AbortController();

    const res = await fetch(posterUrl, { signal: controller.signal });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error('Empty file');

    const file = path.join(downloadDir, path.basename(new URL(posterUrl).pathname));
    fs.writeFileSync(file, buffer);

    return file;
  } catch (err) {
    console.error(`Failed to download ${posterUrl}:`, err.message);
    return null;
  }
}

function reportDownloadError(errorType, torrentId, err){
  WINDOW.webContents.send("report-download-errors", {
    type: errorType,
    torrentId: torrentId,
    err_msg: err
  });
}

// ############################ NAVIGATION RELATED ############################

function NavigateToPreviousPage(){
  const webContents = WINDOW.webContents;
  if(webContents.navigationHistory.canGoBack()){
    if(StreamClient) StreamClient.destroy();
    if(mpv) mpv.kill();
    if(WINDOW && !WINDOW.isVisible()) WINDOW.show();
    if(MPVWorker && MPVWorker.threadId !== -1){
      MPVWorker.postMessage({ type: 'shutdown' });
      MPVWorker = null;
    }
    webContents.navigationHistory.goBack();
  }
}

function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
}

function findFile(dir, filename) {
  if(!fs.existsSync(dir)) return null;
  const filesPathsHashMap = {};
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const result = findFile(fullPath, filename);
      if (result) return result;
    } else if (file === filename) {
      return fullPath;
    }
    filesPathsHashMap[normaliseFileName(file)] = fullPath;
  }
  return filesPathsHashMap[normaliseFileName(filename)] ?? null;
}

const normaliseFileName = (fileName)=>{
  if(fileName) return fileName.replace(/[+\s]+/g, ' ').trim().toLowerCase()
  return "";
}

function sanitizeUrl(urlString) {
    const u = new URL(encodeURI(urlString));
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.toString();
}

function loadSubsFromSubDir(downloadPath,identifyingElements){
  let torrentId = generateUniqueId(
    `${identifyingElements.IMDB_ID}-${identifyingElements.episodeNumber ?? "undefined"}-${identifyingElements.seasonNumber ?? "undefined"}-${identifyingElements.TorrentDownloadDir}`
  );

  let subsDirectory = path.join(downloadPath,`SUBS_${torrentId}`);
  try{
    return fs.readdirSync(subsDirectory).map(subFileName => {
      let displayName = subFileName.split("-")[0];
      return {
        url:path.join(subsDirectory,subFileName),
        display:displayName,
        language:languageDict[displayName.toLowerCase()] ?? displayName,
        type:"local"
      }
    });
  }catch(err){
    return [];
  }
}

// ############################ LIBRARIES RELATED ############################

function getLibraryInfo() {
  try { 
    return JSON.parse(fs.readFileSync(libraryFilePath, "utf-8")); 
  } catch { 
    return { media: [] }; 
  }
}

function insertNewInfoToLibrary(libraryFilePath, newData) {
  try {
    fs.writeFileSync(libraryFilePath, JSON.stringify(newData, null, 2));
  } catch (err) {
    console.error(err);
  }
}

function loadFromLibrary(targetIdentification){
  let LibraryInfo = getLibraryInfo();
  if(LibraryInfo.media.length){
    if(targetIdentification == undefined) return LibraryInfo.media;
    let targetLibraryInfo = LibraryInfo.media.filter(element => element.MediaId === targetIdentification.MediaId && element.MediaType === targetIdentification.MediaType);
    if(targetLibraryInfo.length) return targetLibraryInfo; 
    return undefined
  }else{
    return undefined
  }
}

async function removeFromLibrary(mediaInfo) {
  let LibraryInfo = await getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(
    element => element.torrentId !== mediaInfo.torrentId
  );
  insertNewInfoToLibrary(libraryFilePath, LibraryInfo);
}

async function removeFromDownloadLibrary(torrentId){
  let downloadLib = await loadDownloadLibrary();
  downloadLib.downloads = downloadLib.downloads.filter(element => (element.torrentId !== torrentId));
  insertNewInfoToLibrary(downloadLibraryFilePath, downloadLib);
}

function loadDownloadLibrary(){
  try { 
    return JSON.parse(fs.readFileSync(downloadLibraryFilePath, "utf-8")); 
  } catch { 
    return { downloads: [] }; 
  }
}

async function insertNewDownloadEntryPoint(torrentInfo){
  let downloadLib = await loadDownloadLibrary();

  // Find existing entry or create new one
  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentInfo.torrentId
  );

  if(existingIndex === -1){
    let posterDownloadPath = torrentInfo?.downloadPath 
       ? path.join(torrentInfo.downloadPath, "POSTERS") 
       : postersDirPath;

    let bgImagePath = path.join(posterDownloadPath,torrentInfo?.bgImageUrl.split("/").pop());
    let posterPath = path.join(posterDownloadPath,torrentInfo?.posterUrl.split("/").pop());

    downloadImage(posterDownloadPath,torrentInfo?.bgImageUrl)
    downloadImage(posterDownloadPath,torrentInfo?.posterUrl);

    let newEntry = {...torrentInfo, posterPath: posterPath ?? "undefined", bgImagePath: bgImagePath ?? "undefined", Status:"Loading"};
    downloadLib.downloads.push(newEntry);

    const jsonMessage = { Status: "NewDownload" }
    WINDOW.webContents.send("download-progress-stream", jsonMessage);
    await insertNewInfoToLibrary(downloadLibraryFilePath, downloadLib);

    console.log("Creating Download Library Entry Point for: "+torrentInfo.torrentId);
  }
}

async function editDownloadLibraryElements(torrentsIds,key,value){
  const downloadLibraryInfo = await loadDownloadLibrary();
  for(let torrentId of torrentsIds){
    for(let index=0 ; index < downloadLibraryInfo.downloads.length ; index++){
      if(downloadLibraryInfo.downloads[index].torrentId === torrentId){
        downloadLibraryInfo.downloads[index][key] = value;
        break; 
      }
    }
  }

  await insertNewInfoToLibrary(downloadLibraryFilePath,downloadLibraryInfo);
}

async function updateElementDownloadLibrary(torrentInfo, downloadedBytes, totalSize) {
  let downloadLib = await loadDownloadLibrary();

  // Find existing entry or create new one
  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentInfo.torrentId
  );
  
  if(existingIndex !== -1){
    downloadLib.downloads[existingIndex]["Downloaded"] = downloadedBytes;
    downloadLib.downloads[existingIndex]["typeOfSave"] = torrentInfo.Status === "Done" ? "Download-Complete" : "Download"
    downloadLib.downloads[existingIndex]["Total"] = totalSize;

    if(torrentInfo.Status === "Done")
      downloadLib.downloads[existingIndex]["Status"] = "Done";
    await insertNewInfoToLibrary(downloadLibraryFilePath, downloadLib);
  }
}

async function getLastestPlayBackPostion(metaData){
  let CurrentMediaLibraryEntry = await loadFromLibrary({MediaId:metaData.MediaId,MediaType:metaData.MediaType});

  let startFromTime;
  if(CurrentMediaLibraryEntry == undefined || 
    CurrentMediaLibraryEntry[0].episodeNumber !== metaData.episodeNumber ||
    CurrentMediaLibraryEntry[0].seasonNumber !== metaData.seasonNumber)
      return 0;

  return CurrentMediaLibraryEntry[0].lastPlaybackPosition;
}

// ############################ MPV PLAYER RELATED ############################

function handleMpvWorker(metaData){

  const ExitVideoPlayerPage = ()=>{
    if(InVideoPlayerPage){
      InVideoPlayerPage = false;
      updateLastSecondBeforeQuit(lastSecondBeforeQuit,metaData)
      NavigateToPreviousPage();
    }
  }

  const closeWorker = ()=>{
    if(MPVWorker && MPVWorker.threadId !== -1){
      MPVWorker.postMessage({ type: 'shutdown' });
      MPVWorker = null;
    }
    if(WINDOW && !WINDOW.isVisible()) WINDOW.show();
  }

  MPVWorker.on('message', (msg) => {
    if(msg.type === "status"){
      if(msg.message === "Mpv output data"){
        handleMpvOutput(msg.data);

      } else if (msg.message === "Playback done"){
        ExitVideoPlayerPage();
        
      } else if (msg.message === "Playback error"){
        console.error("Playback error:", msg.error || "Unknown error");
        if(msg.error) WINDOW.webContents.send("torrent-fetching-error", msg.error);
        closeWorker();       

      } else if(msg.message === "Torrent Fetching Error"){
        console.error("Torrent fetching error:", msg.error || "Unknown error");
        if(msg.error) WINDOW.webContents.send("torrent-fetching-error", msg.error);
        closeWorker();
      }
    }
  });

  MPVWorker.on('error', (err) => {
    console.error('Mpv Worker error:', err);
    ExitVideoPlayerPage();
  });

  MPVWorker.on('exit', (code) => {
    console.log(`Mpv Worker exited with code ${code}`);
    if(code !== 0) {
      console.error(`Worker exited abnormally with code ${code}`);
      closeWorker();
    } else {
      ExitVideoPlayerPage();
    }
  });
}

const handleMpvOutput = (data)=>{
  if(data.toString().includes("AV:"))
    if(WINDOW && WINDOW.isVisible()) WINDOW.hide();
  let line = data.toString();
  process.stdout.write(line);
  if(line.includes("AV:")){
    let lastTimeBeforeQuit = line.split("AV:")[1].split("/")[0].trim();
    const [hours, minutes, seconds] = lastTimeBeforeQuit.split(":").map(item => parseInt(item));
    lastSecondBeforeQuit = (hours*60+minutes)*60+seconds;
  }
};

function updateLastSecondBeforeQuit(lastPbPosition,metaData){
  const LibraryInfo = getLibraryInfo();
  let found = false;

  LibraryInfo.media ??= [];

  for(let [index,item] of Object.entries(LibraryInfo.media)){
    if(item["MediaId"] === metaData.MediaId && item["MediaType"] === metaData.MediaType){
      LibraryInfo.media[index]["lastPlaybackPosition"] = lastPbPosition;
      LibraryInfo.media[index]["seasonNumber"] = metaData?.seasonNumber;
      LibraryInfo.media[index]["episodeNumber"] = metaData?.episodeNumber;
      LibraryInfo.media[index]["Magnet"] = metaData?.Magnet;
      LibraryInfo.media[index]["bgImagePath"] = metaData?.bgImagePath;
      LibraryInfo.media[index]["downloadPath"] = metaData?.downloadPath;
      LibraryInfo.media[index]["fileName"] = metaData?.fileName;


      if(!LibraryInfo.media[index]["typeOfSave"].includes("Currently Watching")){
        LibraryInfo.media[index]["typeOfSave"].push("Currently Watching")
        LibraryInfo.media[index]["mediaImdbId"] ??= metaData?.mediaImdbId;
      }
      found = true;
    }
  }
  if(!found){
    let MediaLibraryObject = {
      MediaId:metaData?.MediaId,
      MediaType:metaData?.MediaType,
      Magnet:metaData?.Magnet,
      bgImagePath:metaData?.bgImagePath,
      mediaImdbId:metaData?.mediaImdbId,
      downloadPath:metaData?.downloadPath,
      fileName:metaData?.fileName,

      lastPlaybackPosition:lastPbPosition,
      seasonNumber:metaData.seasonNumber,
      episodeNumber:metaData.episodeNumber,
      typeOfSave:["Currently Watching"]
    }
    LibraryInfo.media.push(MediaLibraryObject);
  }
  insertNewInfoToLibrary(libraryFilePath,LibraryInfo);
}


// ################################### maping Languages codes ###################################
const languageDict = {
  english: "en", afrikaans: "af", albanian: "sq", amharic: "am", arabic: "ar",
  armenian: "hy", azerbaijani: "az", basque: "eu", belarusian: "be", bengali: "bn",
  bosnian: "bs", bulgarian: "bg", catalan: "ca", cebuano: "ceb", chinese: "zh",
  corsican: "co", croatian: "hr", czech: "cs", danish: "da", dutch: "nl",
  esperanto: "eo", estonian: "et", finnish: "fi", french: "fr", frisian: "fy",
  galician: "gl", georgian: "ka", german: "de", greek: "el", gujarati: "gu",
  haitian_creole: "ht", hausa: "ha", hawaiian: "haw", hebrew: "he", hindi: "hi",
  hmong: "hmn", hungarian: "hu", icelandic: "is", igbo: "ig", indonesian: "id",
  irish: "ga", italian: "it", japanese: "ja", javanese: "jv", kannada: "kn",
  kazakh: "kk", khmer: "km", kinyarwanda: "rw", korean: "ko", kurdish: "ku",
  kyrgyz: "ky", lao: "lo", latin: "la", latvian: "lv", lithuanian: "lt",
  luxembourgish: "lb", macedonian: "mk", malagasy: "mg", malay: "ms", malayalam: "ml",
  maltese: "mt", maori: "mi", marathi: "mr", mongolian: "mn", myanmar: "my",
  nepali: "ne", norwegian: "no", nyanja: "ny", oromo: "or", pashto: "ps",
  persian: "fa", polish: "pl", portuguese: "pt", punjabi: "pa", romanian: "ro",
  russian: "ru", samoan: "sm", scots_gaelic: "gd", serbian: "sr", sesotho: "st",
  shona: "sn", sindhi: "sd", sinhala: "si", slovak: "sk", slovenian: "sl",
  somali: "so", spanish: "es", sundanese: "su", swahili: "sw", swedish: "sv",
  tagalog: "tl", tajik: "tg", tamil: "ta", tatar: "tt", telugu: "te",
  thai: "th", turkish: "tr", turkmen: "tk", ukrainian: "uk", urdu: "ur",
  uyghur: "ug", uzbek: "uz", vietnamese: "vi", welsh: "cy", xhosa: "xh",
  yiddish: "yi", yoruba: "yo", zulu: "zu"
};
