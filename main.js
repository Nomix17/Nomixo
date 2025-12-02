import {BrowserWindow, app, nativeTheme, ipcMain, protocol} from "electron";
import WebTorrent from 'webtorrent';
import crypto from "crypto";
import dotenv from "dotenv";
import http from 'http';
import path from "path";
import fs from 'fs';
import { fileURLToPath} from "url";

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
const SettingsFilePath = path.join(__configs, 'settings.json');
const ThemeFilePath = path.join(__configs, 'Theme.css');
const libraryFilePath = path.join(__configs, "library.json");
const downloadLibraryFilePath = path.join(__configs, "downloads.json");
const postersDirPath = path.join(__configs,"posters");
let defaultDownloadDir = path.join(__configs,"Downloads");
const subDirectory="/tmp/tempSubs";

// ======================= TORRENT TRACKING =======================
const DownloadingTorrents = {};
const DownloadClient = new WebTorrent();

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

  if(!fs.existsSync(defaultDownloadDir)){
    fs.mkdirSync(defaultDownloadDir, { recursive: true });
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

// ======================= SETTINGS & THEME =======================

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
  fs.writeFile(SettingsFilePath, JSON.stringify(SettingsObj, null, 2), (err) => {
    if(err) console.error(err)
  });
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

// ======================= NAVIGATION =======================

ipcMain.handle("go-back",(event)=>{
  const webContents = event.sender;
  if(webContents.navigationHistory.canGoBack()){
    if(StreamClient) StreamClient.destroy();
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

// ======================= VIDEO STREAMING =======================

let StreamClient;

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

// ======================= TORRENT DOWNLOADING =======================

function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
}

ipcMain.handle("download-torrent", (event, torrentsInformation) => {
  torrentsInformation.forEach((torrentInfo) => {
    
    // Determine download path before generating torrentId
    let userDownloadPath = torrentInfo?.userDownloadPath;
    if (userDownloadPath) {
      defaultDownloadDir = userDownloadPath;
    }
    
    const TorrentDownloadDir = path.join(defaultDownloadDir, torrentInfo.dirName);
    fs.mkdirSync(TorrentDownloadDir, { recursive: true });
    
    // Include download path in hash to handle same content to different locations
    const torrentId = generateUniqueId(`${torrentInfo.IMDB_ID}-${torrentInfo.episodeNumber ?? "undefined"}-${torrentInfo.seasonNumber ?? "undefined"}-${TorrentDownloadDir}`);
    
    // Add torrent with custom download path to avoid /tmp
    const torrent = DownloadClient.add(torrentInfo.MagnetLink, {
      path: TorrentDownloadDir
    });

    DownloadingTorrents[torrentId] = torrent;

    torrent.on("ready", () => {
      const totalSize = torrent.length;
      let LibraryStartTime = 0;
      let PipingStartTime = 0;
      const DelayBeforeLibrarySave = 1000; // ms
      const DelayBeforePiping = 400; // ms

      torrent.on("download", () => {
        const now = Date.now();
        const downloadedDataLength = torrent.downloaded;

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
          
          return;
        }

        // Add changes to the library every x ms
        if (now - LibraryStartTime >= DelayBeforeLibrarySave) {
          updateElementDownloadLibrary(torrentInfo, downloadedDataLength);
          LibraryStartTime = now;
        }

        if (now - PipingStartTime >= DelayBeforePiping) {
          const jsonMessage = {
            TorrentId: torrentId,
            Downloaded: downloadedDataLength,
            Total: totalSize,
            DownloadPath: TorrentDownloadDir,
            Status: "downloading"
          };

          win.webContents.send("download-progress-stream", jsonMessage);
          PipingStartTime = now;

          console.log(`Downloading ${torrentInfo.dirName}: ${((downloadedDataLength / totalSize) * 100).toFixed(2)}%`);
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
    });
  });
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
  if (!torrent || !torrent.files) return { status: "not found", torrentId };

  torrent._paused = torrent._paused || false;

  if (torrent._paused) {
    torrent.files.forEach(file => file.select()); // resume downloading
    torrent._paused = false;
    console.log("Resume");
    return { status: "resumed", torrentId };
  } else {
    torrent.files.forEach(file => file.deselect()); // pause downloading
    torrent._paused = true;
    console.log("Pause");
    return { status: "paused", torrentId };
  }
});

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

async function downloadPoster(posterUrl){
  if(!posterUrl) return "undefined";
  const res = await fetch(posterUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  if(!fs.existsSync(postersDirPath))
    fs.mkdirSync(postersDirPath,{recursive:true});
  const file = path.join(postersDirPath, path.basename(posterUrl));
  fs.writeFileSync(file, buffer);
  return file;
}

async function updateElementDownloadLibrary(torrentInfo, downloadedBytes) {
  let downloadLib = await loadDownloadLibrary();

  // Find existing entry or create new one
  const existingIndex = downloadLib.downloads.findIndex(
    item => item.torrentId === torrentInfo.torrentId
  );
  
  
  if (existingIndex !== -1) {
    downloadLib.downloads[existingIndex]["Downloaded"] = downloadedBytes;
    downloadLib.downloads[existingIndex]["typeOfSave"] = torrentInfo.Status === "done" ? "Download-Complete" : "Download"

  } else {
    let posterPath = await downloadPoster(torrentInfo?.posterUrl);
    let newEntry = {...torrentInfo,posterPath: posterPath ?? "undefined"};
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

ipcMain.handle("get-full-video-path",async(event,dirPath,fileName)=>{
  return await findFile(dirPath,fileName);
});

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

// ======================= LIBRARY MANAGEMENT =======================

ipcMain.on("add-to-lib", async (event,mediaInfo)=>{
  let LibraryInfo = getLibraryInfo(); 
  LibraryInfo.media.push(mediaInfo); 
  await insertNewInfoToLibrary(libraryFilePath,LibraryInfo);
  return "";
});

ipcMain.on("remove-from-lib", async (event,mediaInfo) => {
  let LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(element => !(parseInt(element.MediaId) == parseInt(mediaInfo.MediaId) && element.MediaType == mediaInfo.MediaType));
  await insertNewInfoToLibrary(libraryFilePath,LibraryInfo);
  return "";
});

ipcMain.handle("load-from-lib", (event, targetIdentification)=>{
    let LibraryInfo = getLibraryInfo();
    if(LibraryInfo.media.length){
      if(targetIdentification == undefined) return LibraryInfo.media;
      let targetLibraryInfo = LibraryInfo.media.filter(element => element.MediaId == targetIdentification.MediaId && element.MediaType == targetIdentification.MediaType);
      if(targetLibraryInfo.length) return targetLibraryInfo; 
      return undefined;
    }else{
      return undefined;
    }
});

ipcMain.handle("load-from-download-lib",async(event,targetIdentification)=>{
  let wholeDownloadLibrary = await loadDownloadLibrary();
  return wholeDownloadLibrary;
});

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
