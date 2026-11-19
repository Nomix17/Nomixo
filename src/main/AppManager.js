import { BrowserWindow, app, session, nativeTheme, protocol, screen } from "electron";
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
  defaultSettingsPromise = null;
  positionWasChangedViaGoBackButton = false;
  shouldBeMaximized = false;
  lastFullscreenState = null;

  torrentDownloadManager = null;
  mpvPlayerManager = null;

  constructor(app, defaultSettingsPromise) {
    this.app = app;
    this.store = new Store();
    this.defaultSettingsPromise = defaultSettingsPromise;
    nativeTheme.themeSource = "dark";
  }

  initializeApp() {
    this.#initAppIdentity();
    let entryPointFile;
    if (!process.env.TMDB_API_KEY) {
      log.warn(`Missing TMDB API key. Please set TMDB_API_KEY in your environment or add it to ${Paths.__envfile}`);
      entryPointFile = "./src/pages/loginPage/loginPage.html";
    } else {
      entryPointFile = "./src/pages/homePage/homePage.html";
    }

    if (!this.app.requestSingleInstanceLock()) {
      log.warn("Another instance of the application is already running. Exiting this instance.");
      this.app.quit();
      return;
    }

    this.app.on("second-instance", () => {
      if(this.store.get("opened-in-background"))
        this.restoreAndFocusWindow();
    });

    this.app.on("ready", async () => {
      protocol.handle("theme", async () => {
        const css = await fs.promises.readFile(Paths.ThemeFilePath, "utf8");
        return new Response(css, {
          headers: { "content-type": "text/css", "cache-control": "no-store" },
        });
      });

      this.browserWindow = await this.#createBrowserWindow();
      this.#setupBrowserWindowListeners();
      this.browserWindow.loadFile(entryPointFile);
      this.mpvPlayerManager = new MpvPlayerManager(this.browserWindow, (args) => this.restoreAndFocusWindow(args));
      this.torrentDownloadManager = new TorrentDownloadManager(
        this.browserWindow,
        (entry) => this.mpvPlayerManager.playVideoOverMpv(entry)
      )
      await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
      await markMediaDownloadsAsPaused();
    });

    this.app.on("window-all-closed", async () => {
      if (this.closeWindow) this.app.quit();
      await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
      await markMediaDownloadsAsPaused();
    });
  }

  #getBackgroundColor() {
    const content = fs.readFileSync(Paths.ThemeFilePath, "utf8");
    const backgroundColorLine = content.split("\n").find(line => line.includes("--background-color")) ?? "10,14,23;";
    return `rgb(${backgroundColorLine.trim()?.split(":")[1]?.split(";")[0] ?? backgroundColorLine})`;
  }

  async #createBrowserWindow() {
    const bgColor = this.#getBackgroundColor();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const { width, height, x, y, isMaximized } = this.store.get("windowBounds") || {
      width: Math.floor(screenWidth * 0.8),
      height: Math.floor(screenHeight * 0.8),
      isMaximized: false,
    };

    this.shouldBeMaximized = isMaximized;
    this.mainZoomFactor = await this.#getZoomFactorFromSettings();
    const window = new BrowserWindow({
      width, height, x, y,
      show: false,
      backgroundColor: bgColor,
      webPreferences: {
        preload: path.join(Paths.__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        zoomFactor: this.mainZoomFactor,
        backgroundThrottling: false,
        zoomMode: 'isolated',
      },
    });
    window.setMenuBarVisibility(false);
    return window;
  }

  async #getZoomFactorFromSettings() {
    const defaultSettings = await this.defaultSettingsPromise;
    if (defaultSettings?.DefaultDownloadPath != null)
      Paths.defaultDownloadPath = defaultSettings.DefaultDownloadPath;
    return defaultSettings.PageZoomFactor;
  }

  #setupBrowserWindowListeners() {
    this.browserWindow.on("close", () => {
      this.store.set("windowBounds", {
        ...(this.browserWindow.isMaximized()
          ? this.store.get("windowBounds")
          : this.browserWindow.getBounds()),
        isMaximized: this.browserWindow.isMaximized(),
      });
    });

    this.browserWindow.on("show", () => {
      log.info("Showing Window");
      this.store.delete("opened-in-background");
    });

    this.browserWindow.on("resize", () => this.#updateFullscreenState());
    this.browserWindow.on("move", () => this.#updateFullscreenState());
    this.browserWindow.on("enter-full-screen", () => this.#updateFullscreenState());
    this.browserWindow.on("leave-full-screen", () => this.#updateFullscreenState());

    this.browserWindow.webContents.on("did-finish-load", () => {
      this.lastFullscreenState = null;
      this.#updateFullscreenState();
    });

    this.browserWindow.once("ready-to-show", () => {
      if (this.shouldBeMaximized)
        this.browserWindow.maximize();
      if (!this.store.get("opened-in-background"))
        this.browserWindow.show();
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

  isWindowFullscreen() {
    const win = this.browserWindow;
    if (!win || win.isDestroyed()) return false;

    const bounds = win.getBounds();
    const { bounds: displayBounds } = screen.getDisplayMatching(bounds);
    const tol = 2;
    const matchesDisplay =
      Math.abs(bounds.x - displayBounds.x) <= tol &&
      Math.abs(bounds.y - displayBounds.y) <= tol &&
      Math.abs(bounds.width - displayBounds.width) <= tol &&
      Math.abs(bounds.height - displayBounds.height) <= tol;

    if (process.platform === "linux") return matchesDisplay;
    return win.isFullScreen() || matchesDisplay;
  }

  #updateFullscreenState() {
    const win = this.browserWindow;
    if (!win || win.isDestroyed()) return;
    const isFullscreen = this.isWindowFullscreen();
    if (isFullscreen === this.lastFullscreenState) return;
    this.lastFullscreenState = isFullscreen;
    win.setFullScreen(isFullscreen);
    win.webContents.send("on-fullscreen-status-update", isFullscreen);
  }

  applyZoomFactor(newZF) {
    this.browserWindow.webContents.setZoomFactor(newZF);
    this.mainZoomFactor = newZF;
  }

  runInBackground() {
    if (this.store.get("opened-in-background")) return;
    if (!this.browserWindow || this.browserWindow.isDestroyed()) return;
    this.browserWindow.hide();
    this.store.set("opened-in-background", true);
    log.info("Hiding Window");
  }

  restoreAndFocusWindow({ fullscreen = null, maximize = null } = {}) {
    const win = this.browserWindow;
    if (!win || win.isDestroyed()) return Promise.resolve();
    if (win.isMinimized()) win.restore();

    win.setAlwaysOnTop(true);
    win.show();
    win.focus();
    win.setAlwaysOnTop(false);

    const applyMaximize = () => {
      if (win.isDestroyed() || win.isFullScreen()) return;
      if (maximize !== null && win.isMaximized() !== maximize) {
        if (maximize) win.maximize();
        else win.unmaximize();
      }
    };

    const settled = new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      const done = () => { clearTimeout(timer); resolve(); };

      if (fullscreen === true) {
        applyMaximize();
        if (win.isFullScreen()) return done();
        win.once("enter-full-screen", done);
        win.setFullScreen(true);
      } else if (fullscreen === false && win.isFullScreen()) {
        win.once("leave-full-screen", () => { applyMaximize(); done(); });
        win.setFullScreen(false);
      } else {
        applyMaximize();
        done();
      }
    });

    this.store.delete("opened-in-background");
    return settled;
  }
}
