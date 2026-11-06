import { createWriteStream, existsSync } from "fs";
import { mkdir, rm } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { join } from "path";
import { config } from "./config.js";
import { log } from "./debugging.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const WYZIE_SEARCH_URL = "https://sub.wyzie.ru/search";
const EPISODE_GROUP_PRIORITY = ["seasons", "crunchyroll"];

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const episodeMappingCache = new Map();

const byOrder = (a, b) => a.order - b.order;

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function fetchTmdb(path, signal) {
  const res = await fetch(`${TMDB_BASE}${path}?api_key=${await config.getTMDBKey()}`, { signal });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function getFileExtension(sub) {
  if (sub.format) return sub.format;
  try {
    return new URL(sub.url).searchParams.get("format") ?? "vtt";
  } catch {
    return "vtt";
  }
}

function getLanguageName(sub) {
  try {
    return languageNames.of(sub.language) ?? sub.display ?? sub.language;
  } catch {
    return sub.display ?? sub.language ?? "unknown";
  }
}

function buildFileName(sub, perLanguageCount) {
  const n = perLanguageCount.get(sub.language) ?? 0;
  perLanguageCount.set(sub.language, n + 1);
  return `${getLanguageName(sub)}-${n}.${getFileExtension(sub)}`;
}

function pickEpisodeGroup(groups = []) {
  for (const wanted of EPISODE_GROUP_PRIORITY) {
    const matches = groups.filter((g) => g.name.trim().toLowerCase() === wanted);
    if (matches.length) return matches.sort((a, b) => b.episode_count - a.episode_count)[0];
  }
  return null;
}

function buildEpisodeMapping(groupDetail) {
  const episodes = new Map();
  const shifts = new Map();

  [...groupDetail.groups].sort(byOrder).forEach((season, index) => {
    const seasonNumber = Number(/\d+/.exec(season.name)?.[0]) || index + 1;

    [...season.episodes].sort(byOrder).forEach((ep, i) => {
      const converted = { season: seasonNumber, episode: i + 1 };
      episodes.set(`${ep.season_number}:${ep.episode_number}`, converted);

      const delta = converted.episode - ep.episode_number;
      const known = shifts.get(ep.season_number);
      if (known === undefined) {
        shifts.set(ep.season_number, { season: seasonNumber, delta });
      } else if (known && (known.season !== seasonNumber || known.delta !== delta)) {
        shifts.set(ep.season_number, null);
      }
    });
  });

  return { episodes, shifts };
}

function convertWithMapping({ episodes, shifts }, season, episode) {
  const exact = episodes.get(`${season}:${episode}`);
  if (exact) return exact;

  const shift = shifts.get(season);
  return shift && episode + shift.delta >= 1
    ? { season: shift.season, episode: episode + shift.delta }
    : null;
}

async function loadEpisodeMapping(tmdbId, signal) {
  if (episodeMappingCache.has(tmdbId)) return episodeMappingCache.get(tmdbId);

  const { results } = await fetchTmdb(`/tv/${tmdbId}/episode_groups`, signal);
  const group = pickEpisodeGroup(results);

  log.info(
    group
      ? `Using episode group "${group.name}" (${group.id}) for TMDB ${tmdbId}`
      : `No suitable episode group for TMDB ${tmdbId}`
  );

  const mapping = group ? buildEpisodeMapping(await fetchTmdb(`/tv/episode_group/${group.id}`, signal)) : null;
  episodeMappingCache.set(tmdbId, mapping);
  return mapping;
}

export class SubDownloadManager {
  static activeDownloads = new Map();
  static sendProgressCallBack = null;

  static #progress(torrentId, message, flags = {}) {
    this.sendProgressCallBack?.({ torrentId, message, ...flags });
  }

  static #fail(torrentId, message) {
    this.#progress(torrentId, message, { error: true, done: true });
    return [];
  }

  static async #resolveEpisode(mediaInfo, signal) {
    const { MediaType: mediaType, MediaId: mediaId } = mediaInfo;

    const season = toPositiveInt(mediaInfo.seasonNumber);
    const episode = toPositiveInt(mediaInfo.episodeNumber);
    if (!season || !episode) return null;

    const original = { season, episode };
    if (mediaType !== "tv" || !mediaId) return original;

    try {
      const mapping = await loadEpisodeMapping(mediaId, signal);
      const converted = mapping && convertWithMapping(mapping, season, episode);

      if (converted) {
        log.info(`Episode S${season}E${episode} -> S${converted.season}E${converted.episode}`);
        return converted;
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      log.error(`Episode group lookup failed, using original numbering: ${err.message}`);
    }

    return original;
  }

  static async fetchSubtitlesInfo(mediaInfo = {}, signal, torrentId) {
    this.#progress(torrentId, "Fetching subtitles info...");

    const params = new URLSearchParams({ id: mediaInfo.IMDB_ID, key: config.getWyzieKey() });

    const episode = await this.#resolveEpisode(mediaInfo, signal);
    if (episode) {
      params.set("season", episode.season);
      params.set("episode", episode.episode);
    }

    const res = await fetch(`${WYZIE_SEARCH_URL}?${params}`, { signal });
    if (!res.ok) {
      throw new Error(
        res.status === 401 || res.status === 403
          ? "Failed to fetch: invalid Wyzie key"
          : `Failed to fetch subtitles: ${res.status}`
      );
    }

    const data = await res.json();
    this.#progress(torrentId, `Found ${data.length} subtitle(s)`);
    return data;
  }

  static filterSubtitlesByLanguage(subsObjects, languagesToDownload) {
    if (!Array.isArray(subsObjects)) return [];

    const targetIsoCodes = new Set(
      Object.values(languagesToDownload || {})
        .map((lang) => lang.iso639?.toLowerCase())
        .filter(Boolean)
    );

    return subsObjects.filter((sub) => targetIsoCodes.has(sub?.language?.toLowerCase()));
  }

  static async scheduleDownloads(subDirectory, subsObjects, signal, torrentId) {
    const total = subsObjects.length;
    const perLanguageCount = new Map();
    const results = [];

    this.#progress(torrentId, `Starting download of ${total} subtitle(s)`);

    for (const [i, sub] of subsObjects.entries()) {
      if (signal.aborted) throw new Error("Subtitles Download Aborted");

      const position = `${i + 1}/${total}`;
      const fileName = buildFileName(sub, perLanguageCount);

      try {
        const file = await this.#downloadSubtitle(subDirectory, sub, fileName, signal, torrentId, position);
        results.push({ status: "success", file });
      } catch (err) {
        results.push({ status: "failed", error: err });
        this.#progress(torrentId, `Failed subtitle ${position}: ${err.message}`, { error: true });
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;
    this.#progress(torrentId, `Finished downloading subtitles (${succeeded}/${total} succeeded)`, { done: true });

    return results;
  }

  static async #downloadSubtitle(directory, sub, fileName, signal, torrentId, position) {
    const fullPath = join(directory, fileName);

    if (existsSync(fullPath)) {
      log.info(`Skip: ${fileName}`);
      this.#progress(torrentId, `Skipped ${fileName} (already exists)`);
      return fullPath;
    }

    this.#progress(torrentId, `Downloading ${fileName} (${position})`);

    try {
      const response = await fetch(sub.url, { signal });
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${fileName} - Status: ${response.status} ${response.statusText}`);
      }

      await pipeline(Readable.fromWeb(response.body), createWriteStream(fullPath), { signal });

      log.success(`Done Downloading ${fileName}`);
      this.#progress(torrentId, `Done downloading ${fileName} (${position})`);
      return fullPath;
    } catch (err) {
      await rm(fullPath, { force: true });

      const message = signal.aborted ? `Aborted download of ${fileName}` : `Failed to download ${fileName}: ${err.message}`;
      log[signal.aborted ? "info" : "error"](message);
      this.#progress(torrentId, message, { error: true });
      throw err;
    }
  }

  static async downloadSubsForMedia(mediaInfo, torrentId, torrentDownloadDir, subtitleSettings) {
    const abortController = new AbortController();
    const { signal } = abortController;
    this.activeDownloads.set(torrentId, abortController);

    try {
      const subsDownloadDir = join(torrentDownloadDir, `SUBS_${torrentId}`);
      await mkdir(subsDownloadDir, { recursive: true });

      const subsObjects = await this.fetchSubtitlesInfo(mediaInfo, signal, torrentId);
      if (signal.aborted) return [];
      if (!subsObjects.length) return this.#fail(torrentId, "No subtitles found for this media");

      log.info("Download All Subtitles:", subtitleSettings?.DownloadAllSubtitles);
      log.info(
        "Languages To Download:",
        Object.values(subtitleSettings?.LanguagesToDownload || {}).map((lang) => lang.displayName?.toLowerCase())
      );

      const filtered =
        subtitleSettings && !subtitleSettings.DownloadAllSubtitles
          ? this.filterSubtitlesByLanguage(subsObjects, subtitleSettings.LanguagesToDownload)
          : subsObjects;
      if (!filtered.length) return this.#fail(torrentId, "No subtitles found matching your selected languages");

      return await this.scheduleDownloads(subsDownloadDir, filtered, signal, torrentId);
    } catch (err) {
      if (signal.aborted) {
        log.info(`Subtitle download for ${torrentId} aborted`);
        return this.#fail(torrentId, "Subtitle download aborted");
      }
      log.error(`Subtitle download for ${torrentId} failed: ${err}`);
      return this.#fail(torrentId, err.message);
    } finally {
      this.activeDownloads.delete(torrentId);
    }
  }

  static abortDownload(torrentId) {
    this.activeDownloads.get(torrentId)?.abort();
  }
}
