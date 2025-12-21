import downloadMultipleSubs from "./downloadSubtitles.js";
import {spawn} from "child_process";
import {parentPort, workerData} from "worker_threads";
import WebTorrent from 'webtorrent';
import {fileURLToPath} from "url";
import crypto from "crypto";
import express from "express";
import mime from "mime";
import path from "path";
import fs from "fs";

let mpvProcess = null;
let expressServer = null;
let webTorrentClient = null;

function StreamTorrent(metaData,subsObjects,startFromTime,videoCachePath,subDirectory,mpvConfigDirectory){
  return new Promise((resolve, reject) => {

    console.log("\nLoading Torrent:",metaData?.fileName)
    webTorrentClient = new WebTorrent();
    const torrent = webTorrentClient.add(metaData.Magnet, {path: videoCachePath},(torrent) => {

      console.log("\nTorrent Files:-----------------------------------------------------");
      torrent.files.forEach(f => { console.log(f.name) });
      console.log("-------------------------------------------------------------------\n");

      const file = torrent.files.find(f =>
        (metaData?.fileName ===  f.name)
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

      expressServer = app.listen(0, async() => {
        try{
          const port = expressServer.address().port;
          const url = `http://localhost:${port}/video`;
          console.log(`Streaming URL: ${url}`);

          let subsId = generateUniqueId(
            `${metaData.mediaImdbId}-${metaData.episodeNumber ?? "undefined"}-${metaData.seasonNumber ?? "undefined"}`
          );

          // download Subtitles
          let tmpSubDir = path.join(subDirectory,`SUB_${subsId}`);
          let downloadResponce = await downloadMultipleSubs(tmpSubDir,subsObjects);
          let subsPaths = downloadResponce.filter(responce => responce.status === "success").map(responce => responce.file);

          runMpvProcess(url,mpvConfigDirectory,startFromTime,subsPaths)

        }catch(error){
          console.error(error.message);
          reject(error);
        }
      });
    });
  });
}

async function PlayLocalVideo(metaData,startFromTime,subsPaths,mpvConfigDirectory){
  return new Promise((resolve, reject) => {
    try{
      let videoFullPath = findFile(metaData.downloadPath, metaData.fileName);
      runMpvProcess(videoFullPath,mpvConfigDirectory,startFromTime,subsPaths,resolve,reject);
    }catch(err){
      console.error(err);
      reject(err);
    }
  });
}

function runMpvProcess(videoFullPath,mpvConfigDirectory,startFromTime,subsPaths,onClose,onError){
  let subsArgument = subsPaths.map(path => `--sub-file=${path.replaceAll(" ","\ ")}`);
  let childProcessArguments = [videoFullPath, "--fullscreen", `--config-dir=${mpvConfigDirectory}`,`--start=${startFromTime}`,...subsArgument]; 

  mpvProcess = spawn('mpv', childProcessArguments);

  mpvProcess.on('close', async () => {
    console.log('MPV process closed');
    parentPort.postMessage({type:"status",message:"Playback done"});
    await cleanup();
    if(onClose) onClose();
  });

  mpvProcess.on("error", async err => {
    console.error('MPV process error:', err);
    parentPort.postMessage({type:"status",message:"Playback error"});
    await cleanup();
    if(onError) onError(err);
  });

  // share mpv output data 
  [mpvProcess.stdout,mpvProcess.stderr].forEach(dataPipe => {
    dataPipe.on('data', (data)=>{
      const output = data.toString();
      parentPort.postMessage({type:"status",message:"Mpv output data",data:output});
    });
  });
}

function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
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

function loadSubsFromSubDir(downloadPath,TorrentId){
  try{
    let subFolder = path.join(downloadPath,`SUBS_${TorrentId}`);
    return fs.readdirSync(subFolder).map(fileName => path.join(subFolder,fileName));
  }catch(err){
    console.error(err.message);
    return [];
  }
}

async function cleanup(){
  if(mpvProcess) {
    try {
      mpvProcess.kill();
      mpvProcess = null;
    } catch(err) {
      console.error('Failed to kill mpv:', err);
    }
  }
  
  if(expressServer) {
    try {
      await new Promise((resolve) => {
        expressServer.close(() => {
          resolve();
        });
      });
      expressServer = null;
    } catch(err) {
      console.error('Failed to close server:', err);
    }
  }
  
  if(webTorrentClient) {
    try {
      await new Promise((resolve) => {
        webTorrentClient.destroy((err) => {
          if(err) console.error('Failed to Destroy torrent client:', err);
          resolve();
        });
      });
      webTorrentClient = null;
    } catch(err) {
      console.error('Failed to Destroy torrent client:', err);
    }
  }
  
  console.log('Worker cleanup complete');
  if (parentPort) {
    parentPort.close();
  }
}

parentPort.on('message', async (msg) => {
  if(msg.type === 'shutdown') {
    console.log("\nWorker received shutdown signal");
    await cleanup();
  }
});

// Entry Point
if(workerData.typeOfPlay === "StreamTorrent"){
  StreamTorrent(workerData.metaData,workerData.subsObjects, workerData.startFromTime,workerData.videoCachePath, workerData.subDirectory,workerData.mpvConfigDirectory)
    .catch(err => {
      console.error('StreamTorrent error:', err);
      cleanup();
    });

}else if(workerData.typeOfPlay === "LocalFile"){
  PlayLocalVideo(workerData.metaData, workerData.startFromTime,workerData.subsPaths,workerData.mpvConfigDirectory);
}
