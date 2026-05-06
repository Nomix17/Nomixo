<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/logo/icon128.png" width="100" valign="middle" />
  <h1>Nomixo</h1>
  <p><strong>A free, open-source desktop streaming client for Movies, TV Shows, and Anime.</strong></p>

  [![Version](https://img.shields.io/github/v/release/Nomix17/Nomixo?color=4F8EF7&leabel=version&logo=github&logoColor=white)](https://github.com/Nomix17/Nomixo/releases)
  [![Electron](https://img.shields.io/badge/Electron-2C2E3B?logo=electron&logoColor=9FEAF9)](https://www.electronjs.org)
  [![Node](https://img.shields.io/badge/Node.js-v18+-235A32?logo=nodedotjs&logoColor=6BBF47)](https://nodejs.org)
  [![MPV](https://img.shields.io/badge/MPV-Player-6A0DAD?logo=mpv&logoColor=white)](https://mpv.io)
  [![License](https://img.shields.io/badge/License-GPL--3.0--NC-C0392B?logoColor=white)](https://www.gnu.org/licenses/gpl-3.0.html)

</div>


## Overview

Nomixo is an Electron app that lets you search, browse, and stream movies and TV shows from your desktop. It pulls metadata from **TMDB**, fetches torrent streams via **Torrentio**, and plays back through **MPV**. No account, no subscription, just a free TMDB API key.


## Features

- **Browse & search** — Home page with popular content, real-time search across movies, shows, and anime, and a Discovery page by genre
- **Streaming** — Torrent-based via WebTorrent, played through MPV with hardware acceleration
- **Downloads** — Full queue with pause, resume, cancel, and reorder support
- **Library & history** — Save favorites, track watch progress, and resume where you left off
- **Subtitles** — Auto-download via Wyzie, or load local `.srt`/`.vtt` files. Configurable font, size, color, and opacity
- **Theming** — Fully customizable colors and appearance via Settings


## Screenshots

![Home](https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/home.jpg)
![Media Detail](https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/media_details.jpg)
![Video Player](https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/videoplayer0.jpg)
![Download Manager](https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/download_page.jpg)


## Requirements

| Dependency | Notes |
|---|---|
| [MPV Player](https://mpv.io/installation/) | Required for all playback |
| [TMDB API Key](https://developer.themoviedb.org/docs/getting-started) | Free, needed on first launch |
| [Wyzie API Key](https://sub.wyzie.io/redeem) *(optional)* | For automatic subtitle search |
| [Node.js](https://nodejs.org/) v18+ | Only needed if running from source |


## Download

Pre-built installers are on the [**Releases page**](https://github.com/Nomix17/Nomixo/releases). Available for Linux (`.deb`, `.rpm`, `.tar.gz`) and Windows (installer + portable `.zip`).

> ⚠️ **MPV must be installed separately.** On Windows, grab a 64-bit build from [SourceForge](https://sourceforge.net/projects/mpv-player-windows/files/64bit/) and either add it to your PATH or configure the path in Settings. Other platforms: [mpv.io/installation](https://mpv.io/installation/).


## Running from Source

```bash
git clone https://github.com/Nomix17/Nomixo.git
cd Nomixo
npm install
npm run dev
```

To build a distributable: `npm run build`, output goes to `dist/`.


## How Streaming Works

Nomixo fetches a magnet link from Torrentio, buffers it with WebTorrent, serves it locally over HTTP, and launches MPV pointed at that stream. The app window hides while MPV is in focus and reappears on exit. Playback position is saved automatically.


## Architecture

Standard Electron main/renderer split. Key pieces:

| Path | Purpose |
|---|---|
| `src/main/main.js` | Window management, IPC, torrent engine |
| `src/main/MPVStreamingWorker.js` | Launches and manages MPV in a worker thread |
| `src/pages/` | One folder per page (home, search, detail, player, downloads, library, profile, settings, login) |
| `src/preload/preload.js` | Secure IPC bridge with contextIsolation |
| `src/shared/sharedFuncs.js` | Shared utilities |


## Data & Config

Everything lives in Electron's `userData` directory: `settings.json`, `library.json`, `downloads.json`, `Theme.css`, and `mpv/mpv.conf`. API keys are stored in `.env`. Poster cache and streaming cache are in `posters/` and `video_cache/`.
