# Nomixo

Nomixo is a desktop streaming client built with Electron. It lets you search, browse, and stream Movies, TV Shows, and Animations from your computer, no subscription needed. Content is streamed via Torrentio, metadata and artwork are pulled from TMDB, and playback is handled by MPV.

## Requirements

- [Node.js](https://nodejs.org/) v18+
- [MPV](https://mpv.io/installation/) installed on your system
- A [TMDB API key](https://developer.themoviedb.org/docs/getting-started)

## Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Nomix17/Nomixo.git
   cd Nomixo
   npm install
   ```

2. Start the app:
   ```bash
   npm start
   ```

3. Enter your TMDB API key on the login screen.

## Acknowledgements

- [MPV](https://mpv.io/) — media playback engine
- [TMDB](https://developer.themoviedb.org) — movie & TV metadata API
- [Torrentio](https://torrentio.strem.fun) — torrent stream provider
- Modified MPV enhancement OSC based on [modernz](https://github.com/Samillion/ModernZ) — adapted to fit Nomixo
