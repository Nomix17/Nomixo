import { createWriteStream, existsSync, unlinkSync } from "fs";
import { mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { join } from "path";
import { config } from "./config.js";
import { log } from "./debugging.js";


export class SubDownloadManager {
  static activeDownloads = new Map();
  static sendProgressCallBack = null;

  static async scheduleDownloads(subDirectory, subsObjects, signal, torrentId) {
    const results = [];
    const total = subsObjects.length;

    this.sendProgressCallBack?.({ torrentId, message: `Starting download of ${total} subtitle(s)` });

    let index = 0;
    for (const obj of subsObjects) {
      index++;
      if (signal.aborted)
        throw new Error("Subtitles Download Aborted");
      try {
        const res = await this.executeSubDownload(subDirectory, subsObjects, obj, signal, torrentId, index, total);
        results.push({ status: "success", file: res });
      } catch (err) {
        results.push({ status: "failed", error: err });
        this.sendProgressCallBack?.({ torrentId, message: `Failed subtitle ${index}/${total}: ${err.message}`, error: true });
      }
    }

    this.sendProgressCallBack?.({
      torrentId,
      message: `Finished downloading subtitles (${results.filter(r => r.status === "success").length}/${total} succeeded)`,
      done: true
    });

    return results;
  }

  static async executeSubDownload(downloadDirectory, subsObjects, SubObj, signal, torrentId, index, total) {
    let fileExtension;
    try {
      fileExtension = SubObj?.format ?? new URL(SubObj.url).searchParams.get("format") ?? "vtt";
    } catch {
      fileExtension = "vtt";
    }

    let fileNumber = 0;
    for (const obj of subsObjects) {
      if (obj.language === SubObj.language) {
        if (obj.url === SubObj.url) break;
        fileNumber++;
      }
    }

    const languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(SubObj?.language) ?? SubObj.display ?? SubObj.language;
    const fileName = `${languageName}-${fileNumber}.${fileExtension}`;
    const fileFullPath = join(downloadDirectory, fileName);

    if (existsSync(fileFullPath)) {
      log.info(`Skip: ${fileName}`);
      this.sendProgressCallBack?.({ torrentId, message: `Skipped ${fileName} (already exists)` });
      return fileFullPath;
    }

    this.sendProgressCallBack?.({ torrentId, message: `Downloading ${fileName} (${index}/${total})` });

    try {
      const response = await fetch(SubObj.url, { signal: signal });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${fileName} - Status: ${response.status} ${response.statusText}`);
      }

      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(fileFullPath),
        { signal: signal }
      );

      log.success(`Done Downloading ${fileName}`);
      this.sendProgressCallBack?.({ torrentId, message: `Done downloading ${fileName} (${index}/${total})` });
      return fileFullPath;
    } catch (err) {
      if (existsSync(fileFullPath)) unlinkSync(fileFullPath);
      if (signal.aborted) {
        log.info(`Aborted download of ${fileFullPath}`);
        this.sendProgressCallBack?.({ torrentId, message: `Aborted download of ${fileName}`, error: true });
      } else {
        log.error(`Failed to download ${fileName}: ${err.message}`);
        this.sendProgressCallBack?.({ torrentId, message: `Failed to download ${fileName}: ${err.message}`, error: true });
      }
      throw err;
    }
  }

  static async fetchSubtitlesInfo(mediaInfo = {}, signal, torrentId) {
    const {IMDB_ID, seasonNumber, episodeNumber} = mediaInfo;

    this.sendProgressCallBack?.({ torrentId, message: "Fetching subtitles info..." });

    try {
      const params = new URLSearchParams({
        id: IMDB_ID,
        ...((
          episodeNumber && seasonNumber &&
          episodeNumber != "undefined" && seasonNumber != "undefined"
        ) && { season: seasonNumber, episode: episodeNumber })
      });
      const requestUrl = `https://sub.wyzie.ru/search?${params}&key=${config.getWyzieKey()}`;

      const res = await fetch(requestUrl, { signal: signal });
      if (!res.ok)
        throw new Error(`HTTP error! status: ${res.status}`);

      const data = await res.json();

      this.sendProgressCallBack?.({ torrentId, message: `Found ${data.length} subtitle(s)` });

      return data;

    } catch (err) {
      console.error(err);
      this.sendProgressCallBack?.({ torrentId, message: `Failed to fetch subtitles info: ${err.message}`, error: true, done: true });
      return [];
    }
  }

  static async downloadSubsForMedia(mediaInfo, torrentId, torrentDownloadDir) {
    const abortController = new AbortController();
    this.activeDownloads.set(torrentId, abortController);

    const subsDownloadDir = join(torrentDownloadDir, `SUBS_${torrentId}`);

    try {
      if (!existsSync(subsDownloadDir))
        await mkdir(subsDownloadDir, { recursive: true });

      const subsObjects = await this.fetchSubtitlesInfo(mediaInfo, abortController.signal, torrentId);
      if (abortController.signal.aborted) return 0;

      if (!subsObjects.length) {
        this.sendProgressCallBack?.({ torrentId, message: "No subtitles found for this media", done: true, error: true });
        return [];
      }

      return await this.scheduleDownloads(subsDownloadDir, subsObjects, abortController.signal, torrentId);

    } catch (err) {
      if (abortController.signal.aborted) {
        log.info(`Subtitle download for ${torrentId} aborted`);
        this.sendProgressCallBack?.({ torrentId, message: `Subtitle download aborted`, error: true, done: true });
      } else {
        log.error(`Subtitle download for ${torrentId} failed: ${err}`);
        this.sendProgressCallBack?.({ torrentId, message: `Something went Wrong`, error: true, done: true });
      }
      return [];
    } finally {
      this.activeDownloads.delete(torrentId);
    }
  }

  static abortDownload(torrentId) {
    const controller = this.activeDownloads.get(torrentId);
    if (!controller) return;
    try {
      controller.abort();
    } catch (error) {
      if (error.name === 'AbortError') return
      console.error('Unexpected error while aborting download:', error);
    }
  }
}
