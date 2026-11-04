import { Worker } from "worker_threads";
import { parseArgs } from 'node:util';
import { spawn } from "child_process";
import { access, mkdir } from 'fs/promises';
import WebTorrent from "webtorrent";
import http from "http";
import path from "path";
import os from "os";

import { createIPC } from './ipc.js';
import { pathExists } from "./utils.js";
import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import { normaliseFileName } from "./utils.js";
import { getLibraryEntry, loadLibraryStorage, overwriteStorageFile } from "./storageManagement.js";
import NextEpisodeManager from "./NextEpisodeManager.js";


const { values: cliArgs } = parseArgs({
  options: { "log-mpv": { type: 'boolean', default: false } },
  strict: false,
});

class MpvPlayerManager {
  #worker = null;
  #ipc = null;
  #streamClient = null;
  #mpv = null;
  #lastSecondBeforeQuit = 0;
  inVideoPlayerPage = false;
  #browserWindow = null;
  #restoreAndFocusWindow =  null;
  #settings = null;
  #nextEpisodeManager = new NextEpisodeManager();

  constructor(browserWindow, restoreAndFocusWindowCallback) {
    this.#browserWindow = browserWindow;
    this.#restoreAndFocusWindow = restoreAndFocusWindowCallback;
  }

  get nextEpisodeInfo() {
    return this.#nextEpisodeManager.nextEpisodeInfo;
  }

  async getVideoUrl(magnet, fileName) {
    return new Promise(async (resolve, reject) => {
      this.inVideoPlayerPage = true;

      log.info("Loading Torrent:", fileName);
      if (!(await pathExists(Paths.videoCachePath))) {
        await mkdir(Paths.videoCachePath, { recursive: true });
      }
      if (!(await pathExists(Paths.videoCachePath))) {
        await mkdir(Paths.videoCachePath, { recursive: true });
      }

      const client = new WebTorrent();
      const torrent = client.add(magnet, { path: Paths.videoCachePath });
      this.#streamClient = torrent;

      torrent.on("ready", () => {
        torrent.deselect(0, torrent.pieces.length - 1, false);

        console.log("\nTorrent Files:-----------------------------------------------------");
        torrent.files.forEach((f) => console.log(f.name));
        console.log("-------------------------------------------------------------------\n");

        const file = torrent.files.find(
          (f) => normaliseFileName(f.name) === normaliseFileName(fileName)
        );

        if (!file) return reject("No video file found in torrent");

        file.select();

        const mimeType = file.name.endsWith(".mkv")
          ? "video/x-matroska"
          : file.name.endsWith(".mp4")
          ? "video/mp4"
          : file.name.endsWith(".webm")
          ? "video/webm"
          : "application/octet-stream";

        const server = http.createServer((req, res) => {
          const range = req.headers.range;
          if (!range) {
            res.statusCode = 416;
            return res.end();
          }

          const positions = range.replace(/bytes=/, "").split("-");
          const start = parseInt(positions[0], 10);
          const fileSize = file.length;
          const end = positions[1] ? parseInt(positions[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": mimeType,
          });

          file.createReadStream({ start, end }).pipe(res);
        });

        server.listen(0, () => {
          const port = server.address().port;
          resolve([`http://localhost:${port}`, mimeType]);
        });
      });

      torrent.on("error", reject);
    });
  }

  async playTorrentOverMpv(metaData, settings) {
    this.#settings = settings;
    const nextPromise = this.#nextEpisodeManager.resolveNext(metaData);
    const startFromTime = await this.#getLatestPlaybackPosition(metaData);
    const { MpvExecPath, LanguagesToDownload, DownloadAllSubtitles } = settings;

    this.#worker = new Worker(Paths.MpvWorkerPath, { type: "module" });

    this.#handleWorker({
      MpvExecPath,
      typeOfPlay: "StreamTorrent",
      metaData,
      startFromTime,
      videoCachePath: Paths.videoCachePath,
      subDirectory: Paths.subDirectory,
      mpvConfigDirectory: Paths.mpvConfigDirectory,
      subtitleSettings: { LanguagesToDownload, DownloadAllSubtitles },
    });
    this.#notifyWhenNextReady(nextPromise, this.#worker, this.#ipc);
    this.inVideoPlayerPage = true;
  }

  async playVideoOverMpv(metaData, subsPaths, settings) {
    log.info(`Playing ${metaData.fileName} over Mpv`);
    this.#settings = settings;
    const nextPromise = this.#nextEpisodeManager.resolveNext(metaData);
    const startFromTime = await this.#getLatestPlaybackPosition(metaData);
    const { MpvExecPath } = settings;

    this.#worker = new Worker(Paths.MpvWorkerPath, { type: "module" });

    this.#handleWorker({
      MpvExecPath,
      typeOfPlay: "LocalFile",
      metaData,
      startFromTime,
      subsPaths,
      mpvConfigDirectory: Paths.mpvConfigDirectory
    });
    this.#notifyWhenNextReady(nextPromise, this.#worker, this.#ipc);
    this.inVideoPlayerPage = true;
  }

  #notifyWhenNextReady(nextPromise, worker, ipc) {
    nextPromise.then(() => {
      if (this.#worker !== worker) return;
      ipc.emit("next_episode_ready", this.#nextEpisodeManager.hasNext());
    });
  }

  cleanup() {
    this.#nextEpisodeManager.reset();
    if (this.#streamClient) this.#streamClient.destroy();
    if (this.#mpv) this.#mpv.kill();
    if (this.#browserWindow && !this.#browserWindow.isVisible())
      this.#restoreAndFocusWindow();
    if (this.#worker && this.#worker.threadId !== -1) {
      this.#ipc?.call("shutdown").catch(() => {});
      this.#worker = null;
      this.#ipc = null;
    }
  }

  #getWindowConfigs() {
    const [windowWidth, windowHeight] = this.#browserWindow.getSize();
    const [windowPosX, windowPosY] = this.#browserWindow.getPosition();
    const fullscreened = this.#browserWindow.isFullScreen();
    const maximized = this.#browserWindow.isMaximized();
    const geometry =
      fullscreened || maximized
        ? "70%x70%"
        : `${windowWidth}x${windowHeight}+${windowPosX}+${windowPosY}`;

    return { geometry, fullscreened, maximized };
  }

  #handleWorker(session) {
    const { metaData } = session;
    const worker = this.#worker;
    let handled = false;

    const exitVideoPlayerPage = () => {
      if (!this.inVideoPlayerPage) return;
      this.inVideoPlayerPage = false;
      this.#savePlaybackPosition(this.#lastSecondBeforeQuit, metaData);
      this.cleanup();
      this.#browserWindow.webContents.send("msg-from-main-process", {
        type: "request",
        request: "exit_video_player",
      });
    };

    const closeWorker = ({ showWindow = true } = {}) => {
      if (this.#worker === worker && worker.threadId !== -1) {
        ipc.call("shutdown").catch(() => {});
        const forceKill = setTimeout(() => worker.terminate(), 3000);
        worker.once("exit", () => clearTimeout(forceKill));
        this.#worker = null;
        this.#ipc = null;
      }
      if (showWindow) this.#restoreAndFocusWindow();
    };

    const handleError = (errorMsg) => {
      if (handled) return;
      handled = true;
      log.error("Playback/torrent error:", errorMsg);
      this.#browserWindow.webContents.send(
        "torrent-fetching-error",
        errorMsg || "Unknown error"
      );
      closeWorker();
    };

    const handleDone = () => {
      if (handled) return;
      handled = true;
      exitVideoPlayerPage();
      closeWorker();
    };

    const ipc = createIPC(worker, {
      getPlaybackConfig: () => session,
      getWindowConfigs: () => this.#getWindowConfigs(),

      onEvent: (name, payload) => {
        if (handled) return;

        switch (name) {
          case "progress":
            this.#browserWindow.webContents.send("torrent-streaming-report", {
              type: "progress",
              stage: payload.stage,
              data: payload.data
            });
            break;

          case "subtitles_progress":
            this.#browserWindow.webContents.send("subtitles-download-progress", {
              torrentId: payload.torrentId,
              message: payload.message,
              done: payload.done,
              error: payload.error
            });
            break;

          case "mpv_output": {
            const nextEpisodeRequested = this.#handleMpvOutput(payload);

            if (nextEpisodeRequested && !handled) {
              if (this.#nextEpisodeManager.hasNext()) {
                handled = true;
                this.#savePlaybackPosition(this.#lastSecondBeforeQuit, metaData);
                closeWorker();

                this.#playNextEpisode().catch((err) => {
                  log.error("Failed to start next episode:", err);
                  handled = false;
                  handleError(err?.message || "Failed to start next episode");
                });
              }
            }
            break;
          }

          case "playback_done":
            handleDone();
            break;

          case "playback_error":
          case "torrent_error":
            handleError(payload);
            break;
        }
      },
    });
    this.#ipc = ipc;

    worker.on("error", (err) => {
      log.error("Mpv Worker thread error:", err);
      handleError(err.message);
    });

    worker.on("exit", (code) => {
      ipc.close();
      log.info(`Mpv Worker exited with code ${code}`);
      if (code === 0 || code === null) {
        handleDone();
      } else {
        handleError(`Worker exited abnormally with code ${code}`);
      }
    });
  }

  #handleMpvOutput(data) {
    const line = data.toString();
    const nextEpisodeRequested = line.includes("PLAY_NEXT_EPISODE");

    if(this.#browserWindow?.isVisible() && (line.includes("MPV_WINDOW_OPENED") || line.includes("AV:")))
      this.#hideWindow();

    if(line.includes("FULLSCREEN_ON"))
      this.#restoreFullscreen = true;
    else if(line.includes("FULLSCREEN_OFF"))
      this.#restoreFullscreen = false;

    if(line.includes("MAXIMIZED_ON"))
      this.#restoreMaximize = true;
    else if(line.includes("MAXIMIZED_OFF"))
      this.#restoreMaximize = false;

    if (line.includes("AV:")) {
      const parts = line.split("AV:")[1].split("/");
      const timePart = parts[0];
      const durationPart = parts[1].trim().split(" ")[0];

      const parseHMS = (str) => {
        const [h, m, s] = str.trim().split(":").map(Number);
        return (h * 60 + m) * 60 + s;
      };

      const videoDuration = parseHMS(durationPart);
      const currentPosition = parseHMS(timePart);

      this.#lastSecondBeforeQuit =
        currentPosition >= videoDuration - 120 ? 0 : currentPosition;
    }

    if(cliArgs["log-mpv"])
      process.stdout.write(line);

    return nextEpisodeRequested;
  }

  async #playNextEpisode() {
    const nextEpisode = this.#nextEpisodeManager.nextEpisodeInfo;
    if (!nextEpisode || !this.#settings) {
      this.#browserWindow.webContents.send(
        "torrent-fetching-error",
        nextEpisode == null
          ? "Failed to load next episode information"
          : "Something went wrong"
      );
      return;
    }

    this.#browserWindow.webContents.send(
      "torrent-streaming-report",
      { stage: "next-episode-info", data: nextEpisode}
    );
    this.#lastSecondBeforeQuit = 0;

    if (NextEpisodeManager.isLocalDownload(nextEpisode)) {
      await this.playVideoOverMpv(nextEpisode, nextEpisode?.local_subs , this.#settings);
    } else {
      await this.playTorrentOverMpv(nextEpisode, this.#settings);
    }
  }

  async #savePlaybackPosition(lastPbPosition, metaData) {
    const LibraryInfo = await loadLibraryStorage();
    LibraryInfo.media ??= [];

    let found = false;

    for (const [index, item] of Object.entries(LibraryInfo.media)) {
      if (item.MediaId === metaData.MediaId && item.MediaType === metaData.MediaType) {
        delete metaData.local_subs;
        LibraryInfo.media[index].lastPlaybackPosition = lastPbPosition;
        LibraryInfo.media[index] = {...LibraryInfo.media[index], ...metaData, typeOfSave: LibraryInfo.media[index].typeOfSave};
        LibraryInfo.media[index].timeOfSave = Date.now().toString();

        if (!LibraryInfo.media[index].typeOfSave.includes("Currently Watching")) {
          LibraryInfo.media[index].typeOfSave.push("Currently Watching");
          LibraryInfo.media[index].mediaImdbId ??= metaData?.mediaImdbId;
        }
        found = true;
      }
    }

    if (!found) {
      LibraryInfo.media.push({
        ...metaData,
        lastPlaybackPosition: lastPbPosition,
        timeOfSave: Date.now().toString(),
        typeOfSave: ["Currently Watching"]
      });
    }
    await overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
  }

  async #getLatestPlaybackPosition(metaData) {
    const entry = await getLibraryEntry({
      MediaId: metaData.MediaId,
      MediaType: metaData.MediaType,
    });

    if (
      entry == null ||
      entry[0].episodeNumber !== metaData.episodeNumber ||
      entry[0].seasonNumber !== metaData.seasonNumber
    )
      return 0;

    return entry[0].lastPlaybackPosition;
  }

}

export default MpvPlayerManager;
