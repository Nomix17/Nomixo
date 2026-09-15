import { ipcMain, app } from 'electron';
import pkg from 'electron-updater';
import { log } from "./debugging.js";
import Store from 'electron-store';
const { autoUpdater } = pkg;

export class UpdateManager {
  constructor(appManager) {
    this.appManager = appManager;
    this.store = new Store();
    this.autoUpdater = autoUpdater;

    this._configureUpdater();
    this._registerUpdaterListeners();
    this._registerIpcHandlers();
  }

  get browserWindow() {
    return this.appManager.browserWindow;
  }

  _configureUpdater() {
    this.autoUpdater.logger = log;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = false;
    // this.autoUpdater.forceDevUpdateConfig = true;
    // if (!process.env.APPIMAGE) {
    //   process.env.APPIMAGE = `${app.getPath('temp')}/fake.AppImage`;
    // }
  }

  async _sendToRenderer(channel, localStorageKey, value) {
    const bw = this.browserWindow;
    if (!bw || bw.isDestroyed()) return;

    await bw.webContents.executeJavaScript(
      `localStorage.setItem('${localStorageKey}', ${JSON.stringify(value)});`
    );
    bw.webContents.send(channel, value);
  }

  _registerUpdaterListeners() {
    this.autoUpdater.on('update-available', (info) => this._onUpdateAvailable(info));
    this.autoUpdater.on('update-downloaded', (info) => this._onUpdateDownloaded(info));
    this.autoUpdater.on('download-progress', (progress) => this._onDownloadProgress(progress));
    this.autoUpdater.on('error', (error) => this._onDownloadFailed(error));
  }

  async _onUpdateAvailable(info) {
    console.log('New version found:', info.version);
    console.log('Release date:', info.releaseDate);
    const pending = this.store.get('pendingUpdate');

    if (pending && pending.version === info.version) {
      await this._sendToRenderer('update_downloaded', 'update_downloaded', true);
      return;
    }

    await this._sendToRenderer('update_available', 'update_available', JSON.stringify(info));
  }

  async _onUpdateDownloaded(info) {
    this.store.set('pendingUpdate', {
      version: info.version,
      downloadedAt: Date.now()
    });
    await this._sendToRenderer('update_downloaded', 'update_downloaded', true);
  }

  async _onDownloadProgress(progress) {
    await this._sendToRenderer('updates-download-progress', 'update_download_progress', progress);
  }

  async _onDownloadFailed(error) {
    if (this.browserWindow) {
      this.browserWindow.webContents.send('update-download-error', {
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
      });
    }
  }
  _registerIpcHandlers() {
    ipcMain.on('download-update', () => this.autoUpdater.downloadUpdate());
    ipcMain.on('restart-and-update', () => this._restartAndUpdate());
    ipcMain.handle('get-app-version', () => app.getVersion());
  }

  _restartAndUpdate() {
    if (this.store.has('pendingUpdate'))
      this.store.delete('pendingUpdate');
    this.autoUpdater.quitAndInstall()
  }
  checkForUpdates() {
    this.autoUpdater.checkForUpdates();
  }

  dispose() {
    ipcMain.removeAllListeners('download-update');
    ipcMain.removeAllListeners('restart-and-update');
    ipcMain.removeHandler('get-app-version');
    this.autoUpdater.removeAllListeners();
  }
}
