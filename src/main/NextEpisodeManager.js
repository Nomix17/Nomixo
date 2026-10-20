import { config } from "./config.js";
import { loadDownloadStorage } from "./storageManagement.js";
import { parseTorrentioStream } from "./utils.js";
import { log } from "./debugging.js";


class NextEpisodeManager {
  nextEpisodeInfo = null;

  reset() {
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
      this.nextEpisodeInfo = await this.#getNextEpisodeInfo(metaData);
    } catch (err) {
      log.error("Failed to resolve next episode info:", err);
      this.nextEpisodeInfo = null;
    }

    log.info("Next Episode:", this.nextEpisodeInfo?.MagnetLink);
    return this.nextEpisodeInfo;
  }

  async #getNextEpisodeInfo(metaData) {
    const nextEpisode = await this.#getNextEpPosition(
      metaData.MediaId,
      metaData.seasonNumber,
      metaData.episodeNumber
    );
    if (nextEpisode == null) return null;

    const downloadEntry = await this.#findDownloadedEpisode(metaData.MediaId, nextEpisode);
    if (downloadEntry != null) {
      return downloadEntry;
    }

    const torrentInfo = await this.#fetchBestTorrentStream(metaData, nextEpisode);
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

  async #getNextEpPosition(mediaId, currentSeason, currentEpisode) {
    currentSeason = Number(currentSeason);
    currentEpisode = Number(currentEpisode);
    const apiKey = config.getTMDBKey();

    const getSeasonEpisodeNumbers = async (seasonNumber) => {
      const seasonLabel = String(seasonNumber).padStart(2, "0");
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNumber}?api_key=${apiKey}`
        );

        if(!res.ok)
          throw new Error(`Failed to Fetch S${seasonLabel} info: ${res.status}`)

        const seasonData = await res.json();
        return (seasonData?.episodes ?? []).map((ep) => ep.episode_number);
      } catch(err) {
        log.error(err);
        return null
      }
    }

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
        Number.parseInt(el.episodeNumber) === episode
    );

    if (entry?.downloadPath && entry?.fileName) return entry;
    return null;
  }

  getHashFromMagnet = (magnet) =>
    magnet?.match(/btih:([a-fA-F0-9]{40})/)?.[1]?.toLowerCase() ?? null;

  async #fetchBestTorrentStream(metaData, { season, episode }) {
    const url = `https://torrentio.strem.fun/stream/series/${metaData.IMDB_ID}:${season}:${episode}.json`;

    const res = await fetch(url);
    if (!res.ok) return null;
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
