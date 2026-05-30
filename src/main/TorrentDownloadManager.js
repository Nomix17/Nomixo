import SubDownloadManager from "./SubDownloadManager.js";
import { 
  generateUniqueId,
  normaliseFileName,
  sendSystemNotification,
  truncate
} from './utils.js';

import {
  loadDownloadStorage,
  getDownloadEntry,
  insertNewDownloadEntry, 
  saveDownloadProgress,
  editDownloadStorageEntry,
  removeDownloadStorageEntry,
} from "./storageManagement.js";

import {Paths} from "./FilesManager.js";
import {log} from "./debugging.js";
import WebTorrent from 'webtorrent';
import path from "path";
import fs from 'fs';


class TorrentDownloadManager {
  constructor(WINDOW) {
    this.WINDOW = WINDOW;
    this.DownloadClient = new WebTorrent();
    this.torrentTrackersPromise = this.getTorrentTrackers();
    this.downloadingMediaHashMap = {};
    this.downloadQueue = [];
    Paths.downloadLibraryFilePath = path.join(Paths.__configs, "downloads.json");
  }

  async scheduleTorrentDownloads(torrentsEntries, subsObjects) {
    const results = [];
    for (const torrentEntry of torrentsEntries) {
      try {
        Paths.defaultSystemDownloadDir = torrentEntry?.userDownloadPath ?? Paths.defaultSystemDownloadDir;
        torrentEntry.dirName = this.formatDownloadRootDirName(torrentEntry);
        const torrentDownloadRootDirPath = path.join(Paths.defaultSystemDownloadDir, torrentEntry.dirName);
        fs.mkdirSync(torrentDownloadRootDirPath, { recursive: true });

        const torrentId = generateUniqueId(
          `${torrentEntry.IMDB_ID}-${torrentEntry.episodeNumber ?? "undefined"}-${torrentEntry.seasonNumber ?? "undefined"}-${torrentDownloadRootDirPath}`
        );
        torrentEntry["torrentId"] = torrentId;
        torrentEntry["downloadPath"] = torrentDownloadRootDirPath;

        // Download subs
        try {
          if (subsObjects != null) {
            SubDownloadManager.downloadSubs(subsObjects, torrentId, torrentDownloadRootDirPath);
          } else {
            log.warn("Subtitles Download Skipped");
          }
        } catch (error) {
          this.reportDownloadError("Subtitles Download", torrentId, error);
          log.error(error);
        }

        // Download the torrent
        try {
          const clientIsBusy = this.DownloadClient.torrents.length;
          if (!clientIsBusy) {
            await this.executeTorrentDownload(torrentEntry);
            results.push({ success: true, torrentId });
          } else {
            insertNewDownloadEntry(torrentEntry, "Queued").then((isNewEntry) => {
              if(isNewEntry)
                this.WINDOW.webContents.send("download-progress-stream", { Status: "NewDownload" });
            });
            if (!this.downloadQueue.find(ele => ele.torrentId === torrentEntry.torrentId))
              this.downloadQueue.push(torrentEntry);
          }
        } catch (error) {
          this.reportDownloadError("Torrent Download", torrentId, error);
          log.error(error);
          results.push({ success: false, error: error.message, torrentId });
        }

      } catch (err) {
        log.error(`Error processing torrent:`, err);
        results.push({ success: false, error: err.message });
      }
    }
    return results;
  }

  async executeTorrentDownload(torrentEntry) {
    const trackers = await this.torrentTrackersPromise;
    const torrent = this.DownloadClient.add(torrentEntry.MagnetLink, {
      path: torrentEntry.downloadPath,
      announce: trackers
    });

    this.downloadingMediaHashMap[torrentEntry.torrentId] = { torrentInstance: torrent, torrentEntry };

    insertNewDownloadEntry(torrentEntry).then((isNewEntry) => {
      if(isNewEntry)
        this.WINDOW.webContents.send("download-progress-stream", { Status: "NewDownload" });
    });;

    return new Promise((resolve, reject) => {
      log.info("Loading Torrent:", torrentEntry.torrentId);
      torrent.on("metadata", () => log.info("Metadata received"));
      torrent.on("warning", (warn) => log.warn("Torrent warning:", warn.message));

      torrent.on("ready", () => {
        log.info("Download Target: " + torrentEntry?.fileName);
        console.log("\nTorrent Files:-----------------------------------------------------");
        torrent.files.forEach(f => { console.log(f.name) });
        console.log("-------------------------------------------------------------------\n");

        const targetFile = this.findFileInsideTorrent(torrent, torrentEntry?.fileName);
        if (!targetFile) {
          reject(new Error('No suitable video file found'));
          return;
        }

        torrent.files.forEach(file => { file.deselect() });
        targetFile.select();

        const totalSize = targetFile.length;
        let LibraryStartTime = 0;
        let PipingStartTime = 0;
        const DelayBeforeLibrarySave = 1000;
        const DelayBeforePiping = 400;

        torrent.on("download", async () => {
          const now = Date.now();
          const downloadedDataLength = targetFile.downloaded;
          torrentEntry["Total"] = totalSize;
          torrentEntry["Downloaded"] = downloadedDataLength;
          torrentEntry["poster"] = torrentEntry.posterUrl;

          if (totalSize <= downloadedDataLength) {
            await this.pipeDownloadCompleteToRenderer(torrent, torrentEntry, totalSize, downloadedDataLength);
            resolve();
            return;
          }

          if (now - LibraryStartTime >= DelayBeforeLibrarySave) {
            saveDownloadProgress(torrentEntry, downloadedDataLength, totalSize);
            LibraryStartTime = now;
          }

          if (now - PipingStartTime >= DelayBeforePiping) {
            this.pipeDownloadProgressToRenderer(torrentEntry, torrent.downloadSpeed, totalSize, downloadedDataLength); //problem is here
            PipingStartTime = now;
          }
        });
      });

      torrent.on("error", (err) => {
        log.error(`Torrent error: ${torrentEntry.torrentId}, ${err}`);
        torrent.destroy(() => {
          this.deleteTorrentFromMediaHashMap(torrentEntry.torrentId);
          this.downloadNextTorrentInQueue();
        });

        this.WINDOW.webContents.send("download-progress-stream", {
          TorrentId: torrentEntry.torrentId,
          Status: "error",
          Error: err.message
        });

        reject(err);
      });
    });
  }

  pipeDownloadProgressToRenderer(torrentEntry, downloadSpeed, totalSize, downloadedDataLength) {
    const jsonMessage = {
      TorrentId: torrentEntry.torrentId,
      Downloaded: downloadedDataLength,
      Total: totalSize,
      DownloadPath: torrentEntry.downloadPath,
      DownloadSpeed: downloadSpeed,
      Status: "Downloading"
    };
    this.WINDOW.webContents.send("download-progress-stream", jsonMessage);
    log.info(
      `Downloading ${torrentEntry.dirName}: ` +
      `${((downloadedDataLength / totalSize) * 100).toFixed(2)}%, ` +
      `${(downloadSpeed / 1024).toFixed(2)} KB/s`
    );
  }

  async pipeDownloadCompleteToRenderer(torrent, torrentEntry, totalSize, downloadedDataLength) {
    const jsonMessage = {
      TorrentId: torrentEntry.torrentId,
      Downloaded: downloadedDataLength,
      Total: totalSize,
      DownloadPath: torrentEntry.downloadPath,
      Status: "Done"
    };

    torrentEntry["Status"] = "Done";
    saveDownloadProgress(torrentEntry, downloadedDataLength, totalSize);

    // try {
      await this.destroyDownloadingTorrent(torrent, torrentEntry.torrentId);
      const body = [
        truncate(torrentEntry?.Title || 'Unknown title'),
        torrentEntry?.Year,
        torrentEntry?.Quality
      ].filter(Boolean).join(' • ');

      const [torrentLibEntry] = await getDownloadEntry(torrentEntry.torrentId);
      sendSystemNotification({
        title: "Download Complete",
        body: body,
        icon: torrentLibEntry.posterPath,
        onClick: () => playVideoOverMpv(torrentLibEntry)
      });
      log.info(`Torrent cleaned up: ${torrentEntry.torrentId}`);
    // } catch (err) {
    //   log.error(err.message);
    // }

    log.success(`Download completed: ${torrentEntry.torrentId}`);
    this.WINDOW.webContents.send("download-progress-stream", jsonMessage);
    this.downloadNextTorrentInQueue();
  }

  async downloadNextTorrentInQueue() {
    if (this.downloadQueue.length) {
      const nextTorrent = this.downloadQueue.shift();
      if (nextTorrent?.torrentId) {
        this.executeTorrentDownload(nextTorrent);
        await editDownloadStorageEntry([nextTorrent.torrentId], "Status", "Downloading");
        this.WINDOW.webContents.send("update-download-categorie", [{ response: "continued", torrentId: nextTorrent.torrentId }]);
      }
      return nextTorrent?.torrentId;
    }
  }

  formatDownloadRootDirName(torrentEntry) {
    const MAX_LENGTH = 200;
    if (torrentEntry.dirName.length > MAX_LENGTH) {
      const dirId = generateUniqueId(torrentEntry.dirName);
      const prefix = torrentEntry.dirName.slice(0, 120);

      let newName = prefix;
      if (torrentEntry.seasonNumber && torrentEntry.episodeNumber) {
        newName += `-S${torrentEntry.seasonNumber}E${torrentEntry.episodeNumber}`;
      }

      return `${newName}-${dirId}`;
    }
    return torrentEntry.dirName;
  }

  reportDownloadError(errorType, torrentId, err) {
    this.WINDOW.webContents.send("report-download-errors", {
      type: errorType,
      torrentId: torrentId,
      err_msg: err
    });
  }

  deleteTorrentFromMediaHashMap(torrentId) {
    if (this.downloadingMediaHashMap[torrentId])
      delete this.downloadingMediaHashMap[torrentId];
  }

  async pauseTorrentDownload(torrentId) {
    const targetTorrent = this.downloadingMediaHashMap[torrentId]?.torrentInstance;
    try {
      await this.pauseTargetedTorrent(targetTorrent, torrentId);
      this.downloadNextTorrentInQueue();
      return [{ response: "paused", torrentId }];
    } catch (err) {
      log.error(err.message);
      return [{ response: "failed", error: err.message, torrentId }];
    }
  }

  async continueTorrentDownload(torrentId) {
    const targetTorrent = this.downloadingMediaHashMap[torrentId]?.torrentInstance;
    const wholeDownloadLibrary = await loadDownloadStorage();
    const torrentEntry = wholeDownloadLibrary?.downloads?.find(
      element => element.torrentId === torrentId
    );

    if (torrentEntry != null) {
      let queuedTorrents = [];
      try {
        queuedTorrents = await this.addDownloadingTorrentToQueue();
      } catch (err) {
        log.error(err.message);
        return [{ response: "failed", error: err.message, torrentId }];
      }

      try {
        this.executeTorrentDownload(torrentEntry);
        this.downloadQueue = this.downloadQueue.filter(ele => ele.torrentId != torrentId);
      } catch (err) {
        log.error(err.message);
        await editDownloadStorageEntry([torrentEntry.torrentId], "Status", "Loading");
        this.pauseTargetedTorrent(targetTorrent, torrentId);
        return [{ response: "failed", error: err.message, torrentId }];
      }

      return [{ response: "continued", torrentId }, ...queuedTorrents];

    } else {
      log.error("Empty download library, cannot continue download for", torrentId);
      return [{ response: "empty download library", torrentId }];
    }
  }

  async toggleTorrentDownload(torrentId) {
    const targetTorrent = this.downloadingMediaHashMap[torrentId]?.torrentInstance;
    return targetTorrent
      ? await this.pauseTorrentDownload(torrentId)
      : await this.continueTorrentDownload(torrentId);
  }

  async cancelTorrentDownload(torrentEntry) {
    const torrentId = torrentEntry.torrentId;
    const targetTorrent = this.downloadingMediaHashMap?.[torrentId]?.torrentInstance;

    if (targetTorrent) {
      if (this.downloadQueue[0] != null)
        this.WINDOW.webContents.send(
          "update-download-categorie",
          [{ response: "continued", torrentId: this.downloadQueue[0]?.torrentId }]
        );

      await new Promise((resolve, reject) => {
        try {
          targetTorrent.destroy(() => {
            this.deleteTorrentFromMediaHashMap(torrentId);
            log.info(`Torrent cancelled: ${torrentId}`);
            resolve();
          });
        } catch (error) {
          log.error(error.message);
          if (this.downloadQueue[0] != null)
            this.WINDOW.webContents.send(
              "update-download-categorie",
              [{ response: "paused", torrentId: this.downloadQueue[0]?.torrentId }]
            );
          reject();
        }
      });
    }

    this.downloadQueue = this.downloadQueue.filter(element => element.torrentId !== torrentId);

    const downloadPath = torrentEntry.downloadPath;
    if (downloadPath && fs.existsSync(downloadPath)) {
      await fs.promises.rm(downloadPath, { recursive: true, force: true });
      log.info(`Removed directory: ${downloadPath}`);
    }
    await removeDownloadStorageEntry(torrentId);
    await this.downloadNextTorrentInQueue();

    return { success: true, torrentId };
  }

  async downloadOrQueueTorrent(torrentId) {
    const wholeDownloadLibrary = await loadDownloadStorage();
    const targetTorrentInfo = wholeDownloadLibrary?.downloads?.find(
      element => element.torrentId === torrentId
    );

    if (targetTorrentInfo) {
      const currentlyDownloadingTorrents = Object.values(this.downloadingMediaHashMap);
      if (!currentlyDownloadingTorrents.length) {
        this.executeTorrentDownload(targetTorrentInfo);
        return [{ response: "continued", torrentId }];
      } else {
        this.downloadQueue.push(targetTorrentInfo);
        return [{ response: "queued", torrentId }];
      }
    } else {
      log.error("Empty download library, cannot continue download for", torrentId);
      return [{ response: "empty download library", torrentId }];
    }
  }

  removeTorrentFromQueue(torrentId) {
    const target = this.downloadQueue.find(el => el.torrentId === torrentId);

    if (target != null) {
      this.downloadQueue = this.downloadQueue.filter(el => el.torrentId !== torrentId);
      return [{ response: "paused", torrentId }];
    } else {
      log.error("Queue does not contain torrent with Id:", torrentId);
      return [{ response: "torrent not found in queue", torrentId }];
    }
  }

  shiftQueuedElement(torrentId, offset) {
    const currentTorrentIndex = this.downloadQueue.findIndex(ele => ele.torrentId === torrentId);

    if (currentTorrentIndex !== -1) {
      const torrentElement = this.downloadQueue[currentTorrentIndex];
      this.downloadQueue.splice(currentTorrentIndex, 1);
      this.downloadQueue.splice(currentTorrentIndex + offset, 0, torrentElement);
      log.info("Reordering Download Queue");
    } else {
      log.error(`Cannot find torrent element in download queue by id: ${torrentId}`);
    }

    return this.downloadQueue.map(el => el.torrentId);
  }

  async getTorrentTrackers() {
    try {
      const urls = [
        'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
      ];

      const results = await Promise.all(urls.map(u => fetch(u).then(r => r.text())));
      const trackers = results
        .flatMap(text => text.trim().split('\n\n'))
        .filter(Boolean);

      log.success(`Loaded ${trackers.length} trackers`);
      return trackers;
    } catch (err) {
      log.warn(
        `Failed to load ngosang trackers list, falling back to preset trackers.\n` +
        `Reason: ${err.message ?? err}`
      );
      return [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://open.demonii.com:1337/announce',
        'udp://tracker.openbittorrent.com:6969/announce',
        'udp://tracker.torrent.eu.org:451/announce',
        'udp://explodie.org:6969/announce',
        'udp://tracker.empire-js.us:1337/announce',
      ];
    }
  }

  destroyDownloadingTorrent(torrent, torrentId, keepInQueue=false) {
    return new Promise((res, rej) => {
      this.deleteTorrentFromMediaHashMap(torrentId);
      const index = this.downloadQueue.findIndex(item => item.torrentId === torrentId);
      if (index !== -1) {
        const [element] = this.downloadQueue.splice(index, 1);
        if(keepInQueue) this.downloadQueue.push(element);
      }
      try {
        torrent.destroy(res);
      } catch (err) {
        rej(err);
      }
    });
  }

  async addDownloadingTorrentToQueue() {
    const queuedTorrents = [];

    const currentlyDownloadingTorrents = Object.values(this.downloadingMediaHashMap);
    for (const downloadingTorrent of currentlyDownloadingTorrents) {
      let torrentInstance = downloadingTorrent.torrentInstance;
      let torrentEntry = downloadingTorrent.torrentEntry;
      let pausedTorrentId = await this.pauseTargetedTorrent(torrentInstance, torrentEntry.torrentId);
      queuedTorrents.push({ response: "queued", torrentId: pausedTorrentId });
      if (!this.downloadQueue.find(ele => ele.torrentId === torrentEntry.torrentId))
        this.downloadQueue.push(torrentEntry);
    }
    return queuedTorrents;
  }

  async  pauseTargetedTorrent(torrent, torrentId) {
    if(!torrent) {
      throw new Error(`Failed to pause: ${torrent}`);
    }

    if(!torrentId) {
      throw new Error(`Cannot find the torrent Id ${torrentId}`)
    }

    this.destroyDownloadingTorrent(torrent,torrentId, true);
    log.info(`Torrent Paused: ${torrentId}`);
    return torrentId;
  }

  findFileInsideTorrent(torrent, targetFileName) {
    const filesPathsHashMap = {};
    const files = torrent.files ?? [];
    for(let fileInsideTorrent of files){
      if (targetFileName === fileInsideTorrent.name) {
        return fileInsideTorrent;
      }
      filesPathsHashMap[normaliseFileName(fileInsideTorrent.name)] = fileInsideTorrent;
    }
    return filesPathsHashMap[normaliseFileName(targetFileName)] ?? null;
  }
}

export default TorrentDownloadManager;
