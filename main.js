import { BrowserWindow , BaseWindow, BrowserView , app, nativeTheme, ipcMain } from "electron";
import WebTorrent from "webtorrent";
import { spawn } from "child_process";
import express from "express";
import mime from "mime";
import path from "path";
import fs from "fs";
import os from "os";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ======================= PATHS =======================
const SettingsFilePath = path.join(__dirname, "settings.json");
const ThemeFilePath = path.join(__dirname, "Themes/Original.css");
const libraryFilePath = path.join(__dirname, "library.json");

// ======================= GLOBALS =======================
let mpv;
let mainzoomFactor = 1;
nativeTheme.themeSource = "dark";

// WebTorrent client
const client = new WebTorrent();

// ======================= ELECTRON WINDOW =======================
const createWindow = async () => {
  const win = new BrowserWindow({
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

app.on("ready", () => createWindow());

app.on("window-all-closed", () => {
  if (closeWindow) app.quit();
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

ipcMain.handle("go-back", (event) => {
  const webContents = event.sender;
  if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
  if (mpv) mpv.kill();
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.show();
});

ipcMain.handle("change-page", (event, page) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  const [filePath, query] = page.split('?');
  const fullPath = path.join(__dirname, filePath);
  const url = `file://${fullPath}${query ? '?' + query : ''}`;
  win.webContents.setZoomFactor(mainzoomFactor);
  win.loadURL(url);
});

ipcMain.handle("request-fullscreen", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle("get-api-key", () => process.env.API_KEY);

// ======================= PLAY TORRENT =======================
ipcMain.handle('play-torrent', async (event, magnet, subsUrl) => {
  return new Promise((resolve, reject) => {
    client.add(magnet, (torrent) => {
      console.log("hello");
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
          console.log("Buffered:",percentage);
        });
        stream.pipe(res);
      });
      let subsArgument = subsUrl.map(url => ` --sub-file="${url}"`);

      const server = app.listen(0, () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/video`;
        console.log(`Streaming URL: ${url}`);
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.hide();
        mpv = spawn('mpv', ['--ontop',url], { stdio: 'inherit' });
        mpv.on('close', () => {
          console.log('Playback finished');
          server.close();
          torrent.destroy();
          const webContents = event.sender;
          if (webContents.navigationHistory.canGoBack()) webContents.navigationHistory.goBack();
          if (win) win.show();
        });

        resolve(url);
      });
    });
  });
});

// ======================= LIBRARY & SAVE VIDEO =======================
ipcMain.on("save-video", () => {
  closeWindow = false;
  const tmpDir = path.join(os.tmpdir(), "torrent-stream");
  if (!fs.existsSync(tmpDir)) return;

  const tmpDirContent = fs.readdirSync(tmpDir);
  tmpDirContent.forEach(element => {
    const sourcePath = path.join(tmpDir, element);
    const destinationPath = path.join(__dirname, "Downloads", element);
    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory() || stats.size / 1e9 > 0.5) {
      fs.renameSync(sourcePath, destinationPath);
      closeWindow = true;
      console.log("Media Was Moved");
    }
  });
});

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
  if (!LibraryInfo.media.length) throw new Error("Target Not Found");
  if (!targetIdentification) return LibraryInfo.media;

  const targetLibraryInfo = LibraryInfo.media.filter(e => e.MediaId === targetIdentification.MediaId && e.MediaType === targetIdentification.MediaType);
  if (targetLibraryInfo.length) return targetLibraryInfo;
  throw new Error("Target Not Found");
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
      PageZoomFactor: 1,
      TurnOnSubsByDefault: false,
      SubFontSize: 100,
      SubFontFamilly: "monospace",
      SubColor: "white",
      SubBackgroundColor: "black",
      SubBackgroundOpacityLevel: 0
    };
  }
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
    return {
      theme: [
        { 'secondary-color': '0,0,0,0.5' },
        { 'main-buttons-color': '0,0,0,0.3' },
        { 'primary-color': '22,20,49' },
        { 'div-containers-borders-color': '255,255,255,0.0' },
        { 'MovieElement-hover-BorderColor': '255,255,255' },
        { 'input-backgroundColor': '0,0,0,0.2' },
        { 'drop-down-color': '13,12,29,1' },
        { 'icon-color': '50,50,100' },
        { 'icon-hover-color': '100,70,190,1' },
        { 'text-color': '#ffffff' },
        { 'dont-Smooth-transition-between-pages': '0' }
      ]
    };
  }
}
