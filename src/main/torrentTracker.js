import { log } from './debugging.js';
import { tmpdir } from 'os';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const CACHE_PATH = join(tmpdir(), 'torrent-trackers-cache.json');
const FALLBACK_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.empire-js.us:1337/announce',
];

let inFlight = null;
export function getTorrentTrackers() {
  return inFlight || (inFlight = initTorrentTrackers());
}

export async function initTorrentTrackers() {
  const cached = await readCache();
  if (cached) return cached;

  const urls = [
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_best.txt',
  ];

  try {
    const results = await Promise.all(urls.map(u => fetch(u).then(r => r.text())));
    const data = results
      .flatMap(text => text.trim().split('\n\n'))
      .filter(Boolean);

    log.success(`Loaded ${data.length} trackers`);
    await writeCache(data);
    return data;
  } catch (err) {
    log.warn(
      `Failed to load ngosang trackers list, falling back to preset trackers.\n` +
      `Reason: ${err.message ?? err}`
    );
    await writeCache(FALLBACK_TRACKERS);
    return FALLBACK_TRACKERS;
  }
}

async function readCache() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeCache(data) {
  try {
    await mkdir(dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(data));
  } catch (err) {
    log.warn(`Failed to write tracker cache to ${CACHE_PATH}: ${err.message ?? err}`);
  }
}
