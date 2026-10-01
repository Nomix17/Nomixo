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
      this.nextEpisodeInfo = await this.#computeNextEpisodeInfo(metaData);
    } catch (err) {
      log.error("Failed to resolve next episode info:", err);
      this.nextEpisodeInfo = null;
    }

    log.info("Next Episode:", this.nextEpisodeInfo?.MagnetLink);
    return this.nextEpisodeInfo;
  }

  async #computeNextEpisodeInfo(metaData) {
    const nextEpisode = await this.#getNextEpisodeNumber(
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

  #getNextEpisodeFromMap(episodesBySeasonNumber, currentSeason, currentEpisode) {
    const currentSeasonEpisodes = episodesBySeasonNumber[currentSeason];
    if (!currentSeasonEpisodes) return null;

    if (currentSeasonEpisodes.includes(currentEpisode + 1)) {
      return { season: currentSeason, episode: currentEpisode + 1 };
    }

    const nextSeasonEpisodes = episodesBySeasonNumber[currentSeason + 1];
    if (nextSeasonEpisodes?.includes(1)) {
      return { season: currentSeason + 1, episode: 1 };
    }

    return null;
  }

  async #getNextEpisodeNumber(mediaId, currentSeason, currentEpisode) {
    currentSeason = Number(currentSeason);
    currentEpisode = Number(currentEpisode);
    const episodesBySeasonNumber = await this.#fetchSeasonEpisodeMap(mediaId);
    return this.#getNextEpisodeFromMap(episodesBySeasonNumber, currentSeason, currentEpisode);
  }

  async #fetchSeasonEpisodeMap(mediaId) {
    const apiKey = config.getTMDBKey();

    const showRes = await fetch(`https://api.themoviedb.org/3/tv/${mediaId}?api_key=${apiKey}`);
    const showData = await showRes.json();

    const validSeasonNumbers = (showData?.seasons ?? [])
      .filter((season) => !isNaN(season?.season_number) && season?.episode_count > 0)
      .map((season) => season.season_number);

    const seasonEntries = await Promise.all(
      validSeasonNumbers.map(async (seasonNumber) => {
        const res = await fetch(
          `https://api.themoviedb.org/3/tv/${mediaId}/season/${seasonNumber}?api_key=${apiKey}`
        );
        const seasonData = await res.json();
        const episodeNumbers = (seasonData?.episodes ?? []).map((ep) => ep.episode_number);
        return [seasonNumber, episodeNumbers];
      })
    );

    return Object.fromEntries(seasonEntries);
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

    const currentHash = this.getHashFromMagnet(metaData.MagnetLink);
    const target = currentHash
      ? candidates.find((s) => s.hash?.toLowerCase() === currentHash.toLowerCase())
      : null;

    if (target != null)
      return target;

    const sameQuality = candidates.filter(streamInfo => streamInfo.Quality.trim().toLowerCase() === metaData.Quality.trim().toLowerCase())
    if(sameQuality?.length === 0) return null;

    const seeders = (info) => Number(info.SeedersNumber) || 0;
    return sameQuality.reduce((best, current) =>
      seeders(current) > seeders(best) ? current : best
    );
  }
}

export default NextEpisodeManager;
