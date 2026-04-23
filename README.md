<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/logo/icon128.png" width="100" valign="middle" />
  <h1>Nomixo</h1>
  <p><strong>A free, open-source desktop streaming client for Movies, TV Shows, and Anime.</strong></p>

  ![Version](https://img.shields.io/github/v/release/Nomix17/Nomixo?color=4F8EF7&leabel=version&logo=github&logoColor=white)
  ![Electron](https://img.shields.io/badge/Electron-2C2E3B?logo=electron&logoColor=9FEAF9)
  ![Node](https://img.shields.io/badge/Node.js-v18+-235A32?logo=nodedotjs&logoColor=6BBF47)
  ![MPV](https://img.shields.io/badge/MPV-Player-6A0DAD?logo=mpv&logoColor=white)
  ![License](https://img.shields.io/badge/License-GPL--3.0--NC-C0392B?logoColor=white)

</div>


## Overview

Nomixo is a desktop application built with [Electron](https://www.electronjs.org/) that lets you search, browse, and stream movies and TV shows directly from your computer. It pulls metadata and artwork from **TMDB**, streams content via **Torrentio** (torrent-based streaming), and delegates playback to **MPV**, a powerful, hardware-accelerated media player.

No account. No subscription. Just your TMDB API key and you're in.


## Features

- 🏠 **Home Page** — Browse popular movies and TV shows, and resume anything in your "Continue Watching" list
- 🔍 **Search** — Search across movies, TV shows, and animations in real time
- 🎬 **Media Detail Page** — View rich metadata: synopsis, ratings, cast, seasons & episodes
- ▶️ **Streaming via MPV** — Torrent-based streaming using WebTorrent with MPV as the playback engine
- ⬇️ **Download Manager** — Download content locally with a full queue system (pause, resume, cancel, reorder)
- 📚 **Library** — Save your favorites and track what you're currently watching with resume support
- 🔎 **Discovery Page** — Discover new content across genres and categories
- 👤 **Profile Page** — Manage your watching history and library
- 🎨 **Theming** — Fully customizable UI colors and appearance via the Settings page
- 💬 **Subtitle Support** — Auto-download subtitles via [Wyzie](https://sub.wyzie.ru), or use local `.srt`/`.vtt` files. Configure font, size, color, and background opacity
- 🔔 **System Notifications** — Get notified when a download completes
- ⚙️ **Settings** — Control zoom factor, subtitle defaults, download paths, themes, and API keys


## Screenshots

### Home
![Home][home]

### Media Detail
![Media Detail][detail]

### Video Player
![Video Player][player]

### Download Dialog
![Download Dialog][dialog]

### Download Manager
![Download Manager][manager]

### Discovery
![Discovery][discovery]

### Profile
![Profile][profile]

### Settings & Theme
![Settings][settings]

[home]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/home.jpg
[detail]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/media_details.jpg
[player]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/videoplayer0.jpg
[dialog]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/media_details_download.jpg
[manager]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/download_page.jpg
[discovery]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/discovery.jpg
[profile]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/profile.jpg
[settings]: https://cdn.jsdelivr.net/gh/Nomix17/Nomixo@main/assets/Screenshots/settings.jpg


## Download

Pre-built installers are available on the [**Releases page**](https://github.com/Nomix17/Nomixo/releases), **no need to build from source**.

**Linux (x64)**

| File | Format |
|---|---|
| `Nomixo-vX.X.X-linux-x64.deb` | Debian/Ubuntu package |
| `Nomixo-vX.X.X-linux-x64.rpm` | Fedora/RHEL package |
| `Nomixo-vX.X.X-linux-x64.tar.gz` | Portable tarball |

**Windows (x64)**

| File | Format |
|---|---|
| `Nomixo-vX.X.X-Windows-Installer-x64.exe` | NSIS Installer |
| `Nomixo-vX.X.X-Windows-Portable-x64.zip` | Portable ZIP |

> ⚠️ **MPV is still required** regardless of how you install Nomixo. Install it from [mpv.io](https://mpv.io/installation/) before launching the app.


## Requirements

| Dependency | Notes |
|---|---|
| [MPV Player](https://mpv.io/installation/) | Required for all playback |
| [TMDB API Key](https://developer.themoviedb.org/docs/getting-started) | Free, needed on first launch |
| [Wyzie API Key](https://sub.wyzie.io/redeem) *(optional)* | For automatic subtitle search |
| [Node.js](https://nodejs.org/) v18+ | Only needed if running from source |


## Running from Source

If you prefer to run the app directly:

```bash
# 1. Clone the repository
git clone https://github.com/Nomix17/Nomixo.git
cd Nomixo

# 2. Install dependencies
npm install

# 3. Start the app
npm run dev
```

On first launch, Nomixo will ask for your TMDB API key. You can also optionally add a Wyzie API key for subtitle support.

### Build a distributable yourself

```bash
npm run build
```

Outputs are placed in the `dist/` directory.


## Architecture

Nomixo follows Electron's main/renderer process model:

```
src/
├── main/
│   ├── main.js                 # Main process: window management, IPC handlers, torrent engine
│   ├── MPVStreamingWorker.js   # Worker thread: launches and manages MPV process
│   ├── downloadSubtitles.js    # Subtitle downloading logic
│   └── debugging.js            # Logging utilities
├── pages/
│   ├── homePage/               # Home: popular content + continue watching
│   ├── searchPage/             # Real-time search
│   ├── discoveryPage/          # Browse by genre/category
│   ├── mediaDetailPage/        # Movie/show info + stream/download actions
│   ├── playerPage/             # In-app video player (internal)
│   ├── downloadPage/           # Download queue and status manager
│   ├── libraryPage/            # Saved/watching media library
│   ├── profilePage/            # User profile and watch history
│   ├── settingsPage/           # App settings, themes, subtitle config
│   └── loginPage/              # TMDB API key entry on first launch
├── preload/
│   └── preload.js              # Secure IPC bridge (contextIsolation)
└── shared/
    └── sharedFuncs.js          # Shared utility functions across pages
```

### Key technologies

| Technology | Role |
|---|---|
| [Electron](https://www.electronjs.org/) | Desktop app framework |
| [WebTorrent](https://webtorrent.io/) | Torrent streaming & downloading engine |
| [MPV](https://mpv.io/) | High-performance media playback |
| [TMDB API](https://developer.themoviedb.org/) | Movie & TV metadata, posters, artwork |
| [Torrentio](https://torrentio.strem.fun/) | Torrent stream source |
| [Wyzie](https://sub.wyzie.ru/) | Subtitle search API |
| [electron-store](https://github.com/sindresorhus/electron-store) | Persistent settings storage |
| [Express](https://expressjs.com/) | Local HTTP server for torrent streaming |


## How Streaming Works

1. User selects a title and quality from the media detail page.
2. Nomixo fetches a magnet link from **Torrentio**.
3. **WebTorrent** opens the magnet and begins buffering the selected file.
4. A local HTTP server streams the torrent data via byte-range requests.
5. **MPV** is launched (in a worker thread) pointing to the local stream URL.
6. The Electron window hides while MPV is in focus, and reappears when playback ends.
7. Playback position is saved automatically so you can resume later.


## Configuration & Data

All user data is stored in Electron's `userData` directory:

| File/Folder | Purpose |
|---|---|
| `settings.json` | App preferences (zoom, subtitles, download path) |
| `Theme.css` | Custom UI theme colors |
| `library.json` | Saved and watched media |
| `downloads.json` | Download history and status |
| `mpv/mpv.conf` | MPV subtitle and player configuration |
| `posters/` | Cached poster images |
| `video_cache/` | Temporary torrent streaming cache |
| `.env` | Stored API keys (TMDB, Wyzie) |


