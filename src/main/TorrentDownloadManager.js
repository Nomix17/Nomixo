import { QueuedWebTorrent } from './QueuedWebTorrent.js';
import {
  generateUniqueId,
  normaliseFileName,
  sendSystemNotification,
  truncate
} from './utils.js';

import {
  getDownloadEntry,
  insertNewDownloadEntry,
  saveDownloadProgress,
  editDownloadStorageEntry,
  removeDownloadStorageEntry,
} from "./storageManagement.js";

import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import path from "path";
import { mkdir } from 'fs/promises';
import fs from 'fs';

const DELAY_BEFORE_LIBRARY_SAVE_MS = 1000;
const DELAY_BEFORE_PIPING_MS = 400;

class TorrentDownloadManager {
  static MAX_DIR_NAME_LENGTH = 200;

  constructor(WINDOW, onPlayVideo) {
    this.WINDOW = WINDOW;
    this.onPlayVideo = onPlayVideo;
    this.downloadClient = new QueuedWebTorrent();
    Paths.downloadLibraryFilePath = path.join(Paths.__configs, "downloads.json");
  }

  async scheduleTorrentDownloads(torrentsEntries, downloadSubtitles = true) {
    const results = [];
    for (const torrentEntry of torrentsEntries) {
      try {
        const torrentDownloadPath = await this.getTorrentDownloadPath(torrentEntry);
        const torrentId = generateUniqueId(
          `${torrentEntry.IMDB_ID}-${torrentEntry.episodeNumber ?? "undefined"}-${torrentEntry.seasonNumber ?? "undefined"}-${torrentDownloadPath}`
        );
        torrentEntry.torrentId = torrentId;
        torrentEntry.downloadPath = torrentDownloadPath;
        torrentEntry.downloadSubtitles = downloadSubtitles;

        const { status } = await this.executeTorrentDownload(torrentEntry, false, downloadSubtitles);
        results.push({ success: true, torrentId, status });
      } catch (error) {
        log.error(`Error processing torrent:`, error);
        results.push({ success: false, error: error.message, torrentId: torrentEntry?.torrentId });
      }
    }
    return results;
  }

  async getTorrentDownloadPath(torrentEntry) {
    Paths.defaultDownloadPath = torrentEntry?.userDownloadPath ?? Paths.defaultDownloadPath;
    torrentEntry.dirName = this.sanitizeDirNameForOS(torrentEntry);
    const torrentDownloadPath = path.join(Paths.defaultDownloadPath, torrentEntry.dirName);
    await mkdir(torrentDownloadPath, { recursive: true });
    return torrentDownloadPath;
  }

  async executeTorrentDownload(torrentEntry, priority = false, downloadSubtitles = torrentEntry.downloadSubtitles ?? true) {
    torrentEntry.downloadSubtitles = downloadSubtitles;

    const { status, donePromise } = await this.downloadClient.add(
      torrentEntry, {}, priority,
      (startedTorrent) => this.attachTorrentHandlers(startedTorrent, torrentEntry),
      downloadSubtitles,
      async () => {
        const isNewEntry = await insertNewDownloadEntry(torrentEntry, "Subs-Download");
        this.pushStatusUpdate([
          { status: isNewEntry ? "NEW_DOWNLOAD" : "SUBS_DOWNLOAD", torrentId: torrentEntry.torrentId }
        ]);
      }
    );

    if (status !== 'PAUSED') {
      const isNewEntry = await insertNewDownloadEntry(torrentEntry, status, priority);
      if (isNewEntry) {
        this.pushStatusUpdate([{ status: "NEW_DOWNLOAD", torrentId: torrentEntry.torrentId }]);
      }
    }
    this.watchForOutcome(donePromise, torrentEntry);

    return { status };
  }

  watchForOutcome(donePromise, torrentEntry) {
    donePromise
      .then((completedTorrent) =>
        this.pipeDownloadCompleteToRenderer(
          completedTorrent,
          torrentEntry,
          torrentEntry.Total ?? 0,
          torrentEntry.Downloaded ?? 0
        )
      )
      .catch((err) => {
        if (err?.name === 'TorrentCancelledError') return;
        log.error(`Torrent error: ${torrentEntry.torrentId}, ${err?.message ?? err}`);
        this.reportDownloadError("Torrent Download", torrentEntry.torrentId, err);
        this.WINDOW.webContents.send("download-progress-stream", {
          TorrentId: torrentEntry.torrentId,
          Status: "error",
          Error: err?.message
        });
      });
  }

  attachTorrentHandlers(torrent, torrentEntry) {
    log.info("Loading Torrent:", torrentEntry.torrentId);
    torrent.on("metadata", () => log.info("Metadata received"));
    torrent.on("warning", (warn) => log.warn("Torrent warning:", warn.message));

    torrent.on("ready", () => {
      log.info("Download Target: " + torrentEntry?.fileName);

      const targetFile = this.findFileInsideTorrent(torrent, torrentEntry?.fileName);
      if (!targetFile) {
        torrent.emit('error', new Error('No suitable video file found'));
        return;
      }

      torrent.files.forEach(file => file.deselect());
      targetFile.select();

      const totalSize = targetFile.length;
      let libraryStartTime = 0;
      let pipingStartTime = 0;

      let targetReachedFullAt = null;
      const COMPLETION_GRACE_MS = 3000;

      torrent.on("download", () => {
        const now = Date.now();
        const downloadedDataLength = targetFile.downloaded;
        torrentEntry.Total = totalSize;
        torrentEntry.Downloaded = downloadedDataLength;
        torrentEntry.poster = torrentEntry.posterUrl;

        if (now - libraryStartTime >= DELAY_BEFORE_LIBRARY_SAVE_MS) {
          saveDownloadProgress(torrentEntry, downloadedDataLength, totalSize);
          libraryStartTime = now;
        }

        if (now - pipingStartTime >= DELAY_BEFORE_PIPING_MS) {
          this.pipeDownloadProgressToRenderer(torrentEntry, torrent.downloadSpeed, totalSize, downloadedDataLength);
          pipingStartTime = now;
        }

        if (downloadedDataLength >= totalSize) {
          if (targetReachedFullAt === null) {
            targetReachedFullAt = now;
          } else if (!torrent.done && now - targetReachedFullAt >= COMPLETION_GRACE_MS) {
            log.warn(
              `Target file for ${torrentEntry.torrentId} finished but torrent.done didn't trigger`
            );
            targetReachedFullAt = -Infinity;
            torrent.emit('done');
          }
        } else {
          targetReachedFullAt = null;
        }
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
      Status: "DONE"
    };

    torrentEntry.Status = "DONE";
    saveDownloadProgress(torrentEntry, downloadedDataLength, totalSize);

    try {
      await new Promise((resolve, reject) => {
        torrent.destroy({ destroyStore: false }, (err) => (err ? reject(err) : resolve()));
      });

      const body = [
        truncate(torrentEntry?.Title || 'Unknown title'),
        torrentEntry?.Year,
        torrentEntry?.Quality
      ].filter(Boolean).join(' • ');

      const torrentLibEntry = await getDownloadEntry(torrentEntry.torrentId);
      sendSystemNotification({
        title: "Download Complete",
        body: body,
        icon: torrentLibEntry?.posterPath,
        onClick: () => this.onPlayVideo(torrentLibEntry)
      });
      log.info(`Torrent cleaned up: ${torrentEntry.torrentId}`);
    } catch (err) {
      log.error(err.message);
    }

    log.success(`Download completed: ${torrentEntry.torrentId}`);
    this.WINDOW.webContents.send("download-progress-stream", jsonMessage);
  }

  reportDownloadError(errorType, torrentId, err) {
    this.WINDOW.webContents.send("report-download-errors", {
      type: errorType,
      torrentId: torrentId,
      err_msg: err?.message ?? err
    });
  }

  async pushStatusUpdate(changes) {
    this.WINDOW.webContents.send("update-download-status", changes);

    for (const change of changes) {
      if (!change.status || !change.torrentId) continue;

      editDownloadStorageEntry(change.torrentId, "Status", change?.status)
        .catch((err) => log.error(`Failed to persist status for ${change.torrentId}:`, err.message));
    }
  }

  toggleTorrentDownload(torrentId) {
    return this.downloadClient.isCurrentlyDownloading(torrentId)
      ? this.pauseTorrentDownload(torrentId)
      : this.continueTorrentDownload(torrentId);
  }

  async continueTorrentDownload(torrentId) {
    const currentTorrentId = this.downloadClient.current?.info?.torrentId ?? null;
    const optimistic = [{ status: "LOADING", torrentId }];
    if (currentTorrentId && currentTorrentId !== torrentId) {
      optimistic.push({ status: "QUEUED", torrentId: currentTorrentId });
    }

    this.pushStatusUpdate(optimistic);
    this._continueTorrentDownload(torrentId).catch((err) => {
      log.error(err.message);
      this.pushStatusUpdate([{ status: "failed", error: err.message, torrentId }]);
    });
    return optimistic;
  }

  async _continueTorrentDownload(torrentId) {
    const torrentEntry = await getDownloadEntry(torrentId);
    if (torrentEntry == null) {
      log.error("Empty download library, cannot continue download for", torrentId);
      this.pushStatusUpdate([{ status: "empty download library", torrentId }]);
      return;
    }

    try {
      await editDownloadStorageEntry([torrentEntry.torrentId], "Status", "Loading");

      if (torrentEntry.Status === "QUEUED") {
        const changes = await this.downloadClient.startQueuedTorrent(torrentId);
        this.pushStatusUpdate(changes);
        return;
      }

      await this.executeTorrentDownload(torrentEntry, true);
      const queuedTorrents = this.downloadClient
        .getQueueTorrentIds()
        .map((id) => ({ status: "QUEUED", torrentId: id }));
      
      return [{ status: "LOADING", torrentId }, ...queuedTorrents];

      this.pushStatusUpdate([{ status: "continued", torrentId }, ...queuedTorrents]);
    } catch (err) {
      log.error(err.message);
      return [{ status: "FAILED", error: err.message, torrentId }];
      await editDownloadStorageEntry([torrentEntry.torrentId], "Status", "PAUSED");
      this.pushStatusUpdate([{ status: "failed", error: err.message, torrentId }]);
    }
  }

  predictNextQueuedTorrentId() {
    return this.downloadClient.getQueueTorrentIds()[0] ?? null;
  }

  pauseTorrentDownload(torrentId) {
    const nextTorrentId = this.predictNextQueuedTorrentId();
    const optimistic = [{ status: "PAUSED", torrentId }];
    if (nextTorrentId) {
      optimistic.push({ status: "LOADING", torrentId: nextTorrentId });
    }
    this.pushStatusUpdate(optimistic);

    this._pauseTorrentDownload(torrentId).catch((err) => {
      log.error(err.message);
      const revert = [{ status: "FAILED", error: err.message, torrentId }];
      if (nextTorrentId) revert.push({ status: "QUEUED", torrentId: nextTorrentId });
      this.pushStatusUpdate(revert);
    });
    return optimistic;
  }

  async _pauseTorrentDownload(torrentId) {
    const torrentEntry = await getDownloadEntry(torrentId);
    if (!torrentEntry) {
      throw new Error(`Cannot find torrent with Id: ${torrentId}`);
    }
    const res = await this.downloadClient.cancelDownload(torrentId);
    this.pushStatusUpdate(res);
  }

  cancelTorrentDownload(torrentEntry) {
    const nextTorrentId = this.predictNextQueuedTorrentId();
    const optimistic = [{ status: "PAUSED", torrentId: torrentEntry.torrentId }];
    if (nextTorrentId) {
      optimistic.push({ status: "LOADING", torrentId: nextTorrentId });
    }

    this.pushStatusUpdate(optimistic);

    this._cancelTorrentDownload(torrentEntry).catch((err) => {
      log.error(err.message);
      this.pushStatusUpdate([{ status: "FAILED", error: err.message, torrentId: torrentEntry.torrentId }]);
    });
    return optimistic;
  }

  async _cancelTorrentDownload(torrentEntry) {
    const res = await this.downloadClient.cancelDownload(torrentEntry.torrentId);
    this.pushStatusUpdate(res);

    const downloadPath = torrentEntry.downloadPath;
    if (downloadPath && fs.existsSync(downloadPath)) {
      await fs.promises.rm(downloadPath, { recursive: true, force: true });
      log.info(`Removed directory: ${downloadPath}`);
    }
    await removeDownloadStorageEntry(torrentEntry.torrentId);
  }

  addToQueue(torrentId) {
    const queuedTorrents = this.downloadClient
      .getQueueTorrentIds()
      .map((id) => ({ status: "QUEUED", torrentId: id }));
    const optimisticStatus = this.downloadClient.current == null ? "LOADING" : "QUEUED";

    this._addToQueue(torrentId).catch((err) => {
      log.error(err.message);
      this.pushStatusUpdate([{ status: "FAILED", error: err.message, torrentId }]);
    });

    return [...queuedTorrents, { torrentId, status: optimisticStatus }];
  }

  async _addToQueue(torrentId) {
    const torrentEntry = await getDownloadEntry(torrentId);
    const { status } = await this.executeTorrentDownload(torrentEntry);
    this.pushStatusUpdate([{ torrentId, status: status }]);
  }

  removeTorrentFromQueue(torrentId) {
    const wasQueued = this.downloadClient.getQueueTorrentIds().includes(torrentId);
    if (!wasQueued) {
      log.error("Queue does not contain torrent with Id:", torrentId);
      return [{ status: "torrent not found in queue", torrentId }];
    }

    const optimistic = [{ status: "PAUSED", torrentId }];
    this.pushStatusUpdate(optimistic);

    this.downloadClient.cancelDownload(torrentId)
      .then((res) => this.pushStatusUpdate(res))
      .catch((err) => {
        log.error(err.message);
        this.pushStatusUpdate([{ status: "FAILED", error: err.message, torrentId }]);
      });
    return optimistic;
  }

  shiftQueuedElement(torrentId, offset) {
    return this.downloadClient.shiftQueuedItem(torrentId, offset);
  }

  findFileInsideTorrent(torrent, targetFileName) {
    const filesPathsHashMap = {};
    const files = torrent.files ?? [];
    for (let fileInsideTorrent of files) {
      if (targetFileName === fileInsideTorrent.name) {
        return fileInsideTorrent;
      }
      filesPathsHashMap[normaliseFileName(fileInsideTorrent.name)] = fileInsideTorrent;
    }
    return filesPathsHashMap[normaliseFileName(targetFileName)] ?? null;
  }

  sanitizeDirNameForOS(torrentEntry) {
    const { dirName, seasonNumber, episodeNumber } = torrentEntry;
    if (dirName.length <= TorrentDownloadManager.MAX_DIR_NAME_LENGTH) return dirName;
    const dirId = generateUniqueId(dirName);

    return seasonNumber && episodeNumber
      ? `${dirName.slice(0, 120)}-S${seasonNumber}E${episodeNumber}-${dirId}`
      : `${dirName.slice(0, 120)}-${dirId}`;
  }
}

export default TorrentDownloadManager;
