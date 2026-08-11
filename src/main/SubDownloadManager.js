import { createWriteStream, existsSync, unlinkSync } from "fs";
import { mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { join } from "path";
import { config } from "./config.js";
import { log } from "./debugging.js";

export class SubDownloadManager {
  static activeDownloads = new Map();

  static async scheduleDownloads(subDirectory, subsObjects, signal) {
    const results = [];
    for (const obj of subsObjects) {
      if (signal.aborted)
        throw new Error("Subtitles Download Aborted");
      try {
        const res = await this.executeSubDownload(subDirectory, subsObjects, obj, signal);
        results.push({ status: "success", file: res });
      } catch (err) {
        results.push({ status: "failed", error: err });
      }
    }
    return results;
  }

  static async executeSubDownload(downloadDirectory, subsObjects, SubObj, signal) {
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
      return fileFullPath;
    }

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
      return fileFullPath;
    } catch (err) {
      if (existsSync(fileFullPath)) unlinkSync(fileFullPath);
      if (signal.aborted) {
        log.info(`Aborted download of ${fileFullPath}`);
      } else {
        log.error(`Failed to download ${fileName}: ${err.message}`);
      }
      throw err;
    }
  }

  static async fetchSubtitlesInfo(mediaInfo = {}, signal) {
    const {IMDB_ID, seasonNumber, episodeNumber} = mediaInfo;
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
      return data;

    } catch (err) {
      console.error(err);
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

      const subsObjects = await this.fetchSubtitlesInfo(mediaInfo, abortController.signal);
      if (abortController.signal.aborted) return 0;
      return await this.scheduleDownloads(subsDownloadDir, subsObjects, abortController.signal);

    } catch (err) {
      if (abortController.signal.aborted) {
        log.info(`Subtitle download for ${torrentId} aborted`);
      } else {
        log.error(`Subtitle download for ${torrentId} failed: ${err}`);
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
