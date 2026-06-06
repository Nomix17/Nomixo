import { BrowserWindow, app, nativeTheme, protocol, screen } from "electron";
import Store from 'electron-store';
import TorrentDownloadManager from "./TorrentDownloadManager.js";
import MpvPlayerManager from "./MpvPlayerManager.js";
import { markMediaDownloadsAsPaused } from "./storageManagement.js";
import { generateUniqueId } from "./utils.js";
import { Paths } from "./FilesManager.js";
import { log } from "./debugging.js";
import path from "path";
import fs from "fs";

export class AppManager {
  closeWindow = true;
  mainZoomFactor = 1;
  pagesCachedHistory = {};
  browserWindow = null;
  TMDB_API_KEY = null;
  Wyzie_API_KEY = null;
  defaultSettingsPromise = null;
  positionWasChangedViaGoBackButton = false;

  torrentDownloadManager = null;
  mpvPlayerManager = null;

  constructor(app, defaultSettingsPromise) {
    this.app = app;
    this.store = new Store();
    this.defaultSettingsPromise = defaultSettingsPromise;
    nativeTheme.themeSource = "dark";
  }

  initializeApp() {
    let entryPointFile;
    if (!process.env.TMDB_API_KEY) {
      log.warn(`Missing TMDB API key. Please set TMDB_API_KEY in your environment or add it to ${Paths.__envfile}`);
      entryPointFile = "./src/pages/loginPage/loginPage.html";
    } else {
      this.TMDB_API_KEY = process.env.TMDB_API_KEY;
      this.Wyzie_API_KEY = process.env.Wyzie_API_KEY;
      this.#initAppIdentity();
      entryPointFile = "./src/pages/homePage/homePage.html";
    }

    if (!this.app.requestSingleInstanceLock()) {
      this.app.quit();
      return;
    }

    this.app.on("second-instance", () => {
      if (this.browserWindow?.isMinimized()) this.browserWindow.restore();
      this.browserWindow?.focus();
    });

    this.app.on("ready", async () => {
      protocol.handle("theme", async () => {
        const css = await fs.promises.readFile(Paths.ThemeFilePath, "utf8");
        return new Response(css, {
          headers: { "content-type": "text/css", "cache-control": "no-store" },
        });
      });

      const { window, isMaximized } = this.#createBrowserWindow();
      this.browserWindow = window;
      this.mpvPlayerManager = new MpvPlayerManager(this.browserWindow);
      this.torrentDownloadManager = new TorrentDownloadManager(
        this.browserWindow,
        (entry) => this.mpvPlayerManager.playVideoOverMpv(entry)
      );
      await this.#setupBrowserWindowListeners(entryPointFile, isMaximized);
      await markMediaDownloadsAsPaused();
    });

    this.app.on("window-all-closed", async () => {
      if (this.closeWindow) this.app.quit();
      await markMediaDownloadsAsPaused();
    });
  }

  #createBrowserWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const { width, height, x, y, isMaximized } = this.store.get("windowBounds") || {
      width: Math.floor(screenWidth * 0.8),
      height: Math.floor(screenHeight * 0.8),
      isMaximized: false,
    };

    const window = new BrowserWindow({
      width, height, x, y,
      show: false,
      webPreferences: {
        preload: path.join(Paths.__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    return { window, isMaximized };
  }

  async #setupBrowserWindowListeners(entryPointFile, isMaximized) {
    this.browserWindow.setMenuBarVisibility(false);
    this.browserWindow.loadFile(entryPointFile);
    const defaultSettings = await this.defaultSettingsPromise;
    this.mainZoomFactor = defaultSettings.PageZoomFactor;
    if (defaultSettings?.DefaultDownloadPath != null)
      Paths.defaultDownloadPath = defaultSettings.DefaultDownloadPath;

    this.browserWindow.once("ready-to-show", () => {
      this.browserWindow.webContents.setZoomFactor(this.mainZoomFactor);
      if (isMaximized) this.browserWindow.maximize();
      this.browserWindow.show();
    });

    this.browserWindow.on("close", () => {
      this.store.set("windowBounds", {
        ...(this.browserWindow.isMaximized()
          ? this.store.get("windowBounds")
          : this.browserWindow.getBounds()),
        isMaximized: this.browserWindow.isMaximized(),
      });
    });
  }

  #initAppIdentity() {
    this.app.setAppUserModelId("com.nomixo.app");
    this.app.setName("Nomixo");
  }

  savePageCachedDataToHistory(PageURL,cacheData){
    if(PageURL){
      const dataId = generateUniqueId(PageURL);
      if(this.pagesCachedHistory[dataId])
        delete this.pagesCachedHistory[dataId];
      this.pagesCachedHistory[dataId] = cacheData;
    }
  }

  deletePageCachedDataFromHistory(PageURL){
    if(PageURL){
      const dataId = generateUniqueId(PageURL);
      delete this.pagesCachedHistory[dataId];
    }
  }

  loadPageCachedDataFromHistory(PageURL){
    if(PageURL){
      const dataId = generateUniqueId(PageURL);
      return this.pagesCachedHistory[dataId];
    }else{
      return null;
    }
  }
}
