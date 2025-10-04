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

dotenv.config();

// ======================= PATHS =======================
const SettingsFilePath = path.join(__configs, 'settings.json');
const ThemeFilePath = path.join(__configs, 'Theme.css');
const mpvConfigDiv = path.join(__configs, 'mpvConfigs');
const SubConfigFile = path.join(__configs, 'mpvConfigs/mpv.conf');
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
let mainzoomFactor = 1;
let subsPaths;
nativeTheme.themeSource = "dark";

// WebTorrent client
const client = new WebTorrent();
let win;

// ======================= ELECTRON WINDOW =======================
const createWindow = async () => {
  win = new BrowserWindow({
    width: 1100,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.maximize();
  win.setMenuBarVisibility(false);
  win.loadFile("./home/mainPage.html");

  mainzoomFactor = loadSettings().PageZoomFactor;

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(mainzoomFactor);
  });
};

let closeWindow = true;

app.on("ready", () =>{
  protocol.handle('theme', async () => {
    const css = await fs.promises.readFile(ThemeFilePath, 'utf8');
    return new Response(css, { headers: { 'content-type': 'text/css' } });
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
  if (mpv) mpv.kill();
  if (win) win.show();
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
ipcMain.handle('play-torrent', async (event, magnet, subsObjects) => {
  return new Promise((resolve, reject) => {
    client.add(magnet, (torrent) => {
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
          console.log(`--config-dir=${mpvConfigDiv}`);
         
          let childProcessArguments = [url, `--config-dir=${mpvConfigDiv}`,...subsArgument];
          if(win.isFullScreen()) childProcessArguments = ["--fullscreen",...childProcessArguments];

          mpv = spawn('mpv', childProcessArguments);
          mpv.on('close', () => {
            console.log('Playback finished');
            server.close();
            torrent.destroy();

            mpv.stdout.off('data', hideMainWindow);
            mpv.stderr.off('data', hideMainWindow);

            subsPaths.forEach(file => {fs.unlinkSync(file)});
            const webContents = event.sender;
            if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
            if (win) win.show();
          });
          mpv.stdout.on('data', hideMainWindow);
          mpv.stderr.on('data', hideMainWindow);
          resolve(url);
        }catch(error){console.error(error.message)};
      });
    });
  });
});

const hideMainWindow = (data)=>{
  if(win && win.isVisible()) win.hide();
  process.stdout.write(data.toString());
};

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
  LibraryInfo.media.push(mediaInfo);
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.on("remove-from-lib", (event, mediaInfo) => {
  const LibraryInfo = getLibraryInfo();
  LibraryInfo.media = LibraryInfo.media.filter(e => !(e.MediaId === mediaInfo.MediaId && e.MediaType === mediaInfo.MediaType));
  insertNewInfoToLibrary(LibraryInfo);
});

ipcMain.handle("load-from-lib", (event, targetIdentification) => {
  const LibraryInfo = getLibraryInfo();
  if (!targetIdentification) return LibraryInfo.media;

  const targetLibraryInfo = LibraryInfo.media.filter(e => e.MediaId === targetIdentification.MediaId && e.MediaType === targetIdentification.MediaType);
  if (targetLibraryInfo.length) return targetLibraryInfo;
  return [];
});

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
