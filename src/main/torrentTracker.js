import { log } from './debugging.js';

export default async function getTorrentTrackers() {
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
