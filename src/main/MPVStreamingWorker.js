import downloadMultipleSubs from "./downloadSubtitles.js";
import {log} from "./debugging.js";
import {spawn} from "child_process";
import {parentPort, workerData} from "worker_threads";
import WebTorrent from 'webtorrent';
import crypto from "crypto";
import express from "express";
import mime from "mime";
import path from "path";
import os from 'os';
import fs from "fs";

let mpvProcess = null;
let expressServer = null;
let webTorrentClient = null;

function StreamTorrent(
  MpvExecPath,
  metaData,
  subsObjects,
  startFromTime,
  videoCachePath,
  subDirectory,
  mpvConfigDirectory,
  mpvWindowConfigs
) {
  return new Promise((resolve, reject) => {

    log.info("\nLoading Torrent:", metaData?.fileName);
    webTorrentClient = new WebTorrent();
    const torrent = webTorrentClient.add(metaData.Magnet, {path: videoCachePath}, async (torrent) => {

      console.log("\nTorrent Files:-----------------------------------------------------");
      torrent.files.forEach(f => { console.log(f.name) });
      console.log("-------------------------------------------------------------------\n");

      const file = torrent.files.find(f =>
        normaliseFileName(metaData?.fileName) === normaliseFileName(f.name)
      );

      if (!file) {
        const errorMsg = "No suitable video file was found";
        parentPort.postMessage({
          type: "status",
          message: "Torrent Fetching Error",
          error: errorMsg
        });
        await cleanup();
        return reject(new Error(errorMsg));
      }

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
        stream.on('error', (err) => {
          log.error('Stream error:', err);
        });
        res.on('close', () => {
          stream.destroy();
        });

        stream.pipe(res);
      });

      expressServer = app.listen(0, async () => {
        try {
          const port = expressServer.address().port;
          const url = `http://localhost:${port}/video`;
          log.info(`Streaming URL: ${url}`);

          const subsId = generateUniqueId(
            `${metaData.mediaImdbId}-${metaData.episodeNumber ?? "undefined"}-${metaData.seasonNumber ?? "undefined"}`
          );

          const tmpSubDir = path.join(subDirectory, `SUB_${subsId}`);
          const downloadResponce = await downloadMultipleSubs(tmpSubDir, subsObjects);
          const subsPaths = downloadResponce
            .filter(responce => responce.status === "success")
            .map(responce => responce.file);

          runMpvProcess(
            MpvExecPath,
            url, mpvConfigDirectory,
            startFromTime, subsPaths,
            mpvWindowConfigs
          );

        } catch (error) {
          log.error(error.message);
          reject(error);
        }
      });
    });

    torrent.on('error', async (err) => {
      const errorMsg = `Torrent error: ${err.message}`;
      log.error(errorMsg);
      parentPort.postMessage({
        type: "status",
        message: "Torrent Fetching Error",
        error: errorMsg
      });
      await cleanup();
      reject(err);
    });
  });
}

async function PlayLocalVideo(
  MpvExecPath,
  metaData,
  startFromTime,
  subsPaths,
  mpvConfigDirectory,
  mpvWindowConfigs
) {
  return new Promise((resolve, reject) => {
    try {
      const videoFullPath = findFile(metaData.downloadPath, metaData.fileName);
      if (videoFullPath)
        runMpvProcess(
          MpvExecPath,
          videoFullPath, mpvConfigDirectory,
          startFromTime, subsPaths,
          mpvWindowConfigs, resolve, reject
        );
      else
        throw new Error(`Cannot Find File Named:<br> ${metaData.fileName}`);
    } catch (err) {
      log.error(err);
      reject(err);
    }
  });
}

function runMpvProcess(
  MpvExecPath,
  videoFullPath,
  mpvConfigDirectory,
  startFromTime,
  subsPaths,
  mpvWindowConfigs,
  onClose,
  onError
) {
  const subsArgument = subsPaths.map(path => `--sub-file=${path}`);
  const isWindows = os.platform() === 'win32';
  const mpvExecutable = MpvExecPath ?? (isWindows ? 'mpv.exe' : 'mpv');

  const childProcessArguments = [
    videoFullPath,
    "--keep-open=yes",
    `--config-dir=${mpvConfigDirectory}`,
    `--start=${startFromTime}`,
    `--geometry=${mpvWindowConfigs.geometry}`,
    `--fullscreen=${mpvWindowConfigs.fullscreened ? "yes" : "no"}`,
    `--window-maximized=${mpvWindowConfigs.maximized ? "yes" : "no"}`,
    ...subsArgument
  ];

  let errorOccurred = false;

  mpvProcess = spawn(mpvExecutable, childProcessArguments);
  log.info("Launching mpv with options:\n" +
    `--keep-open=yes\n` +
    `--config-dir=${mpvConfigDirectory}\n` +
    `--start=${startFromTime}\n` +
    `--geometry=${mpvWindowConfigs.geometry}\n` +
    `--fullscreen=${mpvWindowConfigs.fullscreened ? "yes" : "no"}\n` +
    `--window-maximized=${mpvWindowConfigs.maximized ? "yes" : "no"}`
  );

  mpvProcess.on("error", async (err) => {
    errorOccurred = true;

    const errMsg = err.code === "ENOENT"
      ? "MPV not found. Install it or set its path in settings"
      : `MPV process error: ${err.message}`;

    log.error(errMsg);
    await cleanup();

    parentPort.postMessage({
      type: "status",
      message: "Playback error",
      error: errMsg
    });

    if (onError) onError(new Error(errMsg));
  });

  mpvProcess.on('close', async (code) => {
    if (errorOccurred) return;

    log.info(`MPV process closed (exit code ${code})`);
    await cleanup();

    parentPort.postMessage({ type: "status", message: "Playback done" });
    if (onClose) onClose();
  });

  [mpvProcess.stdout, mpvProcess.stderr].forEach(dataPipe => {
    dataPipe.on('data', (data) => {
      parentPort.postMessage({
        type: "status",
        message: "Mpv output data",
        data: data.toString()
      });
    });
  });
}

function generateUniqueId(seed) {
  const hash = crypto.createHash('sha256');
  hash.update(seed);
  return hash.digest('hex');
}

function findFile(dir, filename) {
  if (!fs.existsSync(dir)) return null;
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

function loadSubsFromSubDir(downloadPath, TorrentId) {
  try {
    const subFolder = path.join(downloadPath, `SUBS_${TorrentId}`);
    return fs.readdirSync(subFolder)
      .map(fileName => path.join(subFolder, fileName));
  } catch (err) {
    log.error(err.message);
    return [];
  }
}

async function cleanup() {
  log.info('Starting cleanup...');

  if (mpvProcess) {
    try {
      mpvProcess.kill('SIGTERM');
      mpvProcess = null;
      log.info('MPV killed');
    } catch (err) {
      log.error('Failed to kill mpv:', err);
    }
  }

  if (expressServer) {
    try {
      await Promise.race([
        new Promise((resolve) => {
          expressServer.close(() => {
            log.info('Express server closed');
            resolve();
          });
        }),
        new Promise((resolve) => setTimeout(resolve, 500))
      ]);
      expressServer = null;
    } catch (err) {
      log.error('Failed to close server:', err);
    }
  }

  if (webTorrentClient) {
    try {
      webTorrentClient.destroy();
      log.info('WebTorrent client destroy initiated');
      webTorrentClient = null;
    } catch (err) {
      log.error('Failed to destroy torrent client:', err);
    }
  }

  log.info('Worker cleanup complete');
}

const normaliseFileName = (fileName) => {
  return fileName.replace(/[+\s]+/g, ' ').trim().toLowerCase();
};

parentPort.on('message', async (msg) => {
  if (msg.type === 'shutdown') {
    log.info("Worker received shutdown signal");
    await cleanup();
  }
});

if (workerData.typeOfPlay === "StreamTorrent") {
  StreamTorrent(
    workerData.MpvExecPath,
    workerData.metaData,
    workerData.subsObjects,
    workerData.startFromTime,
    workerData.videoCachePath,
    workerData.subDirectory,
    workerData.mpvConfigDirectory,
    workerData.mpvWindowConfigs
  )
  .catch(async (err) => {
    parentPort.postMessage({
      type: "status",
      message: "Torrent Fetching Error",
      error: err.message
    });
    await cleanup();
  });

} else if (workerData.typeOfPlay === "LocalFile") {
  PlayLocalVideo(
    workerData.MpvExecPath,
    workerData.metaData,
    workerData.startFromTime,
    workerData.subsPaths,
    workerData.mpvConfigDirectory,
    workerData.mpvWindowConfigs
  )
  .catch(async (err) => {
    parentPort.postMessage({
      type: "status",
      message: "Playback error",
      error: err.message
    });
    await cleanup();
  });
}
