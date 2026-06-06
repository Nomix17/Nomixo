import {app} from "electron";
import { fileURLToPath} from "url";
import fs from 'fs';
import path from "path";
import {log} from "./debugging.js";

export class Paths {
  static __filename = fileURLToPath(import.meta.url);
  static __dirname = path.dirname(Paths.__filename);

  static __configs = app.getPath("userData");
  static __cache = app.getPath("userCache");
  static __downloads = app.getPath("downloads");
  static __temp = app.getPath("temp");

  static __envfile = path.join(Paths.__configs, ".env");
  static SettingsFilePath = path.join(Paths.__configs, "settings.json");
  static ThemeFilePath = path.join(Paths.__configs, "Theme.css");
  static libraryFilePath = path.join(Paths.__configs, "library.json");
  static downloadLibraryFilePath = path.join(Paths.__configs, "downloads.json");
  static mpvConfigDirectory = path.join(Paths.__configs, "mpv");
  static SubConfigFile = path.join(Paths.mpvConfigDirectory, "mpv.conf");

  static defaultDownloadPath = Paths.__downloads;
  static videoCachePath = path.join(Paths.__cache, "video_cache");
  static postersDirPath = path.join(Paths.__cache, "posters");

  static MpvWorkerPath = path.join(Paths.__dirname, "MpvWorker.js");
  static subDirectory = path.join(Paths.__temp, "tempSubs");
}

export class FilesManager {
  static initializeDataFiles() {
    if (!fs.existsSync(Paths.__configs))
      fs.mkdirSync(Paths.__configs, { recursive: true });

    if (!fs.existsSync(Paths.postersDirPath))
      fs.mkdirSync(Paths.postersDirPath, { recursive: true });

    if (!fs.existsSync(Paths.videoCachePath))
      fs.mkdirSync(Paths.videoCachePath, { recursive: true });

    if (!fs.existsSync(Paths.SettingsFilePath))
      fs.writeFileSync(Paths.SettingsFilePath, JSON.stringify({
        "PageZoomFactor": 0.92,
        "TurnOnSubsByDefaultInternal": true,
        "SubFontSizeInternal": 16,
        "SubFontFamilyInternal": "Montserrat",
        "SubColorInternal": "#ffffff",
        "SubBackgroundColorInternal": "#000000",
        "SubBackgroundOpacityLevelInternal": 0,
        "DefaultDownloadPath": Paths.__downloads,
        "rememberDownloadLocationByDefault": true,
        "DownloadSubtitlesByDefault": true
      }));

    if (!fs.existsSync(Paths.ThemeFilePath))
      fs.writeFileSync(Paths.ThemeFilePath, `
        :root{
          --dont-Smooth-transition-between-pages:0;
          --display-scroll-bar:none;
          --show-continue-watching-on-home:flex;
          --background-gradient-value:0;
          --primary-color:10,14,23;
          --secondary-color:55,65,81,1;
          --div-containers-borders-color:255,255,255,0;
          --main-buttons-color:255,255,255,0.04;
          --MovieElement-hover-BorderColor:255,255,255;
          --input-backgroundColor:0,0,0,0.44;
          --drop-down-color:26,35,50,1;
          --icon-color:55,65,81;
          --icon-hover-color:148,163,184,1;
          --text-color:255,255,255;
        }
      `);

    if (!fs.existsSync(Paths.__downloads))
      fs.mkdirSync(Paths.__downloads, { recursive: true });

    if (!fs.existsSync(Paths.mpvConfigDirectory)) {
      const currentMpvConfPath = app.isPackaged
        ? path.join(process.resourcesPath, 'mpv')
        : path.join(Paths.__dirname, '../../assets/mpv');
      fs.cpSync(currentMpvConfPath, Paths.mpvConfigDirectory, { recursive: true });
    }

    if (!fs.existsSync(Paths.SubConfigFile))
      fs.writeFileSync(Paths.SubConfigFile, `
        osc=yes 
        border=yes 
        osd-bar=no
        sub-font-size=30
        sub-font="Arial"
        sub-color="#ffffff"
        target-colorspace-hint=no
      `);
  }

  static async writeAPIKEYIntoEnvFile(apiKeys){
    try {
      if(!fs.existsSync(Paths.__configs)){
        fs.mkdirSync(Paths.__configs, { recursive: true });
      }
      fs.writeFileSync(Paths.__envfile, `
        TMDB_API_KEY="${apiKeys["TMDB_API_KEY"]}"\n
        Wyzie_API_KEY="${apiKeys["Wyzie_API_KEY"]}"
      `);
    } catch(err) {
      log.error(err.message);
    }
  }
}
