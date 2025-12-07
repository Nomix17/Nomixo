import {BrowserWindow, app, nativeTheme, ipcMain, protocol} from "electron";
import downloadMultiple from "./downloadSubtitles.js";
import { spawn } from "child_process";
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

const subDirectory="/tmp/tempSubs";
const postersDirPath = path.join(__configs,"posters");
let defaultDownloadDir = path.join(__configs,"Downloads");

const mpvConfigDirectory = path.join(__configs, 'mpvConfigs');
const SubConfigFile = path.join(mpvConfigDirectory, 'mpv.conf');

initializeDataFiles();

// ======================= GLOBALS =======================

let win;
let server;
let mpv;
let dontPlay = false; 
let closeWindow = true;
let mainzoomFactor = 1;
let subsPaths;
let torrentInit;
nativeTheme.themeSource = "dark";

// torrent trackers
const DownloadingTorrents = {};
let StreamClient;
const DownloadClient = new WebTorrent();
let lastSecondBeforeQuit=0;

// ======================= WINDOW MANAGER =======================

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
  
  let defaultSettings = loadSettings();
  mainzoomFactor = defaultSettings.PageZoomFactor;
  let settingDefaultDownloadingPath = defaultSettings?.defaultDownloadPath;
  if(settingDefaultDownloadingPath !== undefined)
    defaultDownloadDir = settingDefaultDownloadingPath;

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(mainzoomFactor);
    win.maximize();
    win.show();
  });
}

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
  if(fs.existsSync(subDirectory))
    fs.readdirSync(subDirectory).forEach(file => {fs.unlinkSync(path.join(subDirectory,file))});

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

ipcMain.handle("go-back",(event)=>{
  const webContents = event.sender;
  if(webContents.navigationHistory.canGoBack()){
    if(StreamClient) StreamClient.destroy();
    webContents.navigationHistory.goBack();
  }
  if(mpv) mpv.kill();
  if(win && !win.isVisible()) win.show();
  console.log("Go Back was Pressed");
});

ipcMain.handle("change-page", (event,page) => {
  if (win) {
    const webContents = event.sender;
    const [filePath, query] = page.split('?');
    const fullPath = path.join(__dirname, filePath);
    webContents.setZoomFactor(mainzoomFactor);
    const url = `file://${fullPath}${query ? '?' + query : ''}`;
    win.loadURL(url);
  }
});

ipcMain.handle("request-fullscreen",()=>{
  if (!win) return undefined;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

ipcMain.handle("get-full-video-path",async(event,dirPath,fileName)=>{
  return await findFile(dirPath,fileName);
});

ipcMain.handle("get-api-key",() => process.env.API_KEY);

// ======================= VIDEO STREAMING =======================

ipcMain.handle('get-video-url', async (event, magnet) => {
  return new Promise((resolve, reject) => {
    const client = new WebTorrent();
    const torrent = client.add(magnet);
    StreamClient = torrent;
    torrent.on('ready', () => {
      const file = torrent.files.find(f =>
        (f.name.endsWith('.mp4') ||
         f.name.endsWith('.webm') ||
         f.name.endsWith('.mkv')) && f.length / (10 ** 9) > 0.5
      );

      if (!file) {
        reject('No video file found in torrent');
        return;
      }

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
  return new Promise((resolve, reject) => {
    const client = new WebTorrent();
    const torrent = client.add(metaData.Magnet, (torrent) => {
      StreamClient = torrent;
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
        
          let currentMediaFromLibrary = await loadFromLibrary({MediaId:metaData.MediaId,MediaType:metaData.MediaType});
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

            updateLastSecondBeforeQuit(lastSecondBeforeQuit,metaData)
            mpv.stdout.off('data', hideMainWindow);
            mpv.stderr.off('data', hideMainWindow);

            subsPaths.forEach(file => {fs.unlinkSync(file)});
            const webContents = event.sender;
            if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
            if (win) win.show();
            mpv = null;
          });
          mpv.stdout.on('data', hideMainWindow);
          mpv.stderr.on('data', hideMainWindow);

          mpv.on("error", err => {
              server.close();
              torrent.destroy();
              reject(err);
          });

          resolve(null);
        }catch(error){console.error(error.message)};
      });
    });
  });
});

ipcMain.handle('play-video-over-mpv', async(event,metaData) => {
  try{
    let videoFullPath = await findFile(metaData.downloadPath, metaData.fileName) ;
    let currentMediaFromLibrary = await loadFromLibrary({MediaId:metaData.MediaId,MediaType:metaData.MediaType});
    let startFromTime;

    if(currentMediaFromLibrary == undefined || 
      currentMediaFromLibrary[0].episodeNumber != metaData.episodeNumber ||
      currentMediaFromLibrary[0].seasonNumber != metaData.seasonNumber)
        startFromTime = 0;

    else startFromTime = currentMediaFromLibrary[0].lastPlaybackPosition;

    let subsPaths = await loadSubsFromSubDir(metaData.downloadPath,metaData.TorrentId);
    let subsArgument = subsPaths.map(path => `--sub-file=${path.replaceAll(" ","\ ")}`);

    let childProcessArguments = [videoFullPath, `--config-dir=${mpvConfigDirectory}`,`--start=${startFromTime}`,...subsArgument];

    mpv = spawn('mpv', childProcessArguments);
    mpv.on('close', () => {
      console.log('Playback finished');
      updateLastSecondBeforeQuit(lastSecondBeforeQuit,metaData)
      mpv.stdout.off('data', hideMainWindow);
      mpv.stderr.off('data', hideMainWindow);

      const webContents = event.sender;
      if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
      if (win) win.show();
      mpv = null;
    });
    mpv.stdout.on('data', hideMainWindow);
    mpv.stderr.on('data', hideMainWindow);

  }catch(err){
    console.error(err);
  }
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

      try {
        downloadSubs(subsObjects, torrentId, TorrentDownloadDir);
      } catch (error) {
        console.error(error);
      }

      try {
        await downloadTorrent(torrentInfo, torrentId, TorrentDownloadDir);
        results.push({ success: true, torrentId });
      } catch (error) {
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

ipcMain.handle("cancel-torrent-download", async (event, mediaInfo) => {
  const torrentId = mediaInfo.torrentId;
  const targetTorrent = DownloadingTorrents?.[torrentId];
  
  if (targetTorrent) {
    await new Promise((resolve) => {
      targetTorrent.destroy(() => {
        delete DownloadingTorrents[torrentId];
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
  const torrent = DownloadingTorrents[torrentId];
  if (!torrent){
    let wholeDownloadLibrary = await loadDownloadLibrary();

    if(wholeDownloadLibrary.downloads.length){
      let torrentInfo = wholeDownloadLibrary.downloads.find(element => element.torrentId === torrentId);
      let TorrentDownloadDir = torrentInfo.downloadPath;
      downloadTorrent(torrentInfo, torrentId, TorrentDownloadDir);

      return { status: "continued", torrentId };

    }else{
      console.error("Empty download library, cannot continue download for",torrentId);
      return { status: "empty download library",torrentId };
    }

  }else{
    await new Promise((resolve) => {
      torrent.destroy(() => {
        delete DownloadingTorrents[torrentId];
        console.log(`Torrent Paused: ${torrentId}`);
        resolve();
      });
    });

    return { status: "paused", torrentId };
  }

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

ipcMain.handle("load-from-download-lib",async(event,targetIdentification)=>{
  let wholeDownloadLibrary = await loadDownloadLibrary();
  return wholeDownloadLibrary;
});


// ################# functions ######################## 

// ########## library related #################

function loadSettings() {
  try {
    const data = fs.readFileSync(SettingsFilePath, 'utf-8');
    if(data.trim() == "" || !("TurnOnSubsByDefaultInternal" in JSON.parse(data))) throw new Error("empty Settings File");
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
    let linesArray = savedTheme.split("\n").filter(line => line != "");
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

async function removeFromDownloadLibrary(torrentId){
  let downloadLib = await loadDownloadLibrary();
  downloadLib.downloads = downloadLib.downloads.filter(element => (element.torrentId !== torrentId));
  insertNewInfoToLibrary(downloadLibraryFilePath, downloadLib);
}

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

function loadDownloadLibrary(){
  try { 
    return JSON.parse(fs.readFileSync(downloadLibraryFilePath, "utf-8")); 
  } catch { 
    return { downloads: [] }; 
  }
}

function initializeDataFiles(){
  if(!fs.existsSync(__configs)){
    fs.mkdirSync(__configs, { recursive: true });
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

// ########## dowload related #################

function downloadSubs(subsObjects, torrentId, TorrentDownloadDir) {
  // Download subtitles
  if (subsObjects.length) {
    try {
      let subDownloadDir = path.join(TorrentDownloadDir, `SUBS_${torrentId}`);
      fs.mkdirSync(subDownloadDir, { recursive: true });
      downloadMultiple(subDownloadDir, subsObjects);
    } catch (err) {
      console.error("Subtitle download error:", err);
    }
  }
}

async function downloadTorrent(torrentInfo, torrentId, TorrentDownloadDir) {
  // Add torrent
  const torrent = DownloadClient.add(torrentInfo.MagnetLink, {
    path: TorrentDownloadDir
  });

  DownloadingTorrents[torrentId] = torrent;

  // Wait for torrent to be ready before accessing files
  return new Promise((resolve, reject) => {
    console.log("Loading Torrent:", torrentId);
    torrent.on("ready", () => {
      const subtitlesExt = ['.srt', '.ass', '.sub', '.vtt'];
     
      console.log("\nDownload Target: " + torrentInfo?.fileName);

      console.log("\nTorrent Files:-----------------------------------------------------");
      torrent.files.forEach(f => { console.log(f.name) });
      console.log("-------------------------------------------------------------------\n");

      const files = torrent.files.filter(f =>
        f.name.toLowerCase().trim() === torrentInfo?.fileName.toLowerCase().trim() ||
        subtitlesExt.some(ext => f.name.toLowerCase().endsWith(ext))
      );

      if (!files.length) {
        reject(new Error('No suitable video file found'));
        return;
      }

      // Deselect all files first
      torrent.files.forEach(file => { file.deselect() });
      
      // Select only the files that match our criteria
      files.forEach(file => { file.select() });

      // Calculate total size of only selected files
      const totalSize = files.reduce((sum, file) => sum + file.length, 0);
      let LibraryStartTime = 0;
      let PipingStartTime = 0;
      const DelayBeforeLibrarySave = 1000;
      const DelayBeforePiping = 400;

      torrent.on("download", () => {
        const now = Date.now();
        // Calculate downloaded bytes for selected files only
        const downloadedDataLength = files.reduce((sum, file) => sum + file.downloaded, 0);

        torrentInfo["torrentId"] = torrentId;
        torrentInfo["downloadPath"] = TorrentDownloadDir;
        torrentInfo["Total"] = totalSize;
        torrentInfo["Downloaded"] = downloadedDataLength;
        torrentInfo["poster"] = torrentInfo.posterUrl;

        // Check if download is complete
        if (totalSize <= downloadedDataLength) {
          const jsonMessage = {
            TorrentId: torrentId,
            Downloaded: downloadedDataLength,
            Total: totalSize,
            DownloadPath: TorrentDownloadDir,
            Status: "done"
          };
          
          torrentInfo["Status"] = "done";
          updateElementDownloadLibrary(torrentInfo, downloadedDataLength);
          
          win.webContents.send("download-progress-stream", jsonMessage);
          
          torrent.destroy(() => {
            delete DownloadingTorrents[torrentId];
            console.log(`Torrent cleaned up: ${torrentId}`);
          });
          
          resolve();
          return;
        }

        // Update library periodically
        if (now - LibraryStartTime >= DelayBeforeLibrarySave) {
          updateElementDownloadLibrary(torrentInfo, downloadedDataLength);
          LibraryStartTime = now;
        }

        // Send progress updates
        if (now - PipingStartTime >= DelayBeforePiping) {
          const downloadSpeed = torrent.downloadSpeed; // b/s

          const jsonMessage = {
            TorrentId: torrentId,
            Downloaded: downloadedDataLength,
            Total: totalSize,
            DownloadPath: TorrentDownloadDir,
            DownloadSpeed:downloadSpeed,
            Status: "downloading"
          };

          win.webContents.send("download-progress-stream", jsonMessage);
          PipingStartTime = now;

          console.log(`Downloading ${torrentInfo.dirName}: ${((downloadedDataLength / totalSize) * 100).toFixed(2)}%, ${(downloadSpeed / (1024)).toFixed(2)} Kb/s`);
        }
      });
    });

    torrent.on("error", (err) => {
      console.error(`Torrent error: ${torrentId}, ${err}`);
      
      win.webContents.send("download-progress-stream", {
        TorrentId: torrentId,
        Status: "error",
        Error: err.message
      });
      
      reject(err);
    });
  });
}

function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
}

async function downloadImage(downloadDir, posterUrl) {
  try {
    if (!posterUrl) return "undefined";

    const res = await fetch(sanitizeUrl(posterUrl));
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const file = path.join(downloadDir, path.basename(posterUrl));
    fs.writeFileSync(file, buffer);

    return file;
  } catch (error) {
    console.error("Download failed:", error.message);
    return null;
  }
}

async function updateElementDownloadLibrary(torrentInfo, downloadedBytes) {
  let downloadLib = await loadDownloadLibrary();

  // Find existing entry or create new one
  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentInfo.torrentId
  );
  
  
  if(existingIndex !== -1){
    downloadLib.downloads[existingIndex]["Downloaded"] = downloadedBytes;
    downloadLib.downloads[existingIndex]["typeOfSave"] = torrentInfo.Status === "done" ? "Download-Complete" : "Download"
    if(torrentInfo.Status === "done")
      downloadLib.downloads[existingIndex]["Status"] = "done";
  }else{
    // let bgImagePath = "";
    // let posterPath = "";
    let bgImagePath = await downloadImage(postersDirPath,torrentInfo?.bgImageUrl)
    let posterPath = await downloadImage(postersDirPath,torrentInfo?.posterUrl);

    console.log("Creating Download Library Entry Point for: "+torrentInfo.torrentId);
    let newEntry = {...torrentInfo,posterPath: posterPath ?? "undefined",bgImagePath: bgImagePath ?? "undefined"};
    downloadLib.downloads.push(newEntry);
  }

  insertNewInfoToLibrary(downloadLibraryFilePath, downloadLib);
}

async function removeFromLibrary(mediaInfo) {
  let LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(
    element => element.torrentId !== mediaInfo.torrentId
  );
  insertNewInfoToLibrary(libraryFilePath, LibraryInfo);
}

function findFile(dir, filename) {
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
  }
  return null;
}

function sanitizeUrl(urlString) {
    const u = new URL(encodeURI(urlString));
    u.pathname = u.pathname.replace(/\/{2,}/g, "/");
    return u.toString();
}

// ############ mpv Player related ############

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

function updateLastSecondBeforeQuit(lastPbPosition,metaData){
  const LibraryInfo = getLibraryInfo();
  let found = false;

  LibraryInfo.media ??= [];

  for(let [index,item] of Object.entries(LibraryInfo.media)){
    if(item["MediaId"] == metaData.MediaId && item["MediaType"] == metaData.MediaType){
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

function loadSubsFromSubDir(downloadPath,TorrentId){
  try{
    let subFolder = path.join(downloadPath,`SUBS_${TorrentId}`);
    return fs.readdirSync(subFolder).map(fileName => path.join(subFolder,fileName));
  }catch(err){
    console.error(err.message);
    return [];
  }
}
