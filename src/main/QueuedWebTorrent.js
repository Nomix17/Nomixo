import WebTorrent from "webtorrent";
import { getTorrentTrackers } from './torrentTracker.js';
import { log } from "./debugging.js";
import { SubDownloadManager } from "./SubDownloadManager.js";

class TorrentCancelledError extends Error {
  constructor(torrentId) {
    super(`Torrent cancelled: ${torrentId}`);
    this.name = 'TorrentCancelledError';
    this.torrentId = torrentId;
  }
}

export class QueuedWebTorrent {
  constructor(opts) {
    this.client = new WebTorrent(opts);
    this.queue = [];
    this.current = null;
  }

  async add(torrentInfo, opts = {}, priority = false, onStart = null, downloadSubtitles = true, onSubtitlesStart = null) {
    const item = { torrentInfo, opts, onStart, downloadSubtitles, onSubtitlesStart };
    const donePromise = new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
    item.donePromise = donePromise;
    donePromise.catch(() => {});

    if (priority && this.current) {
      await this._pauseCurrentToFront();
    }

    if (!this.current) {
      this._startTorrentSafe(item);
      return {
        torrent: null,
        status: 'LOADING',
        donePromise
      };
    }

    if (priority) {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }
    return { torrent: null, status: 'QUEUED', donePromise };
  }

  async _pauseCurrentToFront() {
    const item = this.current;
    this.current = null;

    this.queue.unshift({
      torrentInfo: item.info,
      opts: item.opts,
      resolve: item.resolve,
      reject: item.reject,
      onStart: item.onStart,
      downloadSubtitles: item.downloadSubtitles,
      onSubtitlesStart: item.onSubtitlesStart
    });

    try {
      SubDownloadManager.abortDownload(item.info.torrentId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }

    if (item.instance) {
      item.instance.removeAllListeners('done');
      item.instance.removeAllListeners('error');
      item.instance.destroy({ destroyStore: false }, (err) => {
        if (err) log.error(`Error destroying torrent ${item.info.torrentId} while pausing to front:`, err);
      });
    }
  }

  async _startTorrent(item) {
    this.current = {
      instance: null,
      info: item.torrentInfo,
      opts: item.opts,
      resolve: item.resolve,
      reject: item.reject,
      onStart: item.onStart,
      downloadSubtitles: item.downloadSubtitles,
      onSubtitlesStart: item.onSubtitlesStart
    };

    if (item.downloadSubtitles) {
      log.info(`Downloading subtitles: ${item.torrentInfo.torrentId}`);
      item.onSubtitlesStart?.(item.torrentInfo);
      await SubDownloadManager.downloadSubsForMedia(
        item.torrentInfo,
        item.torrentInfo.torrentId,
        item.torrentInfo.downloadPath
      ).catch(err => log.error(`Subtitle download failed for ${item.torrentInfo.torrentId}:`, err));

      if (this.current?.info?.torrentId !== item.torrentInfo.torrentId) {
        return null;
      }
    }

    const trackers = await getTorrentTrackers();
    const torrent = this.client.add(item.torrentInfo.MagnetLink, {
      ...item.opts,
      path: item.torrentInfo.downloadPath,
      announce: trackers
    });

    if (this.current?.info?.torrentId !== item.torrentInfo.torrentId) {
      log.info(`Discarding orphaned torrent (superseded during add): ${item.torrentInfo.torrentId}`);
      await new Promise((resolve) => {
        torrent.destroy({ destroyStore: false }, (err) => {
          if (err) log.error(`Error destroying orphaned torrent ${item.torrentInfo.torrentId}:`, err);
          resolve();
        });
      });
      return null;
    }

    this.current.instance = torrent;
    item.onStart?.(torrent);

    torrent.on('done', () => {
      if (this.current?.info?.torrentId !== item.torrentInfo.torrentId) return;
      log.info(`Finished: ${torrent.name}`);
      item.resolve(torrent);
      this.current = null;
      this._processQueue();
    });

    torrent.on('error', (err) => {
      if (this.current?.info?.torrentId !== item.torrentInfo.torrentId) return;
      log.error(`Error on ${item.torrentInfo.torrentId}:`, err);
      item.reject(err);
      this.current = null;
      this._processQueue();
    });

    return torrent;
  }

  _processQueue() {
    if (this.current || this.queue.length === 0) return;
    const item = this.queue.shift();
    this._startTorrentSafe(item);
  }

  _startTorrentSafe(item) {
    return this._startTorrent(item).catch((err) => {
      log.error(`Failed to start torrent ${item.torrentInfo.torrentId}:`, err);
      if (this.current?.info?.torrentId === item.torrentInfo.torrentId) {
        this.current = null;
      }
      item.reject?.(err);
      this._processQueue();
    });
  }

  async cancelDownload(torrentId) {
    if (this.current?.info?.torrentId === torrentId) {
      log.info(`Torrent cancelled: ${torrentId}`);

      const item = this.current;
      this.current = null;

      const changes = [{ status: 'PAUSED', torrentId }];
      const nextItem = this.queue[0];
      if (nextItem) {
        this._processQueue();
        changes.push({ status: 'LOADING', torrentId: nextItem.torrentInfo.torrentId });
      }

      this._retireItem(item);
      return changes;
    }

    const queuedIndex = this.queue.findIndex(t => t.torrentInfo.torrentId === torrentId);
    if (queuedIndex !== -1) {
      log.info(`Torrent cancelled: ${torrentId}`);
      const [queuedItem] = this.queue.splice(queuedIndex, 1);
      this._retireItem(queuedItem);
      return [{ status: 'PAUSED', torrentId }];
    }

    this._processQueue();
    return [];
  }

  async clearQueue() {
    const itemsToCancel = [...this.queue];
    this.queue = [];
    itemsToCancel.forEach(item => this._retireItem(item));
    return itemsToCancel.map(item => ({
      status: 'PAUSED',
      torrentId: item.torrentInfo.torrentId
    }));
  }

  _retireItem(item) {
    const torrentInfo = item.info ?? item.torrentInfo;

    try {
      SubDownloadManager.abortDownload(torrentInfo.torrentId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }

    item.reject?.(new TorrentCancelledError(torrentInfo.torrentId));

    if (item.instance) {
      item.instance.removeAllListeners('done');
      item.instance.removeAllListeners('error');
      item.instance.destroy({ destroyStore: false }, (err) => {
        if (err) log.error(`Error destroying torrent ${torrentInfo.torrentId}:`, err);
      });
    }
  }

  async requeueDownload() {
    if (!this.current) {
      throw new Error('No torrent currently downloading to requeue');
    }

    const item = this.current;
    this.current = null;

    this.queue.push({
      torrentInfo: item.info,
      opts: item.opts,
      resolve: item.resolve,
      reject: item.reject,
      onStart: item.onStart,
      downloadSubtitles: item.downloadSubtitles,
      onSubtitlesStart: item.onSubtitlesStart
    });

    try {
      SubDownloadManager.abortDownload(item.info.torrentId);
    } catch (error) {
      if (error.name !== 'AbortError') {
        throw error;
      }
    }

    if (item.instance) {
      item.instance.removeAllListeners('done');
      item.instance.removeAllListeners('error');
      item.instance.destroy({ destroyStore: false }, (err) => {
        if (err) log.error(`Error destroying torrent ${item.info.torrentId} while requeuing:`, err);
      });
    }
  }

  shiftQueuedItem(torrentId, offset) {
    const targetIndex = this.queue.findIndex(
      ele => ele.torrentInfo.torrentId === torrentId
    );

    if (targetIndex !== -1) {
      const target = this.queue[targetIndex];
      this.queue.splice(targetIndex, 1);

      const newIndex = Math.max(
        0,
        Math.min(this.queue.length, targetIndex + offset)
      );
      this.queue.splice(newIndex, 0, target);
      log.info("Reordering Download Queue");

    } else {
      log.error(`Cannot find torrent element in download queue by id: ${torrentId}`);
    }

    return this.getQueueTorrentIds();
  }

  getQueueTorrentIds() {
    return this.queue.map(el => el.torrentInfo.torrentId);
  }

  async startQueuedTorrent(torrentId) {
    const changes = [];

    const targetIndex = this.queue.findIndex(
      ele => ele.torrentInfo.torrentId === torrentId
    );

    if (targetIndex === -1) {
      log.error(`Cannot find torrent in queue to start: ${torrentId}`);
      return [];
    }

    if (this.current && this.current.info.torrentId !== torrentId) {
      const previousId = this.current.info.torrentId;
      await this.requeueDownload();
      changes.push({ status: 'QUEUED', torrentId: previousId });
    }

    const idx = this.queue.findIndex(
      ele => ele.torrentInfo.torrentId === torrentId
    );

    if (idx === -1) {
      log.error(`Torrent disappeared from queue: ${torrentId}`);
      return changes;
    }

    const [target] = this.queue.splice(idx, 1);
    this.queue.unshift(target);

    log.info(`Starting queued torrent: ${torrentId}`);
    this._processQueue();

    changes.push({ status: 'LOADING', torrentId });
    return changes;
  }

  isCurrentlyDownloading(torrentId) {
    return this.current && this.current?.info?.torrentId === torrentId
  }

  getCurrentDownloadInfo() {
    return this.current?.info ?? null;
  }

  destroy(cb) {
    this.client.destroy(cb);
  }
}
