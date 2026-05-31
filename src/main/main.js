import { BrowserWindow, app, ipcMain, dialog, shell } from "electron";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import { AppManager } from "./AppManager.js";
import MpvPlayerManager from "./MpvPlayerManager.js";
import { log } from "./debugging.js";
import SubDownloadManager from "./SubDownloadManager.js";
import { Paths, FilesManager } from "./FilesManager.js";
import {
  generateUniqueId,
  findFile,
  sendSystemNotification,
  downloadImage,
} from "./utils.js";
import {
  loadDownloadStorage,
  loadLibraryStorage,
  editDownloadStorageEntry,
  getLibraryEntry,
  overwriteStorageFile,
} from "./storageManagement.js";


dotenv.config({ path: Paths.__envfile });

// ======================= APP INITIALIZATION =======================

FilesManager.initializeDataFiles();
const appManager = new AppManager(app, loadSettings());
appManager.initializeApp();

// ======================= IPC HANDLERS =======================

//      ================ SETTINGS & THEME ================

ipcMain.handle("load-settings", async () => {
  try {
    return await loadSettings();
  } catch {
    throw new Error("Something Went Wrong When Loading Settings!");
  }
});

ipcMain.handle("load-theme", () => {
  try {
    return loadTheme();
  } catch {
    throw new Error("Something Went Wrong When Loading Theme!");
  }
});

ipcMain.handle("load-sub", () => {
  try { return loadSubConfigs(); }
  catch { throw new Error("Failed to load sub configs"); }
});

ipcMain.handle("apply-settings", async (event, SettingsObj) => {
  const oldSettings = await loadSettings();
  const FullSettings = { ...oldSettings, ...SettingsObj };

  const webContents = event.sender;
  FullSettings.PageZoomFactor = Math.max(0.1, FullSettings.PageZoomFactor);
  webContents.setZoomFactor(FullSettings.PageZoomFactor);
  appManager.mainZoomFactor = FullSettings.PageZoomFactor;
  fs.writeFileSync(Paths.SettingsFilePath, JSON.stringify(FullSettings, null, 2), (err) => {
    if (err) log.error(err);
    return err;
  });
  return null;
});

ipcMain.on("apply-theme", (event, ThemeObj) => {
  const formatedThemeObj = ThemeObj.theme.map(
    (obj) => `${Object.keys(obj)[0]}:${obj[Object.keys(obj)[0]]}`
  );

  const themeFileContent = `:root{\n    ${formatedThemeObj.join(";\n")}\n  ;}`;

  fs.writeFile(Paths.ThemeFilePath, themeFileContent, (err) => {
    if (err) log.error(err);
  });
});

ipcMain.on("apply-sub-config", (event, SubConfig) => {
  applySubConfigs(SubConfig);
});

// ======================= NAVIGATION =======================

ipcMain.handle("can-go-back", () => {
  return appManager.browserWindow.webContents.navigationHistory.canGoBack();
});

ipcMain.handle("go-back", (event, currentPageURL) => {
  navigateToPreviousPage();
  appManager.deletePageCachedDataFromHistory(currentPageURL);
});

ipcMain.on("change-page", (event, newPageURL, currentPageURL, cacheData) => {
  if (!appManager.browserWindow) return;

  const webContents = event.sender;
  const [filePath, query] = newPageURL.split("?");
  const fullPath = path.join(Paths.__dirname, filePath);
  const url = `file://${fullPath}${query ? "?" + query : ""}`;
  appManager.savePageCachedDataToHistory(currentPageURL, cacheData);

  if (currentPageURL.includes("loginPage")) {
    const clearOnLoad = () => {
      webContents.navigationHistory.clear();
      webContents.removeListener("did-finish-load", clearOnLoad);
    };
    webContents.once("did-finish-load", clearOnLoad);
  }

  const setZoomAfterLoad = () => {
    webContents.setZoomFactor(appManager.mainZoomFactor);
    webContents.removeListener("did-finish-load", setZoomAfterLoad);
  };
  webContents.once("did-finish-load", setZoomAfterLoad);

  appManager.browserWindow.loadURL(url);
  appManager.positionWasChangedViaGoBackButton = false;
});

ipcMain.handle("request-fullscreen", () => {
  if (!appManager.browserWindow) return undefined;
  appManager.browserWindow.setFullScreen(!appManager.browserWindow.isFullScreen());
  return appManager.browserWindow.isFullScreen();
});

ipcMain.handle("get-fullscreen-status", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isFullScreen() : false;
});

ipcMain.handle("get-full-video-path", async (event, dirPath, fileName) => {
  return await findFile(dirPath, fileName);
});

ipcMain.handle("open-directory-filesystem-browser", async (event, currentPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    defaultPath: currentPath,
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("open-file-filesystem-browser", async (event, currentPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    defaultPath: currentPath,
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle("open-external-link", (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle("get-tmdb-api-key", () => appManager.TMDB_API_KEY);
ipcMain.handle("get-wyzie-api-key", () => appManager.Wyzie_API_KEY);

ipcMain.handle("validate-tmdb-api-key", async (event, inputedApiKey) => {
  return validateTMDBApiKey(inputedApiKey);
});

ipcMain.handle("validate-wyzie-api-key", async (event, inputedApiKey) => {
  return validateWyzieApiKey(inputedApiKey);
});

ipcMain.handle("save-api-key", async (event, apiKeys) => {
  appManager.TMDB_API_KEY = apiKeys["TMDB_API_KEY"];
  appManager.Wyzie_API_KEY = apiKeys["Wyzie_API_KEY"];
  try {
    await FilesManager.writeAPIKEYIntoEnvFile(apiKeys);
  } catch (err) {
    log.error(err.message);
    return false;
  }
  return true;
});

// ======================= VIDEO STREAMING =======================

ipcMain.handle("get-video-url", async (event, magnet, fileName) => {
  return appManager.mpvPlayerManager.getVideoUrl(magnet, fileName);
});

ipcMain.handle("play-torrent-over-mpv", async (event, metaData, subsObjects) => {
  const settings = await loadSettings();
  return appManager.mpvPlayerManager.playTorrentOverMpv(metaData, subsObjects, settings);
});

ipcMain.handle("play-video-over-mpv", async (event, metaData) => {
  const subsPaths = loadSubsFromSubDir({
    IMDB_ID: metaData.mediaImdbId,
    episodeNumber: metaData.episodeNumber,
    seasonNumber: metaData.seasonNumber,
    DownloadDir: metaData.downloadPath,
  }).map((sub) => sub.url);

  const settings = await loadSettings();
  return appManager.mpvPlayerManager.playVideoOverMpv(metaData, subsPaths, settings);
});

// ======================= TORRENT DOWNLOADING =======================

ipcMain.handle("download-torrent", async (event, torrentsEntries, subsObjects) => {
  return appManager.torrentDownloadManager.scheduleTorrentDownloads(torrentsEntries, subsObjects);
});

ipcMain.handle("download-subtitles", async (event, torrentEntry, subsObjects) => {
  try {
    await SubDownloadManager.downloadSubs(subsObjects, torrentEntry.torrentId, torrentEntry.downloadPath);
  } catch (err) {
    log.error("Failed To Download Subtitles", torrentEntry.torrentId + ":", err.message);
    return { updated: false };
  }
  return { updated: true };
});

ipcMain.handle("pause-torrent-download", async (event, torrentId) => {
  return appManager.torrentDownloadManager.pauseTorrentDownload(torrentId);
});

ipcMain.handle("continue-torrent-download", async (event, torrentId) => {
  return appManager.torrentDownloadManager.continueTorrentDownload(torrentId);
});

ipcMain.handle("toggle-torrent-download", async (event, torrentId) => {
  return appManager.torrentDownloadManager.toggleTorrentDownload(torrentId);
});

ipcMain.handle("cancel-torrent-download", async (event, mediaInfo) => {
  return appManager.torrentDownloadManager.cancelTorrentDownload(mediaInfo);
});

ipcMain.handle("add-torrent-to-download-queue", async (event, torrentId) => {
  return appManager.torrentDownloadManager.downloadOrQueueTorrent(torrentId);
});

ipcMain.handle("remove-torrent-from-download-queue", async (event, torrentId) => {
  return appManager.torrentDownloadManager.removeTorrentFromQueue(torrentId);
});

ipcMain.handle("shift-download-queue-element", (event, torrentId, offset) => {
  return appManager.torrentDownloadManager.shiftQueuedElement(torrentId, offset);
});

ipcMain.handle("get-download-queue-list", () => {
  return appManager.torrentDownloadManager.downloadQueue.map((el) => el.torrentId);
});

// ======================= DOWNLOAD OTHER THINGS =======================

ipcMain.handle("download-image", async (event, downloadPath, imageUrl) => {
  const posterDownloadPath = path.join(downloadPath, "POSTERS");
  const ImagePath = await downloadImage(posterDownloadPath, imageUrl);
  return ImagePath
    ? { download_result: "success", image_path: ImagePath }
    : { download_result: "failed" };
});

// ======================= LIBRARY MANAGEMENT =======================

ipcMain.on("add-to-lib", (event, mediaInfo) => {
  const LibraryInfo = loadLibraryStorage();
  LibraryInfo.media = LibraryInfo.media.filter(
    (e) => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType)
  );
  LibraryInfo.media.push(mediaInfo);
  overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
});

ipcMain.on("remove-from-lib", (event, mediaInfo) => {
  const LibraryInfo = loadLibraryStorage();
  LibraryInfo.media = LibraryInfo.media.filter(
    (e) => !(e.MediaId.toString() === mediaInfo.MediaId.toString() && e.MediaType === mediaInfo.MediaType)
  );
  overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
});

ipcMain.on("edit-element-lib", async (event, mediaInfo) => {
  const LibraryInfo = await loadLibraryStorage();
  const elementIndex = LibraryInfo.media.findIndex(
    (e) =>
      e.MediaId.toString() === mediaInfo.MediaId.toString() &&
      e.MediaType === mediaInfo.MediaType
  );
  if (elementIndex !== -1) {
    for (const [key, value] of Object.entries(mediaInfo)) {
      LibraryInfo.media[elementIndex][key] = value;
    }
    overwriteStorageFile(Paths.libraryFilePath, LibraryInfo);
  }
});

ipcMain.handle("load-from-lib", (event, targetIdentification) => {
  return getLibraryEntry(targetIdentification);
});

// ======================= DOWNLOAD LIBRARY MANAGEMENT =======================

ipcMain.on("add-to-download-lib", async (event, torrentId, mediaInfo) => {
  const downloadLibraryInfo = await loadDownloadStorage();
  downloadLibraryInfo.downloads = downloadLibraryInfo.downloads.filter(
    (e) => e.torrentId !== torrentId
  );
  downloadLibraryInfo.downloads.push(mediaInfo);
  await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLibraryInfo);
});

ipcMain.on("remove-from-download-lib", async (event, torrentId) => {
  const downloadLibraryInfo = await loadDownloadStorage();
  downloadLibraryInfo.downloads = downloadLibraryInfo.downloads.filter(
    (e) => e.torrentId !== torrentId
  );
  await overwriteStorageFile(Paths.downloadLibraryFilePath, downloadLibraryInfo);
});

ipcMain.handle("edit-download-lib", async (event, torrentId, key, value) => {
  await editDownloadStorageEntry([torrentId], key, value);
  return null;
});

ipcMain.handle("load-from-download-lib", async () => {
  return loadDownloadStorage();
});

// ======================= SUBTITLES FILES MANAGEMENT =======================

ipcMain.handle("load-local-subs", async (event, videoPath, identifyingElements) => {
  const localBuiltInSubs = loadSubsFromVideoDirectory(videoPath);
  const localDownloadedSubs = loadSubsFromSubDir(identifyingElements);
  return [...localBuiltInSubs, ...localDownloadedSubs];
});

ipcMain.handle("read-sub-file", (event, filePath) => {
  return fs.readFileSync(filePath, "utf8");
});

// ======================= CACHE HISTORY MANAGEMENT =======================

ipcMain.handle("load-cached-data-from-history", (event, currentPageURL) => {
  return appManager.positionWasChangedViaGoBackButton
    ? appManager.loadPageCachedDataFromHistory(currentPageURL)
    : null;
});

// ======================= SYSTEM INTERACTION =======================

ipcMain.on("send-system-notification", (event, options) => {
  sendSystemNotification(options);
});

// ======================= NAVIGATION HELPERS =======================

function navigateToPreviousPage() {
  const webContents = appManager.browserWindow.webContents;
  if (webContents.navigationHistory.canGoBack()) {
    appManager.mpvPlayerManager.cleanup();
    webContents.navigationHistory.goBack();
    appManager.positionWasChangedViaGoBackButton = true;
  }
}

// ======================= SUBTITLE HELPERS =======================

const languageDict = {
  english: "en", afrikaans: "af", albanian: "sq", amharic: "am", arabic: "ar",
  armenian: "hy", azerbaijani: "az", basque: "eu", belarusian: "be", bengali: "bn",
  bosnian: "bs", bulgarian: "bg", catalan: "ca", cebuano: "ceb", chinese: "zh",
  corsican: "co", croatian: "hr", czech: "cs", danish: "da", dutch: "nl",
  esperanto: "eo", estonian: "et", finnish: "fi", french: "fr", frisian: "fy",
  galician: "gl", georgian: "ka", german: "de", greek: "el", gujarati: "gu",
  haitian_creole: "ht", hausa: "ha", hawaiian: "haw", hebrew: "he", hindi: "hi",
  hmong: "hmn", hungarian: "hu", icelandic: "is", igbo: "ig", indonesian: "id",
  irish: "ga", italian: "it", japanese: "ja", javanese: "jv", kannada: "kn",
  kazakh: "kk", khmer: "km", kinyarwanda: "rw", korean: "ko", kurdish: "ku",
  kyrgyz: "ky", lao: "lo", latin: "la", latvian: "lv", lithuanian: "lt",
  luxembourgish: "lb", macedonian: "mk", malagasy: "mg", malay: "ms", malayalam: "ml",
  maltese: "mt", maori: "mi", marathi: "mr", mongolian: "mn", myanmar: "my",
  nepali: "ne", norwegian: "no", nyanja: "ny", oromo: "or", pashto: "ps",
  persian: "fa", polish: "pl", portuguese: "pt", punjabi: "pa", romanian: "ro",
  russian: "ru", samoan: "sm", scots_gaelic: "gd", serbian: "sr", sesotho: "st",
  shona: "sn", sindhi: "sd", sinhala: "si", slovak: "sk", slovenian: "sl",
  somali: "so", spanish: "es", sundanese: "su", swahili: "sw", swedish: "sv",
  tagalog: "tl", tajik: "tg", tamil: "ta", tatar: "tt", telugu: "te",
  thai: "th", turkish: "tr", turkmen: "tk", ukrainian: "uk", urdu: "ur",
  uyghur: "ug", uzbek: "uz", vietnamese: "vi", welsh: "cy", xhosa: "xh",
  yiddish: "yi", yoruba: "yo", zulu: "zu",
};

function loadSubsFromSubDir(identifyingElements) {
  const torrentId = generateUniqueId(
    `${identifyingElements.IMDB_ID}-${identifyingElements.episodeNumber ?? "undefined"}-${identifyingElements.seasonNumber ?? "undefined"}-${identifyingElements.DownloadDir}`
  );
  const subsDirectory = path.join(identifyingElements.DownloadDir, `SUBS_${torrentId}`);
  try {
    if (!fs.existsSync(subsDirectory))
      throw new Error(`Subtitles aren't downloaded in: ${subsDirectory}`);
    return fs.readdirSync(subsDirectory).map((subFileName) => {
      const displayName = subFileName.split("-")[0];
      return {
        url: path.join(subsDirectory, subFileName),
        display: displayName,
        languageCode: languageDict[displayName.toLowerCase()] ?? displayName,
        type: "local",
      };
    });
  } catch (err) {
    log.error(err.message);
    return [];
  }
}

function loadSubsFromVideoDirectory(videoPath) {
  const videoParentsPath = path.dirname(videoPath);
  try {
    return fs.readdirSync(videoParentsPath).flatMap((subFileName) => {
      const fileExtension = path.extname(subFileName);
      if (fileExtension === ".srt" || fileExtension === ".vtt") {
        return [{
          url: path.join(videoParentsPath, subFileName),
          display: "Built In",
          languageCode: "built-in",
          languageName: subFileName.split(fileExtension)[0],
          type: "local",
        }];
      }
      return [];
    });
  } catch (err) {
    log.warn(err);
    return [];
  }
}

// ======================= SETTINGS HELPERS =======================

async function loadSettings() {
  try {
    const data = fs.readFileSync(Paths.SettingsFilePath, "utf-8");
    if (data.trim() === "" || !("TurnOnSubsByDefaultInternal" in JSON.parse(data)))
      throw new Error("empty Settings File");

    const JData = JSON.parse(data);
    if (JData?.MpvExecPath == null || JData?.MpvExecPath.trim() === "")
      JData.MpvExecPath = await MpvPlayerManager.findMpvExecPath();

    return JData;
  } catch (err) {
    log.error(err.message);
    return {
      PageZoomFactor: 0.92,
      TurnOnSubsByDefaultInternal: true,
      SubFontSizeInternal: 16,
      SubFontFamilyInternal: "Montserrat",
      SubColorInternal: "#ffffff",
      SubBackgroundColorInternal: "#000000",
      SubBackgroundOpacityLevelInternal: 0,
      DefaultDownloadPath: Paths.__downloads,
      rememberDownloadLocationByDefault: true,
      DownloadSubtitlesByDefault: true,
      MpvExecPath: await MpvPlayerManager.findMpvExecPath(),
    };
  }
}

function loadTheme() {
  try {
    let savedTheme = fs.readFileSync(Paths.ThemeFilePath, "utf-8");
    savedTheme = savedTheme
      .replaceAll(":root{", "")
      .replaceAll("}", "")
      .replaceAll("--", "")
      .replaceAll(";", "")
      .replaceAll(" ", "");
    const linesArray = savedTheme.split("\n").filter((line) => line !== "");
    return {
      theme: linesArray.map((obj) => {
        const [key, value] = obj.split(":");
        return { [key]: value };
      }),
    };
  } catch (err) {
    log.error("Failed to Load Theme File");
    log.error(err.message);
    FilesManager.initializeDataFiles();
    return loadTheme();
  }
}

function loadSubConfigs() {
  const JsonConfig = {};
  const mpvConfig = fs.readFileSync(Paths.SubConfigFile, "utf-8");
  mpvConfig.split("\n").forEach((line) => {
    if (
      !line.includes("osc") &&
      !line.includes("border") &&
      !line.includes("osd-bar") &&
      !line.includes("target-colorspace-hint")
    ) {
      if (line.includes("no-sub")) {
        JsonConfig["no-sub"] = true;
      } else if (line.includes("=")) {
        const [key, val] = line.split("=");
        JsonConfig[key] = val === "yes" ? true : val === "no" ? false : val;
      }
    }
  });
  JsonConfig["no-sub"] ??= false;
  return JsonConfig;
}

function applySubConfigs(jsonContent) {
  fs.writeFileSync(Paths.SubConfigFile, parseMpvConfigs(jsonContent));
}

function parseMpvConfigs(jsonContent) {
  let mpvConfig = "osc=yes \nborder=yes \nosd-bar=no\ntarget-colorspace-hint=no";
  for (const [key, val] of Object.entries(jsonContent)) {
    if (key === "no-sub") {
      if (val === true) mpvConfig += "\nno-sub";
    } else {
      const value =
        val === true && key !== "sub-font-size" ? "yes" :
        val === false && key !== "sub-font-size" ? "no" : val;
      mpvConfig += `\n${key}=${value}`;
    }
  }
  return mpvConfig;
}

// ======================= API KEY VALIDATION =======================

async function validateTMDBApiKey(apiKey) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}`);
    return {
      type: "verify-api-key",
      response: res.status === 403 || res.status === 401 ? "api-key-not-valid" : "api-key-valid",
    };
  } catch {
    return { type: "verify-api-key", response: "no-internet-connection" };
  }
}

async function validateWyzieApiKey(apiKey) {
  try {
    const res = await fetch(`https://sub.wyzie.ru/search?id=tt1375666&key=${apiKey}`);
    return {
      type: "verify-api-key",
      response: res.status === 403 || res.status === 401 ? "api-key-not-valid" : "api-key-valid",
    };
  } catch {
    return { type: "verify-api-key", response: "no-internet-connection" };
  }
}

// ======================= PROCESS =======================

process.on("unhandledRejection", (reason) => {
  if (reason?.name === "AbortError") return;
  log.error("Unhandled rejection:", reason);
});
