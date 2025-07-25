const { BrowserWindow, app, nativeTheme, ipcMain, webFrame } = require("electron");
const torrentStream = require('torrent-stream');
const http = require('http');
const path = require("path");
const fs = require("fs");
const https = require("https");

require("dotenv").config();

nativeTheme.themeSource = "dark";
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }

  });
  win.setMenuBarVisibility(false);
  win.loadFile("./home/mainPage.html");

};


app.on("ready", () => {
  createWindow();
});

ipcMain.handle("go-back",(event)=>{
  const webContents = event.sender;
  if(webContents.navigationHistory.canGoBack()){
    webContents.navigationHistory.goBack();
  }
});

ipcMain.handle("change-page", (event,page) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    const [filePath, query] = page.split('?');
    const fullPath = path.join(__dirname, filePath);
    const url = `file://${fullPath}${query ? '?' + query : ''}`;
    win.loadURL(url);
  }
});

ipcMain.handle("request-fullscreen",()=>{
  const win = BrowserWindow.getFocusedWindow();
  if(win.isFullScreen()) win.setFullScreen(false);
  else if(!win.isFullScreen()) win.setFullScreen(true);
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



