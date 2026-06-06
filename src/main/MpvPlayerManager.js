import { Worker } from "worker_threads";
import { spawn } from "child_process";
import WebTorrent from "webtorrent";
import http from "http";
import path from "path";
import os from "os";
import fs from "fs";

import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import { normaliseFileName, generateUniqueId } from "./utils.js";
import { getLibraryEntry, loadLibraryStorage, overwriteStorageFile } from "./storageManagement.js";

class MpvPlayerManager {
  #worker = null;
  #streamClient = null;
  #mpv = null;
  #lastSecondBeforeQuit = 0;
  #inVideoPlayerPage = false;
  #browserWindow = null;

  constructor(browserWindow) {
    this.#browserWindow = browserWindow;
  }

  async getVideoUrl(magnet, fileName) {
    return new Promise((resolve, reject) => {
      this.#inVideoPlayerPage = true;

      log.info("Loading Torrent:", fileName);
      if (!fs.existsSync(Paths.videoCachePath)) {
        fs.mkdirSync(Paths.videoCachePath, { recursive: true });
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

  async playTorrentOverMpv(metaData, subsObjects, settings) {
    const startFromTime = await this.#getLatestPlaybackPosition(metaData);
    const { MpvExecPath } = settings;

    this.#worker = new Worker(Paths.MpvWorkerPath, {
      workerData: {
        MpvExecPath,
        typeOfPlay: "StreamTorrent",
        metaData,
        subsObjects,
        startFromTime,
        videoCachePath: Paths.videoCachePath,
        subDirectory: Paths.subDirectory,
        mpvConfigDirectory: Paths.mpvConfigDirectory,
        mpvWindowConfigs: this.#getWindowConfigs(),
      },
      type: "module",
    });

    this.#handleWorker(metaData);
    this.#inVideoPlayerPage = true;
  }

  async playVideoOverMpv(metaData, subsPaths, settings) {
    log.info(`Playing ${metaData.fileName} over Mpv`);
    const startFromTime = await this.#getLatestPlaybackPosition(metaData);
    const { MpvExecPath } = settings;

    this.#worker = new Worker(Paths.MpvWorkerPath, {
      workerData: {
        MpvExecPath,
        typeOfPlay: "LocalFile",
        metaData,
        startFromTime,
        subsPaths,
        mpvConfigDirectory: Paths.mpvConfigDirectory,
        mpvWindowConfigs: this.#getWindowConfigs(),
      },
      type: "module",
    });

    this.#handleWorker(metaData);
    this.#inVideoPlayerPage = true;
  }

  cleanup() {
    if (this.#streamClient) this.#streamClient.destroy();
    if (this.#mpv) this.#mpv.kill();
    if (this.#browserWindow && !this.#browserWindow.isVisible())
      this.#browserWindow.show();
    if (this.#worker && this.#worker.threadId !== -1) {
      this.#worker.postMessage({ type: "shutdown" });
      this.#worker = null;
    }
  }

  static async findMpvExecPath() {
    const fromPath = await MpvPlayerManager.#resolveMpvExecFromPATH();
    if (fromPath) return fromPath;

    const knownPaths =
      os.platform() === "win32"
        ? [
            "C:\\Program Files\\mpv\\mpv.exe",
            "C:\\Program Files (x86)\\mpv\\mpv.exe",
            path.join(os.homedir(), "AppData", "Local", "Programs", "mpv", "mpv.exe"),
            path.join(os.homedir(), "scoop", "apps", "mpv", "current", "mpv.exe"),
            "C:\\tools\\mpv\\mpv.exe",
            path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages", "mpv.exe"),
          ]
        : [
            "/usr/bin/mpv",
            "/usr/local/bin/mpv",
            "/snap/bin/mpv",
            "/flatpak/exports/bin/mpv",
            path.join(os.homedir(), ".local/bin/mpv"),
          ];

    for (const candidate of knownPaths) {
      if (fs.existsSync(candidate)) {
        log.info(`Found mpv at: ${candidate}`);
        return candidate;
      }
    }

    log.warn("Mpv executable path not found anywhere");
    return null;
  }

  static async #resolveMpvExecFromPATH() {
    const isWindows = os.platform() === "win32";
    const whichCommand = isWindows ? "where" : "which";

    return new Promise((resolve) => {
      const proc = spawn(whichCommand, ["mpv"], { encoding: "utf8" });
      let stdout = "";
      proc.stdout.on("data", (data) => (stdout += data.toString()));
      proc.on("close", (code) => {
        if (code !== 0 || !stdout.trim()) {
          log.warn("mpv not found in PATH");
          return resolve(null);
        }
        const result = stdout.trim().split("\n")[0].trim();
        log.info(`Found mpv at: ${result}`);
        resolve(result);
      });
      proc.on("error", () => {
        log.warn("mpv not found in PATH");
        resolve(null);
      });
    });
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

  #handleWorker(metaData) {
    let handled = false;

    const exitVideoPlayerPage = () => {
      if (!this.#inVideoPlayerPage) return;
      this.#inVideoPlayerPage = false;
      this.#savePlaybackPosition(this.#lastSecondBeforeQuit, metaData);
      this.cleanup();
      this.#browserWindow.webContents.send("msg-from-main-process", {
        type: "request",
        request: "exit_video_player",
      });
    };

    const closeWorker = () => {
      if (this.#worker && this.#worker.threadId !== -1) {
        this.#worker.postMessage({ type: "shutdown" });
        this.#worker = null;
      }
      if (this.#browserWindow && !this.#browserWindow.isVisible())
        this.#browserWindow.show();
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

    this.#worker.on("message", (msg) => {
      if (msg.type !== "status") return;
      switch (msg.message) {
        case "Mpv output data":
          this.#handleMpvOutput(msg.data);
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

    this.#worker.on("error", (err) => {
      log.error("Mpv Worker thread error:", err);
      handleError(err.message);
    });

    this.#worker.on("exit", (code) => {
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

    if (line.includes("AV:")) {
      if (this.#browserWindow?.isVisible()) this.#browserWindow.hide();

      const [timePart, durationPart] = line.split("AV:")[1].split("/");
      const parseHMS = (str) => {
        const [h, m, s] = str.trim().split(":").map(Number);
        return (h * 60 + m) * 60 + s;
      };

      const videoDuration = parseHMS(durationPart);
      const currentPosition = parseHMS(timePart);

      this.#lastSecondBeforeQuit =
        currentPosition >= videoDuration - 120 ? 0 : currentPosition;
    }

    process.stdout.write(line);
  }

  #savePlaybackPosition(lastPbPosition, metaData) {
    const LibraryInfo = loadLibraryStorage();
    LibraryInfo.media ??= [];

    let found = false;

    for (const [index, item] of Object.entries(LibraryInfo.media)) {
      if (item.MediaId === metaData.MediaId && item.MediaType === metaData.MediaType) {
        LibraryInfo.media[index].lastPlaybackPosition = lastPbPosition;
        LibraryInfo.media[index].seasonNumber = metaData?.seasonNumber;
        LibraryInfo.media[index].episodeNumber = metaData?.episodeNumber;
        LibraryInfo.media[index].Magnet = metaData?.Magnet;
        LibraryInfo.media[index].bgImagePath = metaData?.bgImagePath;
        LibraryInfo.media[index].downloadPath = metaData?.downloadPath;
        LibraryInfo.media[index].fileName = metaData?.fileName;

        if (!LibraryInfo.media[index].typeOfSave.includes("Currently Watching")) {
          LibraryInfo.media[index].typeOfSave.push("Currently Watching");
          LibraryInfo.media[index].mediaImdbId ??= metaData?.mediaImdbId;
        }
        found = true;
      }
    }

    if (!found) {
      LibraryInfo.media.push({
        MediaId: metaData?.MediaId,
        MediaType: metaData?.MediaType,
        Magnet: metaData?.Magnet,
        bgImagePath: metaData?.bgImagePath,
        mediaImdbId: metaData?.mediaImdbId,
        downloadPath: metaData?.downloadPath,
        fileName: metaData?.fileName,
        lastPlaybackPosition: lastPbPosition,
        seasonNumber: metaData.seasonNumber,
        episodeNumber: metaData.episodeNumber,
        typeOfSave: ["Currently Watching"],
      });
    }

    overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
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
