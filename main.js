const { BrowserWindow, app, nativeTheme, ipcMain, webFrame } = require("electron");
const torrentStream = require('torrent-stream');
const http = require('http');
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");

let SettingsFilePath = path.join(__dirname,"settings.json");
let ThemeFilePath = path.join(__dirname,"Themes/Original.css");
let libraryFilePath = path.join(__dirname,"library.json");

require("dotenv").config();

var mainzoomFactor = 1;

nativeTheme.themeSource = "dark";
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
  win.maximize()
  win.setMenuBarVisibility(false);
  win.loadFile("./home/mainPage.html");

  mainzoomFactor = loadSettings().PageZoomFactor;
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(mainzoomFactor);
  });

}

var closeWindow = true;

app.on("ready", () => {
  createWindow();
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
  fs.writeFile(SettingsFilePath, JSON.stringify(SettingsObj, null, 2), (err) => {console.log(err)});
});

ipcMain.on("apply-theme",(event, ThemeObj) =>{
  let formatedThemeObj = ThemeObj.theme.map(obj=>`${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`);

  let themeFileContent = `:root{
    ${formatedThemeObj.join(";\n")}
  ;}`;

  fs.writeFile(ThemeFilePath,themeFileContent, (err)=>{
    console.log(err)
  });
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
    const webContents = event.sender;
    webContents.setZoomFactor(mainzoomFactor);
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
    return JSON.parse(data);
  } catch (err) {
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
    console.error(err);
    ThemeObj = {
      theme:[
        {'secondary-color':'0,0,0,0.5'},
        {'main-buttons-color':'0,0,0,0.3'},
        {'primary-color':'22,20,49'},
        {'div-containers-borders-color':'255,255,255,0.0'},
        {'MovieElement-hover-BorderColor':'255,255,255'},
        {'input-backgroundColor':'0,0,0,0.2'},
        {'drop-down-color':'13,12,29,1'},
        {'icon-color':'50,50,100'},
        {'icon-hover-color':'100,70,190,1'},
        {'text-color':'#ffffff'},
        {'dont-Smooth-transition-between-pages':'0'}
      ]
    }
    return ThemeObj;
  }
}
