import path from "path";
import { config } from "./config.js";
import { loadDownloadStorage } from "./storageManagement.js";
import { parseTorrentioStream } from "./utils.js";
import { log } from "./debugging.js";
import {
  loadSubsFromSubDir,
  loadSubsFromVideoDirectory
} from "./localSubs.js"

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const isRetryableStatus = (status) =>
  status === 408 || status === 429 || status >= 500;

async function fetchWithRetry(
  url,
  { retries = 8, baseDelay = 1000, maxDelay = 15000, timeout = 10000, signal } = {}
) {
  let lastError;

  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();

    try {
      const timeoutSignal = AbortSignal.timeout(timeout);
      const res = await fetch(url, {
        signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      });

      if (!isRetryableStatus(res.status)) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }

    if (attempt >= retries) throw lastError;

    const delay =
      Math.min(maxDelay, baseDelay * 2 ** attempt) + Math.random() * 500;
    log.info(
      `Request failed (${lastError?.message}), retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms`
    );
    await sleep(delay, signal);
  }
}

class NextEpisodeManager {
  nextEpisodeInfo = null;
  #abortController = null;

  reset() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.nextEpisodeInfo = null;
  }

  hasNext() {
    return this.nextEpisodeInfo != null;
  }

  static isLocalDownload(episodeInfo) {
    return Boolean(episodeInfo?.downloadPath && episodeInfo?.fileName);
  }

  async resolveNext(metaData) {
    const { MediaType, seasonNumber, episodeNumber } = metaData ?? {};

    this.#abortController?.abort();
    const controller = new AbortController();
    this.#abortController = controller;
    const { signal } = controller;

    const isResolvable =
      MediaType != null &&
      MediaType !== "movie" &&
      seasonNumber != null &&
      episodeNumber != null;

    if (!isResolvable) {
      this.nextEpisodeInfo = null;
      return null;
    }

    try {
      const info = await this.#getNextEpisodeInfo(metaData, signal);
      if (signal.aborted) return null;
      this.nextEpisodeInfo = info;
    } catch (err) {
      if (signal.aborted) return null;
      log.error("Failed to resolve next episode info:", err);
      this.nextEpisodeInfo = null;
    }

    log.info("Next Episode:", this.nextEpisodeInfo?.MagnetLink);
    return this.nextEpisodeInfo;
  }

  async #getNextEpisodeInfo(metaData, signal) {
    const nextEpisode = await this.#getNextEpPosition(
      metaData.MediaId,
      metaData.seasonNumber,
      metaData.episodeNumber,
      signal
    );
    if (nextEpisode == null) return null;

    const downloadEntry = await this.#findDownloadedEpisode(metaData.MediaId, nextEpisode);
    if (downloadEntry != null) {
      const localSubs = await loadSubsFromSubDir(downloadEntry);
      const videoDirSubs = await loadSubsFromVideoDirectory(
        path.join(downloadEntry?.downloadPath, downloadEntry?.fileName)
      );
      downloadEntry.local_subs = [...localSubs, ...videoDirSubs]
        .map(sub => sub?.url)
        .filter(sub => sub != null);
      log.info(`Loading ${downloadEntry.local_subs.length} subs`);
      return downloadEntry;
    }

    const torrentInfo = await this.#fetchBestTorrentStream(metaData, nextEpisode, signal);
    if (torrentInfo == null) return null;

    return {
      IMDB_ID: metaData.IMDB_ID,
      MediaId: metaData.MediaId,
      MediaType: metaData.MediaType,
      Title: metaData.Title,
      Year: metaData.Year,
      posterUrl: metaData.posterUrl,
      bgImageUrl: metaData.bgImageUrl,
      ...torrentInfo,
      seasonNumber: String(nextEpisode.season).padStart(2, '0'),
      episodeNumber: String(nextEpisode.episode).padStart(2, '0'),
    };
  }

  async #getNextEpPosition(mediaId, currentSeason, currentEpisode, signal) {
    currentSeason = Number(currentSeason);
    currentEpisode = Number(currentEpisode);
    const apiKey = config.getTMDBKey();

    const getSeasonEpisodeNumbers = async (seasonNumber) => {
      const seasonLabel = String(seasonNumber).padStart(2, "0");
      const res = await fetchWithRetry(
        `https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNumber}?api_key=${apiKey}`,
        { signal }
      );

      if (res.status === 404) return null;
      if (!res.ok)
        throw new Error(`Failed to fetch S${seasonLabel} info: ${res.status}`);

      const seasonData = await res.json();
      return (seasonData?.episodes ?? []).map((ep) => ep.episode_number);
    };

    const currentSeasonEpisodes = await getSeasonEpisodeNumbers(currentSeason);
    if (!currentSeasonEpisodes || currentSeasonEpisodes.length === 0) return null;

    if (currentSeasonEpisodes.includes(currentEpisode + 1))
      return { season: currentSeason, episode: currentEpisode + 1 };

    const nextSeasonEpisodes = await getSeasonEpisodeNumbers(currentSeason + 1);
    if (nextSeasonEpisodes?.includes(1)) {
      return { season: currentSeason + 1, episode: 1 };
    }
    return null;
  }

  async #findDownloadedEpisode(mediaId, { season, episode }) {
    const downloadStorage = await loadDownloadStorage();

    const entry = downloadStorage.downloads.find(
      (el) =>
        el.MediaId === mediaId &&
        el.MediaType === 'tv' &&
        Number.parseInt(el.seasonNumber) === season &&
        Number.parseInt(el.episodeNumber) === episode &&
        el.Status === "DONE"
    );

    if (entry?.downloadPath && entry?.fileName) return entry;
    return null;
  }

  getHashFromMagnet = (magnet) =>
    magnet?.match(/btih:([a-fA-F0-9]{40})/)?.[1]?.toLowerCase() ?? null;

  async #fetchBestTorrentStream(metaData, { season, episode }, signal) {
    const url = `https://torrentio.strem.fun/stream/series/${metaData.IMDB_ID}:${season}:${episode}.json`;

    const res = await fetchWithRetry(url, { signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Torrentio responded ${res.status}`);

    const data = await res.json();
    if (!data?.streams?.length) return null;

    const candidates = data.streams
      .map((stream) => parseTorrentioStream(stream))
      .filter(Boolean);

    const currentHash = this.getHashFromMagnet(metaData.MagnetLink);
    const target = currentHash
      ? candidates.find((stream) => stream.hash?.toLowerCase() === currentHash)
      : null;

    if (target != null)
      return target;

    const norm = (quality) => quality?.trim().toLowerCase();

    const wanted = norm(metaData?.Quality);
    const pool = wanted
      ? candidates.filter((s) => {
        const streamQuality = norm(s.Quality);
        return streamQuality && (streamQuality.includes(wanted) || wanted.includes(streamQuality));
      })
      : candidates;
    if (pool.length === 0) return null;

    const seeders = (info) => Number(info.SeedersNumber) || 0;
    return pool.reduce((best, current) =>
      seeders(current) > seeders(best) ? current : best
    );
  }
}

export default NextEpisodeManager;
