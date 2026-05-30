import {BrowserWindow, app, nativeTheme, ipcMain, protocol, dialog, shell, screen, Notification} from "electron";
import Store from 'electron-store';
import SubDownloadManager from "./SubDownloadManager.js";
import TorrentDownloadManager from "./TorrentDownloadManager.js";
import {Paths, FilesManager} from "./FilesManager.js";
import { 
  generateUniqueId,
  normaliseFileName, findFile,
  sendSystemNotification,
  downloadImage
} from './utils.js';

import {
  loadDownloadStorage,
  loadLibraryStorage,
  editDownloadStorageEntry,
  getLibraryEntry,
  overwriteStorageFile,
} from "./storageManagement.js";

import {log} from "./debugging.js";
import {spawn} from "child_process";
import {Worker} from 'worker_threads';
import WebTorrent from 'webtorrent';
import crypto from "crypto";
import dotenv from "dotenv";
import http from 'http';
import path from "path";
import os from 'os';
import fs from 'fs';

let TMDB_API_KEY = null;
let Wyzie_API_KEY = null;

dotenv.config({path:Paths.__envfile});

let torrentDownloadManager = null;
FilesManager.initializeDataFiles();

let WINDOW;
const store = new Store();
let server;
let mpv = null;
let MPVWorker = null;
let dontPlay = false; 
let closeWindow = true;
let InVideoPlayerPage = false;
let mainzoomFactor = 0.92;
let pagesCachedHistory = {};
nativeTheme.themeSource = "dark";

// torrent trackers
let StreamClient;
let lastSecondBeforeQuit=0;

// ======================= WINDOW MANAGER =======================

if (!process.env.TMDB_API_KEY) {
  log.warn(`Missing TMDB API key. Please set TMDB_API_KEY in your environment. or Add it to the file ${Paths.__envfile}`);
  openMainWindow("./src/pages/loginPage/loginPage.html");

} else {
  TMDB_API_KEY = process.env.TMDB_API_KEY;
  Wyzie_API_KEY = process.env.Wyzie_API_KEY;
  initAppIdentity()
  openMainWindow();
}

function initAppIdentity() {
  app.setAppUserModelId("com.nomixo.app");
  app.setName("Nomixo");
}

function openMainWindow(fileEntryPoint = "./src/pages/homePage/homePage.html") {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (WINDOW?.isMinimized()) WINDOW.restore();
    WINDOW?.focus();
  });

  app.on("ready", () => {
    protocol.handle("theme", async () => {
      const css = await fs.promises.readFile(Paths.ThemeFilePath, "utf8");
      return new Response(css, {
        headers: { "content-type": "text/css", "cache-control": "no-store" },
      });
    });

    createMainWindow(fileEntryPoint);
    // On crash, "window-all-closed" is never fired, so downloads won't be marked as paused.
    // Call here to ensure they appear correctly on next launch.
    markMediaDownloadsAsPaused();
  });

  app.on("window-all-closed", async () => {
    if (closeWindow) app.quit();
    await markMediaDownloadsAsPaused();
  });
}


const createMainWindow = async (entryPointPath = "./src/pages/homePage/homePage.html") => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let { width, height, x, y, isMaximized } = store.get('windowBounds') || {
    width: Math.floor(screenWidth * 0.8),
    height: Math.floor(screenHeight * 0.8),
    isMaximized: false
  };

  WINDOW = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    webPreferences: {
      preload: path.join(Paths.__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  torrentDownloadManager = new TorrentDownloadManager(WINDOW)

  WINDOW.setMenuBarVisibility(false);
  WINDOW.loadFile(entryPointPath);

  const defaultSettings = await loadSettings();
  mainzoomFactor = defaultSettings.PageZoomFactor;
  let settingDefaultDownloadingPath = defaultSettings?.defaultDownloadPath;
  if (settingDefaultDownloadingPath != null)
    Paths.defaultSystemDownloadDir = settingDefaultDownloadingPath;

  WINDOW.once('ready-to-show', () => {
    WINDOW.webContents.setZoomFactor(mainzoomFactor);
    if (isMaximized) WINDOW.maximize();
    WINDOW.show();
  });

  WINDOW.on('close', () => {
    store.set('windowBounds', {
      ...WINDOW.isMaximized() ? store.get('windowBounds') : WINDOW.getBounds(),
      isMaximized: WINDOW.isMaximized()
    });
  });
}

// ======================= IPC HANDLERS =======================

//      ================ SETTINGS & THEME ================

ipcMain.handle("load-settings", async () => {
  try {
    return await loadSettings();
  } catch {
    throw new Error("Something Went Wrong When Loading Settings!");
  }
});

ipcMain.handle("load-theme",()=>{
  try {
    return loadTheme();
  } catch {
    throw new Error("Something Went Wrong When Loading Theme!");
  }
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
  fs.writeFileSync(Paths.SettingsFilePath, JSON.stringify(FullSettings, null, 2), (err) => {
    if(err) log.error(err)
    return err;
  });
  return null
});

ipcMain.on("apply-theme",(event, ThemeObj) =>{
  let formatedThemeObj = ThemeObj.theme.map(obj=>`${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`);

  let themeFileContent = `:root{
    ${formatedThemeObj.join(";\n")}
  ;}`;

  fs.writeFile(Paths.ThemeFilePath,themeFileContent, (err)=>{
    if(err) log.error(err)
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

ipcMain.handle("go-back",(event,currentPageURL)=>{
  NavigateToPreviousPage();
  deletePageCachedDataFromHistory(currentPageURL);
});

ipcMain.on("change-page", (event,newPageURL,currentPageURL,cacheData) => {
  if (WINDOW) {
    const webContents = event.sender;
    const [filePath, query] = newPageURL.split('?');
    const fullPath = path.join(Paths.__dirname, filePath);
    const url = `file://${fullPath}${query ? '?' + query : ''}`;
    savePageCachedDataToHistory(currentPageURL,cacheData);

    if(currentPageURL.includes("loginPage")){
      const clearOnLoad = () => {
        webContents.navigationHistory.clear();
        webContents.removeListener('did-finish-load', clearOnLoad);
      };
      webContents.once('did-finish-load', clearOnLoad);
    }

    const setZoomAfterLoad = () => {
      webContents.setZoomFactor(mainzoomFactor);
      webContents.removeListener('did-finish-load', setZoomAfterLoad);
    };
    webContents.once('did-finish-load', setZoomAfterLoad);

    WINDOW.loadURL(url);
    positionWasChangedViaGoBackButton = false;
  }
});

ipcMain.handle("request-fullscreen",()=>{
  if (!WINDOW) return undefined;
  WINDOW.setFullScreen(!WINDOW.isFullScreen());
  return WINDOW.isFullScreen();
});

ipcMain.handle("get-fullscreen-status",(event)=>{
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isFullScreen() : false;
});

ipcMain.handle("get-full-video-path",async(event,dirPath,fileName)=>{
  return await findFile(dirPath,fileName);
});

ipcMain.handle("open-directory-filesystem-browser",async(event,currentPath)=>{
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: currentPath
  });
  if (!canceled) {
    return filePaths[0];
  }
  return null
});

ipcMain.handle("open-file-filesystem-browser",async(event,currentPath)=>{
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: currentPath
  });
  if (!canceled) {
    return filePaths[0];
  }
  return null
});

ipcMain.handle("open-external-link",(event,url)=>{
  shell.openExternal(url);
});

ipcMain.handle("get-tmdb-api-key",() => TMDB_API_KEY);
ipcMain.handle("get-wyzie-api-key",() => Wyzie_API_KEY);

ipcMain.handle("validate-tmdb-api-key",async(event, inputedApiKey)=>{
  let responce = await validateTMDBApiKey(inputedApiKey);
  return responce;
});

ipcMain.handle("validate-wyzie-api-key",async(event, inputedApiKey)=>{
  let responce = await validateWyzieApiKey(inputedApiKey);
  return responce;
});

ipcMain.handle("save-api-key",async(event,apiKeys)=>{
  TMDB_API_KEY = apiKeys["TMDB_API_KEY"];
  Wyzie_API_KEY = apiKeys["Wyzie_API_KEY"];
  try {
    await FilesManager.writeAPIKEYIntoEnvFile(apiKeys);
  } catch(err) {
    log.error(err.message);
    return false;
  }
  return true;
});

// ======================= VIDEO STREAMING =======================

ipcMain.handle('get-video-url', async (event, magnet,fileName) => {
  return new Promise((resolve, reject) => {
    InVideoPlayerPage = true;

    log.info("Loading Torrent:",fileName);
    if (!fs.existsSync(Paths.videoCachePath)) {
      fs.mkdirSync(Paths.videoCachePath, { recursive: true });
    }
    const client = new WebTorrent();
    const torrent = client.add(magnet,{path: Paths.videoCachePath});
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
  const startFromTime = await getLastestPlayBackPostion(metaData);

  const [ windowWidth, windowHeight ] = WINDOW.getSize()
  const [ windowPosX, windowPosY ] = WINDOW.getPosition()
  const windowIsFullScreened = WINDOW.isFullScreen();
  const windowIsMaximized = WINDOW.isMaximized();
  const windowGeometry =
    windowIsFullScreened || windowIsMaximized
      ? "70%x70%"
      : `${windowWidth}x${windowHeight}+${windowPosX}+${windowPosY}`;

  const { MpvExecPath } = await loadSettings();
  MPVWorker = new Worker(Paths.MPVPlayerWorkerPath, {
    workerData: {
      MpvExecPath: MpvExecPath,
      typeOfPlay:"StreamTorrent",
      metaData,
      subsObjects,
      startFromTime,
      videoCachePath: Paths.videoCachePath,
      subDirectory: Paths.subDirectory,
      mpvConfigDirectory: Paths.mpvConfigDirectory,
      mpvWindowConfigs: {
        geometry: windowGeometry,
        fullscreened: windowIsFullScreened,
        maximized: windowIsMaximized
      }
    },
    type: 'module'
  });

  handleMpvWorker(metaData);
  InVideoPlayerPage = true;
});

ipcMain.handle('play-video-over-mpv', async(event,metaData) => {
  playVideoOverMpv(metaData);
});

// ======================= TORRENT DOWNLOADING =======================

ipcMain.handle("download-torrent", async (event, torrentsEntries, subsObjects) => {
  return torrentDownloadManager.scheduleTorrentDownloads(torrentsEntries, subsObjects);
});

ipcMain.handle("download-subtitles", async(event, torrentEntry, subsObjects) => {
  try {
    await SubDownloadManager.downloadSubs(subsObjects, torrentEntry.torrentId, torrentEntry.downloadPath);
  } catch(err) {
    log.error("Failed To Download Subtitles", torrentEntry.torrentId + ":", err.message);
    return {updated:false};
  }
  return {updated:true};
});

ipcMain.handle("pause-torrent-download", async (event, torrentId) => {
  return await torrentDownloadManager.pauseTorrentDownload(torrentId);
});

ipcMain.handle("continue-torrent-download", async (event, torrentId) => {
  return await torrentDownloadManager.continueTorrentDownload(torrentId);
});

ipcMain.handle("toggle-torrent-download", async (event, torrentId) => {
  console.log(torrentId);
  return await torrentDownloadManager.toggleTorrentDownload(torrentId);
});

ipcMain.handle("cancel-torrent-download", async (event, mediaInfo) => {
  return await torrentDownloadManager.cancelTorrentDownload(mediaInfo);
});

ipcMain.handle("add-torrent-to-download-queue", async (event, torrentId) => {
  return torrentDownloadManager.downloadOrQueueTorrent(torrentId);
});

ipcMain.handle("remove-torrent-from-download-queue", async (event, torrentId) => {
  return torrentDownloadManager.removeTorrentFromQueue(torrentId);
});

ipcMain.handle("shift-download-queue-element", (event, torrentId, offset) => {
  return torrentDownloadManager.shiftQueuedElement(torrentId, offset);
});

ipcMain.handle("get-download-queue-list", (event) => {
  return torrentDownloadManager.downloadQueue
    .map(el => el.torrentId);
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
  const LibraryInfo = loadLibraryStorage();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  LibraryInfo.media.push(mediaInfo);
  overwriteStorageFile(Paths.libraryFilePath,LibraryInfo);
});

ipcMain.on("remove-from-lib", (event, mediaInfo) => {
  const LibraryInfo = loadLibraryStorage();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType));
  overwriteStorageFile(Paths.libraryFilePath,LibraryInfo);
});

ipcMain.on("edit-element-lib", async (event, mediaInfo) => {
  const LibraryInfo = await loadLibraryStorage();
  let elementIndex = LibraryInfo.media.findIndex(
    e => e.MediaId.toString() === mediaInfo.MediaId.toString() &&
         e.MediaType === mediaInfo.MediaType
  );
  if(elementIndex !== -1) {
    for(let [key, value] of Object.entries(mediaInfo)) {
      LibraryInfo.media[elementIndex][key] = value;
    }
    overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
  }
});

ipcMain.handle("load-from-lib", (event, targetIdentification) => {
  return getLibraryEntry(targetIdentification);
});

// ############################## DOWNLOAD LIBRARY MANAGEMENT ##############################

ipcMain.on("add-to-download-lib", async(event, torrentId, mediaInfo) => {
  const downloadLibraryInfo = await loadDownloadStorage();
  downloadLibraryInfo.downloads = downloadLibraryInfo.downloads.filter(e => !(e.torrentId === torrentId));
  downloadLibraryInfo.downloads.push(mediaInfo);
  await overwriteStorageFile(Paths.downloadLibraryFilePath,downloadLibraryInfo);
  return null;
});

ipcMain.on("remove-from-download-lib", async(event, torrentId) => {
  const downloadLibraryInfo = await loadDownloadStorage();
  downloadLibraryInfo.downloads = downloadLibraryInfo.downloads.filter(e => !(e.torrentId === torrentId));
  await overwriteStorageFile(Paths.downloadLibraryFilePath,downloadLibraryInfo);
  return null;
});

ipcMain.handle("edit-download-lib", async(event, torrentId, key, value) => {
  await editDownloadStorageEntry([torrentId],key,value);
  return null;
});

ipcMain.handle("load-from-download-lib",async(event,targetIdentification)=>{
  let wholeDownloadLibrary = await loadDownloadStorage();
  return wholeDownloadLibrary;
});

// ############################## SUBTITLES FILES MANAGEMENT ##############################

ipcMain.handle("load-local-subs",async(event,videoPath,identifyingElements)=>{
  const localBuiltInSubs = await loadSubsFromVideoDirectory(videoPath);
  const localDownloadedSubs = await loadSubsFromSubDir(identifyingElements);

  return [...localBuiltInSubs, ...localDownloadedSubs];
});

ipcMain.handle("read-sub-file",async(event,filePath)=>{
  return fs.readFileSync(filePath, 'utf8');
});


// ############################## CACHE HISTORY MANAGEMENT ##############################
ipcMain.handle("load-cached-data-from-history",(event,currentPageURL)=>{
  return positionWasChangedViaGoBackButton ? loadPageCachedDataFromHistory(currentPageURL) : null;
});


// ################# SYSTEM INTERACTION MANAGEMENT ######################## 
ipcMain.on("send-system-notification", (event, options) => {
  sendSystemNotification(options);
});

// ########## SETTINGS RELATED #################
async function loadSettings() {
  try {
    const data = fs.readFileSync(Paths.SettingsFilePath, 'utf-8');
    if(data.trim() === "" || !("TurnOnSubsByDefaultInternal" in JSON.parse(data)))
      throw new Error("empty Settings File");
   
    const JData = JSON.parse(data);
    if(JData?.MpvExecPath == null || JData?.MpvExecPath.trim() == "")
      JData.MpvExecPath = await findMpvExecPath();

    return JData;
  } catch (err) {
    log.error(err.message);
    return {
      PageZoomFactor: 0.92,
      TurnOnSubsByDefaultInternal: true,
      SubFontSizeInternal: 16,
      SubFontFamilyInternal: "Montserrat",
      SubColorInternal: "#ffffff",
      SubBackgroundColorInternal: "#000000",
      SubBackgroundOpacityLevelInternal: 0,
      DefaultDownloadPath: Paths.__downloads,
      rememberDownloadLocationByDefault: true,
      DownloadSubtitlesByDefault: true,
      MpvExecPath: await findMpvExecPath()
    };
  }
}

function loadTheme() {
  try{
    let ThemeObj = {theme:[]};
    let savedTheme = fs.readFileSync(Paths.ThemeFilePath, "utf-8");
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
    log.error("Failed to Load Theme File");
    log.error(err.message);
    FilesManager.initializeDataFiles();
    return loadTheme();
  }
}

function loadSubConfigs() {
  let JsonConfig = {};
  let mpvConfig = fs.readFileSync(Paths.SubConfigFile,"utf-8");
  let lines = mpvConfig.split("\n");
  lines.forEach(line=>{
    if(!line.includes("osc") && !line.includes("border") && !line.includes("osd-bar") && !line.includes("target-colorspace-hint")){
      if(line.includes("no-sub")){
        JsonConfig["no-sub"] = true;
      }else if(line.includes("=")){
        let entitie = line.split("=");
        let value = entitie[1] === "yes" ? true : (entitie[1] === "no" ? false : entitie[1])
        JsonConfig[entitie[0]] = entitie[1];
      }
    }
  });
  if(JsonConfig?.["no-sub"] == null) JsonConfig["no-sub"] = false;
  return JsonConfig;
}

function applySubConfigs(jsonContent){
  const mpvConfig = parseMpvConfigs(jsonContent);
  fs.writeFileSync(Paths.SubConfigFile,mpvConfig);
}

function parseMpvConfigs(jsonContent) {
  let mpvConfig = "osc=yes \nborder=yes \nosd-bar=no\ntarget-colorspace-hint=no";

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
  return mpvConfig;
}



async function resolveMpvExecFromPATH() {
  const isWindows = os.platform() === 'win32';
  const whichCommand = isWindows ? 'where' : 'which';
  return new Promise((resolve) => {
    const process = spawn(whichCommand, ['mpv'], { encoding: 'utf8' });
    let stdout = '';
    process.stdout.on('data', (data) => stdout += data.toString());
    process.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        log.warn('mpv not found in PATH');
        return resolve(null);
      }
      const result = stdout.trim().split('\n')[0].trim();
      log.info(`Found mpv at: ${result}`);
      resolve(result);
    });
    process.on('error', () => {
      log.warn('mpv not found in PATH');
      resolve(null);
    });
  });
}

async function findMpvExecPath() {
  const mpvExecPath = await resolveMpvExecFromPATH();
  if (mpvExecPath) return mpvExecPath;

  const knownPaths = 
    os.platform() === 'win32' 
    ? [
      'C:\\Program Files\\mpv\\mpv.exe',
      'C:\\Program Files (x86)\\mpv\\mpv.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'mpv', 'mpv.exe'),
      path.join(os.homedir(), 'scoop', 'apps', 'mpv', 'current', 'mpv.exe'),
      'C:\\tools\\mpv\\mpv.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'mpv.exe'),
    ] 
    : [
      '/usr/bin/mpv',
      '/usr/local/bin/mpv',
      '/snap/bin/mpv',
      '/flatpak/exports/bin/mpv',
      path.join(os.homedir(), '.local/bin/mpv'),
    ];

  for (const candidate of knownPaths) {
    if (fs.existsSync(candidate)) {
      log.info(`Found mpv at: ${candidate}`);
      return candidate;
    }
  }

  log.warn(`Mpv executable Path not found anywhere`);
  return null;
}

// ############################ NAVIGATION RELATED ############################

function cleanUpVideoPlayerStuff(){
  if(StreamClient) StreamClient.destroy();
  if(mpv) mpv.kill();
  if(WINDOW && !WINDOW.isVisible()) WINDOW.show();
  if(MPVWorker && MPVWorker.threadId !== -1){
    MPVWorker.postMessage({ type: 'shutdown' });
    MPVWorker = null;
  }
}

let positionWasChangedViaGoBackButton = false;
function NavigateToPreviousPage(){
  const webContents = WINDOW.webContents;
  if(webContents.navigationHistory.canGoBack()){
    cleanUpVideoPlayerStuff();
    webContents.navigationHistory.goBack();
    positionWasChangedViaGoBackButton = true;
  }
}

function loadSubsFromSubDir(identifyingElements) {
  const torrentId = generateUniqueId(
    `${identifyingElements.IMDB_ID}-${identifyingElements.episodeNumber ?? "undefined"}-${identifyingElements.seasonNumber ?? "undefined"}-${identifyingElements.DownloadDir}`
  );

  const downloadPath = identifyingElements.DownloadDir;
  let subsDirectory = path.join(downloadPath,`SUBS_${torrentId}`);
  try {
    if(!fs.existsSync(subsDirectory)) {
      throw new Error(`Subtitles aren't downloaded in: ${subsDirectory}`);
    }
    return fs.readdirSync(subsDirectory).map(subFileName => {
      let displayName = subFileName.split("-")[0];
      return {
        url:path.join(subsDirectory,subFileName),
        display:displayName,
        languageCode:languageDict[displayName.toLowerCase()] ?? displayName,
        type:"local"
      }
    });
  } catch(err) {
    log.error(err.message);
    return [];
  }
}

function loadSubsFromVideoDirectory(videoPath) {
  let videoParentsPath = path.dirname(videoPath);
  try {
    return fs.readdirSync(videoParentsPath)
    .flatMap(subFileName => {
      const fileExtension = path.extname(subFileName);
      if (fileExtension === ".srt" || fileExtension === ".vtt") {
        const displayName = subFileName.split(fileExtension)[0];
        // const languageOfSub = displayName;
        return [{
          url: path.join(videoParentsPath, subFileName),
          display: "Built In",
          languageCode: "built-in",
          languageName: displayName,
          type: "local"
        }];
      }
      return [];
    });
  } catch(err) {
    log.warn(err);
    return[];
  }
}

// ############################ LIBRARIES RELATED ############################




async function markMediaDownloadsAsPaused() {
  let wholeDownloadLibrary = await loadDownloadStorage();
  let torrentsIds = wholeDownloadLibrary.downloads
    .filter(torrentElement => torrentElement?.Status.toLowerCase() !== "done")
    .map(torrent => torrent.torrentId);

  await editDownloadStorageEntry(torrentsIds,"Status","Paused");
}

async function getLastestPlayBackPostion(metaData){
  let CurrentMediaLibraryEntry = await getLibraryEntry({MediaId:metaData.MediaId,MediaType:metaData.MediaType});

  let startFromTime;
  if(CurrentMediaLibraryEntry == null || 
    CurrentMediaLibraryEntry[0].episodeNumber !== metaData.episodeNumber ||
    CurrentMediaLibraryEntry[0].seasonNumber !== metaData.seasonNumber)
      return 0;

  return CurrentMediaLibraryEntry[0].lastPlaybackPosition;
}

// ############################ MPV PLAYER RELATED ############################

async function playVideoOverMpv(metaData) {
  log.info(`Playing ${metaData.fileName} over Mpv`);
  const startFromTime = await getLastestPlayBackPostion(metaData);

  let subIdentifyingElements = {
    IMDB_ID:metaData.mediaImdbId,
    episodeNumber:metaData.episodeNumber,
    seasonNumber:metaData.seasonNumber,
    DownloadDir:metaData.downloadPath
  };

  const [ windowWidth, windowHeight ] = WINDOW.getSize()
  const [ windowPosX, windowPosY ] = WINDOW.getPosition()
  const windowIsFullScreened = WINDOW.isFullScreen();
  const windowIsMaximized = WINDOW.isMaximized();
  const windowGeometry =
    windowIsFullScreened || windowIsMaximized
      ? "70%x70%"
      : `${windowWidth}x${windowHeight}+${windowPosX}+${windowPosY}`;

  const subsPaths =
    (await loadSubsFromSubDir(subIdentifyingElements))
    .map(sub => sub.url);

  const { MpvExecPath } = await loadSettings();
  MPVWorker = new Worker(Paths.MPVPlayerWorkerPath, {
    workerData: {
      MpvExecPath: MpvExecPath,
      typeOfPlay:"LocalFile",
      metaData,
      startFromTime,
      subsPaths,
      mpvConfigDirectory:Paths.mpvConfigDirectory,
      mpvWindowConfigs: {
        geometry: windowGeometry,
        fullscreened: windowIsFullScreened,
        maximized: windowIsMaximized
      }
    },
    type: 'module'
  });

  handleMpvWorker(metaData);
  InVideoPlayerPage = true;
}

function handleMpvWorker(metaData) {
  let handled = false;

  const ExitVideoPlayerPage = () => {
    if (!InVideoPlayerPage) return;
    InVideoPlayerPage = false;
    updateLastSecondBeforeQuit(lastSecondBeforeQuit, metaData);
    cleanUpVideoPlayerStuff();
    WINDOW.webContents.send("msg-from-main-process", {
      type: "request",
      request: "exit_video_player"
    });
  };

  const closeWorker = () => {
    if (MPVWorker && MPVWorker.threadId !== -1) {
      MPVWorker.postMessage({ type: 'shutdown' });
      MPVWorker = null;
    }
    if (WINDOW && !WINDOW.isVisible()) WINDOW.show();
  };

  const handleError = (errorMsg) => {
    if (handled) return;
    handled = true;
    log.error("Playback/torrent error:", errorMsg);
    WINDOW.webContents.send("torrent-fetching-error", errorMsg || "Unknown error");
    closeWorker();
  };

  const handleDone = () => {
    if (handled) return;
    handled = true;
    ExitVideoPlayerPage();
    closeWorker();
  };

  MPVWorker.on('message', (msg) => {
    if (msg.type !== "status") return;

    switch (msg.message) {
      case "Mpv output data":
        handleMpvOutput(msg.data);
        break;
      case "Playback done":
        handleDone();
        break;
      case "Playback error":
      case "Torrent Fetching Error":
        handleError(msg.error);
        break;
    }
  });

  MPVWorker.on('error', (err) => {
    log.error('Mpv Worker thread error:', err);
    handleError(err.message);
  });

  MPVWorker.on('exit', (code) => {
    log.info(`Mpv Worker exited with code ${code}`);
    if (code === 0 || code === null) {
      handleDone();
    } else {
      handleError(`Worker exited abnormally with code ${code}`);
    }
  });
}

const handleMpvOutput = (data)=> {
  if(data.toString().includes("AV:")){
    if(WINDOW && WINDOW.isVisible()) WINDOW.hide();
  }

  let line = data.toString();
  process.stdout.write(line);
  if(line.includes("AV:")){
    let lastTimeBeforeQuit = line.split("AV:")[1].split("/")[0].trim();
    let videoDuration = line.split("AV:")[1].split("/")[1].trim();

    const [durationHour, durationMin, durationSeconds] = videoDuration.split(":").map(item => parseInt(item));
    const [hours, minutes, seconds] = lastTimeBeforeQuit.split(":").map(item => parseInt(item));

    videoDuration = (durationHour * 60 + durationMin) * 60 + durationSeconds; // s
    lastSecondBeforeQuit = (hours * 60 + minutes) * 60 + seconds; // s

    if(lastSecondBeforeQuit >= videoDuration-120) {
      lastSecondBeforeQuit = 0;
    }
  }
}

function updateLastSecondBeforeQuit(lastPbPosition,metaData){
  const LibraryInfo = loadLibraryStorage();
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
  overwriteStorageFile(Paths.libraryFilePath,LibraryInfo);
}

// ############################## CACHE HISTORY MANAGEMENT ##############################
function savePageCachedDataToHistory(PageURL,cacheData){
  if(PageURL){
    let dataId = generateUniqueId(PageURL);
    if(pagesCachedHistory[dataId])
      delete pagesCachedHistory[dataId];
    pagesCachedHistory[dataId] = cacheData;
  }
}

function deletePageCachedDataFromHistory(PageURL){
  if(PageURL){
    let dataId = generateUniqueId(PageURL);
    delete pagesCachedHistory[dataId];
  }
}

function loadPageCachedDataFromHistory(PageURL){
  if(PageURL){
    let dataId = generateUniqueId(PageURL);
    return pagesCachedHistory[dataId];
  }else{
    return null;
  }
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


// ################################### API KEY MANAGEMENT ###################################

async function validateTMDBApiKey(apiKey) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`
    );

    return {
      type: "verify-api-key",
      response: 
        res.status === 403 || res.status === 401
        ? "api-key-not-valid"
        : "api-key-valid" 
    };
  } catch {
    return {
      type: "verify-api-key",
      response: "no-internet-connection",
    };
  }
}

async function validateWyzieApiKey(apiKey) {
  try {
    const res = await fetch(
      `https://sub.wyzie.ru/search?id=tt1375666&key=${apiKey}`
    );

    return {
      type: "verify-api-key",
      response: 
        res.status === 403 || res.status === 401
        ? "api-key-not-valid" 
        : "api-key-valid"
    };

  } catch {
    return {
      type: "verify-api-key",
      response: "no-internet-connection",
    };
  }
}

// ################################### Utilities Related ###################################

process.on('unhandledRejection', (reason) => {
  if (reason?.name === 'AbortError') return;
  log.error('Unhandled rejection:', reason);
});
