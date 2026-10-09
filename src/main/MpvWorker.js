import { SubDownloadManager } from './SubDownloadManager.js';
import { getTorrentTrackers } from './torrentTracker.js';
import { config } from "./config.js";
import {
  findFile,
  normaliseFileName
} from './utils.js';
import { log } from './debugging.js';
import { spawn } from 'child_process';
import { parentPort, workerData } from 'worker_threads';
import WebTorrent from 'webtorrent';
import express from 'express';
import mime from 'mime';
import path from 'path';
import os from 'os';

let mpvProcess = null;
let expressServer = null;
let webTorrentClient = null;
let activeTorrent = null;
let activeFile = null;
let bufferingTimer = null;
let playbackStarted = false;
let sawStreamTimeout = false;
let loadFailureReported = false;
config.init();

const MPV_PLAYING_REGEX = /(?:AV|V|A):\s+\d+:\d+:\d+/;

function sendProgress(stage, data) {
  parentPort.postMessage({ type: 'progress', stage, ...(data !== undefined && { data }) });
}

function startBufferingReports() {
  stopBufferingReports();
  let stalledFor = 0;
  const report = () => {
    if (!activeTorrent) return;
    stalledFor = activeTorrent.downloadSpeed > 0 ? 0 : stalledFor + 1;
    sendProgress('buffering', {
      stalledFor,
      speed: activeTorrent.downloadSpeed,
      peers: activeTorrent.numPeers,
      downloaded: activeFile?.downloaded ?? 0,
      progress: activeFile?.progress ?? 0
    });
  };
  report();
  bufferingTimer = setInterval(report, 1000);
}

function stopBufferingReports() {
  clearInterval(bufferingTimer);
  bufferingTimer = null;
}

function detectLoadFailure(text) {
  if (/timed out/i.test(text)) sawStreamTimeout = true;
  if (!/Failed to open|Errors when loading file/i.test(text)) return;
  loadFailureReported = true;
  stopBufferingReports();
  sendProgress('load-failed', {
    reason: sawStreamTimeout ? 'timeout' : 'unknown',
    peers: activeTorrent?.numPeers ?? 0,
    downloaded: activeFile?.downloaded ?? 0
  });
}

SubDownloadManager.sendProgressCallBack = (progressInfo) => {
  parentPort.postMessage({
    type: "subtitles_progress",
    progressInfo,
  });
}

function StreamTorrent(
  MpvExecPath,
  metaData,
  haveNextEpisode,
  startFromTime,
  videoCachePath,
  subDirectory,
  mpvConfigDirectory,
  mpvWindowConfigs,
  subtitleSettings
) {
  return new Promise(async (resolve, reject) => {
    sendProgress('trackers');
    const trackers = await getTorrentTrackers()
    log.info("Loading Torrent:", metaData?.fileName);
    webTorrentClient = new WebTorrent({ lsd: false, utp: false });
    // webTorrentClient = new WebTorrent();
    const torrent = webTorrentClient.add(metaData.MagnetLink, {
      path: videoCachePath,
      announce: trackers 
    });
    activeTorrent = torrent;
    let metadataReceived = false;
    let lastPeersReport = 0;
    sendProgress('connecting');

    torrent.on("ready", async () => {
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

      activeFile = file;

      const app = express();
      app.get('/video', (req, res) => {
        const total = file.length;
        const range = req.headers.range;
        let start = 0;
        let end = total - 1;
        let status = 200;

        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
          if (!match || (match[1] === '' && match[2] === '')) {
            return res.status(416).set('Content-Range', `bytes */${total}`).end();
          }
          if (match[1] === '') {
            start = Math.max(total - parseInt(match[2], 10), 0);
          } else {
            start = parseInt(match[1], 10);
            if (match[2] !== '') end = Math.min(parseInt(match[2], 10), total - 1);
          }
          if (start >= total || start > end) {
            return res.status(416).set('Content-Range', `bytes */${total}`).end();
          }
          status = 206;
        }

        const headers = {
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': mime.getType(file.name) || 'application/octet-stream'
        };
        if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;

        res.writeHead(status, headers);
        res.flushHeaders();
        if (req.method === 'HEAD') return res.end();

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

          sendProgress('subtitles');
          const tmpSubDir = path.join(subDirectory, `SUBS_${metaData.torrentId}`);
          log.info("Downloading subtitles to:", tmpSubDir);
          const downloadResponse = await SubDownloadManager.downloadSubsForMedia(metaData, metaData.torrentId, tmpSubDir, subtitleSettings);
          log.info("Finished downloading subtitles");
          const subsPaths = downloadResponse
            .filter(response => response.status === "success")
            .map(response => response.file);

          runMpvProcess(
            MpvExecPath, url,
            mpvConfigDirectory, metaData,
            haveNextEpisode, startFromTime,
            subsPaths, mpvWindowConfigs
          );

        } catch (error) {
          log.error(error.message);
          reject(error);
        }
      });
    });

    torrent.on('wire', () => {
      const now = Date.now();
      if (metadataReceived || now - lastPeersReport < 1000) return;
      lastPeersReport = now;
      sendProgress('peers', { peers: torrent.numPeers });
    });

    torrent.on('metadata', () => {
      log.info("Metadata Loaded");
      metadataReceived = true;
      sendProgress('metadata');
    });

    torrent.on("warning", (warn) => log.warn("Torrent warning:", warn.message));

    torrent.on('error', async (err) => {
      const errorMsg = `Torrent error: ${err.message}`;
      log.error(errorMsg);
      parentPort.postMessage({ type: "status", message: "Torrent Fetching Error", error: errorMsg });
      await cleanup();
      reject(err);
    });
  });
}

async function PlayLocalVideo(
  MpvExecPath,
  metaData,
  haveNextEpisode,
  startFromTime,
  subsPaths,
  mpvConfigDirectory,
  mpvWindowConfigs
) {
  return new Promise(async(resolve, reject) => {
    try {
      const videoFullPath = await findFile(metaData.downloadPath, metaData.fileName);
      if (videoFullPath)
        runMpvProcess(
          MpvExecPath, videoFullPath,
          mpvConfigDirectory, metaData,
          haveNextEpisode, startFromTime,
          subsPaths, mpvWindowConfigs,
          resolve, reject
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
  metaData,
  haveNextEpisode,
  startFromTime,
  subsPaths,
  mpvWindowConfigs,
  onClose,
  onError
) {
  sendProgress('launching');
  const subsArgument = subsPaths != null ? subsPaths.map(path => `--sub-file=${path}`) : [];
  const isWindows = os.platform() === 'win32';
  const mpvExecutable = (MpvExecPath ?? (isWindows ? 'mpv.exe' : 'mpv')).trim().replace(/\/$/, '');

  const isValid = (val) => val !== undefined && val !== null && val !== "undefined";
  const videoTitle = [
    metaData.Title,
    isValid(metaData.seasonNumber) ? `S${metaData.seasonNumber}` : null,
    isValid(metaData.episodeNumber) ? `E${metaData.episodeNumber}` : null,
  ].filter(Boolean).join(" ");

  const childProcessArguments = [
    videoFullPath,
    "--keep-open=yes",
    `--config-dir=${mpvConfigDirectory}`,
    `--start=${startFromTime}`,
    `--geometry=${mpvWindowConfigs.geometry}`,
    `--fullscreen=${mpvWindowConfigs.fullscreened ? "yes" : "no"}`,
    `--window-maximized=${mpvWindowConfigs.maximized ? "yes" : "no"}`,
    `--force-media-title=${videoTitle}`,
    `--script-opts=haveNextEp=${haveNextEpisode}`,
    `--mute=yes`,
    `--ytdl=no`,
    `--network-timeout=300`,
    ...subsArgument
  ];

  let errorOccurred = false;

  mpvProcess = spawn(mpvExecutable, childProcessArguments);
  playbackStarted = false;
  sawStreamTimeout = false;
  loadFailureReported = false;
  if (activeTorrent) startBufferingReports();
  log.info("Launching mpv with options:\n" +
    `--keep-open=yes\n` +
    `--config-dir=${mpvConfigDirectory}\n` +
    `--start=${startFromTime}\n` +
    `--geometry=${mpvWindowConfigs.geometry}\n` +
    `--fullscreen=${mpvWindowConfigs.fullscreened ? "yes" : "no"}\n` +
    `--window-maximized=${mpvWindowConfigs.maximized ? "yes" : "no"}\n` +
    `--force-media-title=${videoTitle}`
  );

  mpvProcess.on("error", async (err) => {
    errorOccurred = true;

    const errMsg = err.code === "ENOENT" || err.code === "ENOTDIR"
      ? "MPV not found. Install it or set its path in settings"
      : `MPV process error: ${err.message}`;

    log.error(errMsg);
    await cleanup();

    parentPort.postMessage({
      type: "status",
      message: "playback_error",
      error: errMsg
    });

    if (onError) onError(new Error(errMsg));
  });

  mpvProcess.on('close', async (code) => {
    if (errorOccurred) return;

    log.info(`MPV process closed (exit code ${code})`);
    await cleanup();

    parentPort.postMessage({ type: "status", message: "playback_done" });
    if (onClose) onClose();
  });

  [mpvProcess.stdout, mpvProcess.stderr].forEach(dataPipe => {
    dataPipe.on('data', (data) => {
      const text = data.toString();
      if (!playbackStarted && MPV_PLAYING_REGEX.test(text) && !text.includes('(Paused)')) {
        playbackStarted = true;
        stopBufferingReports();
        sendProgress('playing');
      }
      if (!playbackStarted && !loadFailureReported) detectLoadFailure(text);
      parentPort.postMessage({
        type: "status",
        message: "mpv_output_data",
        data: data.toString()
      });
    });
  });
}

async function cleanup() {
  log.info('Starting cleanup...');
  stopBufferingReports();
  activeTorrent = null;
  activeFile = null;

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
    const client = webTorrentClient;
    webTorrentClient = null;
    try {
      await destroyClient(client);
      log.info('WebTorrent client destroyed');
    } catch (err) {
      log.error('Failed to destroy torrent client:', err);
    }
  }

  log.info('Worker cleanup complete');
}

function destroyClient(client) {
  return Promise.race([
    new Promise((resolve) => client.destroy(() => resolve())),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

parentPort.on('message', async (msg) => {
  if (msg.type === 'shutdown') {
    await cleanup();
    parentPort.removeAllListeners('message');
    parentPort.close();
  }
});

if (workerData.typeOfPlay === "StreamTorrent") {
  StreamTorrent(
    workerData.MpvExecPath,
    workerData.metaData,
    workerData.haveNextEpisode,
    workerData.startFromTime,
    workerData.videoCachePath,
    workerData.subDirectory,
    workerData.mpvConfigDirectory,
    workerData.mpvWindowConfigs,
    workerData.subtitleSettings
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
    workerData.haveNextEpisode,
    workerData.startFromTime,
    workerData.subsPaths,
    workerData.mpvConfigDirectory,
    workerData.mpvWindowConfigs
  )
  .catch(async (err) => {
    const errMsg = err.code === "ENOENT" || err.code === "ENOTDIR"
      ? "MPV not found. Install it or set its path in settings."
      : err.message;

    parentPort.postMessage({
      type: "status",
      message: "playback_error",
      error: errMsg
    });
    await cleanup();
  });
}
