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
  static themesDirPath = path.join(Paths.__configs, "themes");
  static ThemeFilePath = path.join(Paths.__configs, "Theme.css");
  static libraryFilePath = path.join(Paths.__configs, "library.json");
  static downloadLibraryFilePath = path.join(Paths.__configs, "downloads.json");
  static mpvConfigDirectory = path.join(Paths.__configs, "mpvConfigs");
  static SubConfigFile = path.join(Paths.mpvConfigDirectory, "mpv.conf");

  static defaultDownloadPath = Paths.__downloads;
  static videoCachePath = path.join(Paths.__cache, "video_cache");
  static postersDirPath = path.join(Paths.__cache, "posters");
  static searchHistoryCacheFile = path.join(Paths.__cache, "search_history.json");

  static MpvWorkerPath = path.join(Paths.__dirname, "MpvWorker.js");
  static subDirectory = path.join(Paths.__temp, "tempSubs");
}

export class FilesManager {
  static initializeDataFiles() {
    FilesManager.createMissingDirs();
    FilesManager.copyDefaultDirs();
    FilesManager.copyDefaultFiles();
  }

  static createMissingDirs() {
    if (!fs.existsSync(Paths.__configs))
      fs.mkdirSync(Paths.__configs, { recursive: true });

    if (!fs.existsSync(Paths.postersDirPath))
      fs.mkdirSync(Paths.postersDirPath, { recursive: true });

    if (!fs.existsSync(Paths.videoCachePath))
      fs.mkdirSync(Paths.videoCachePath, { recursive: true });

    if (!fs.existsSync(Paths.__downloads))
      fs.mkdirSync(Paths.__downloads, { recursive: true });
  }

  static copyDefaultDirs() {
    if (!fs.existsSync(Paths.mpvConfigDirectory)) {
      const currentMpvConfPath = app.isPackaged
        ? path.join(process.resourcesPath, 'mpvConfigs')
        : path.join(Paths.__dirname, '../../assets/mpvConfigs');
      fs.cpSync(currentMpvConfPath, Paths.mpvConfigDirectory, { recursive: true });
    }

    if (!fs.existsSync(Paths.themesDirPath))
      fs.cpSync(
        path.join(Paths.__dirname, '../../assets/themes/'), 
        Paths.themesDirPath, {recursive: true}
      );
  }

  static copyDefaultFiles() {
    if (!fs.existsSync(Paths.SettingsFilePath)) {
      fs.cpSync(
        path.join(Paths.__dirname, '../../assets/settings.json'),
        Paths.SettingsFilePath
      );
      const settings = JSON.parse(fs.readFileSync(Paths.SettingsFilePath, "utf-8"));
      settings.DefaultDownloadPath = Paths.__downloads;
      fs.writeFileSync(Paths.SettingsFilePath, JSON.stringify(settings, null, 2));
    }

    if (!fs.existsSync(Paths.ThemeFilePath))
      fs.cpSync(
        path.join(Paths.__dirname, "../../assets/themes/default.css"),
        Paths.ThemeFilePath
      );
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
