const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (newPageURL,currentPageURL,cacheData) => ipcRenderer.send('change-page', newPageURL,currentPageURL,cacheData),
  goBack: (currentPageURL) => ipcRenderer.invoke('go-back',currentPageURL),
  canGoBack: () => ipcRenderer.invoke('can-go-back'),

  getFullVideoPath: (dirPath,fileName) => ipcRenderer.invoke("get-full-video-path",dirPath,fileName),
  getVideoUrl: (magnet,fileName) => ipcRenderer.invoke('get-video-url', magnet,fileName),

  StreamTorrentOverMpv: (metaData,subsObjects) => ipcRenderer.invoke('play-torrent-over-mpv',metaData, subsObjects),
  PlayVideoOverMpv: (metaData) => ipcRenderer.invoke('play-video-over-mpv',metaData),

  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen"),
  getFullscreenState: () => ipcRenderer.invoke("get-fullscreen-status"),
  openDirectory_FileSystemBrowser: (currentPath) => ipcRenderer.invoke("open-directory-filesystem-browser",currentPath),
  openFile_FileSystemBrowser: (currentPath) => ipcRenderer.invoke("open-file-filesystem-browser",currentPath),
  getTMDBAPIKEY: () => ipcRenderer.invoke("get-tmdb-api-key"),
  getWyzieAPIKey : () => ipcRenderer.invoke("get-wyzie-api-key"),

  applySettings: (SettingsObj) => ipcRenderer.invoke("apply-settings", SettingsObj),
  applyTheme: (ThemeObj) => ipcRenderer.send("apply-theme",ThemeObj),
  applySubConfig: (JsonSubConfig) => ipcRenderer.send("apply-sub-config",JsonSubConfig),

  loadSettings: () => ipcRenderer.invoke("load-settings"),
  loadTheme: () => ipcRenderer.invoke("load-theme"),
  loadSubConfig: () => ipcRenderer.invoke("load-sub"),
  
  getPreparedThemes: () => ipcRenderer.invoke("get-prepared-themes"),
  applyPreparedTheme: (themefileName) => ipcRenderer.invoke("apply-prepared-theme", themefileName),
  createPreparedTheme: (newThemeName, newThemeObj) => ipcRenderer.invoke("create-prepared-theme",newThemeName, newThemeObj),
  editPreparedTheme: (themeInfo) => ipcRenderer.invoke("edit-prepared-theme", themeInfo),
  removePreparedTheme: (themefilePath) => ipcRenderer.invoke("remove-prepared-theme", themefilePath),

  addMediaToLibrary: (mediaEntryPoint) => ipcRenderer.send("add-to-lib",mediaEntryPoint),
  removeMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("remove-from-lib",mediaEntryPoint),
  editMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("edit-element-lib",mediaEntryPoint),
  loadMediaLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-lib",targetIdentification),

  importLibrary: (merge) => ipcRenderer.invoke("import-library", (merge)),
  exportLibrary: () => ipcRenderer.invoke("export-library"),

  addElementToDownloadInfo: (torrentId, mediaInfo) => ipcRenderer.invoke("add-to-download-lib",torrentId, mediaInfo),
  removeElementFromDownloadLibraryInfo: (torrentId) => ipcRenderer.invoke("remove-from-download-lib",torrentId),
  editElementInDownloadLibraryInfo: (torrentId, key, value) => ipcRenderer.invoke("edit-download-lib",torrentId, key, value),
  loadDownloadLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-download-lib",targetIdentification),
  
  downloadSubtitles: (mediaInfo, subsObjects) => ipcRenderer.invoke("download-subtitles", mediaInfo, subsObjects),
  fetchSubtitles: (mediaInfo) => ipcRenderer.invoke("fetch-subtitles", mediaInfo),
  loadLocalSubs: (videoPath,identifyingElements) => ipcRenderer.invoke("load-local-subs",videoPath,identifyingElements),
  readSubFile: (filePath) => ipcRenderer.invoke("read-sub-file",filePath),
  getLanguageDict: () => ipcRenderer.invoke("get-language-dict"),

  downloadTorrent: (torrentInformation, hasToDownloadSubs) => ipcRenderer.invoke("download-torrent",torrentInformation, hasToDownloadSubs),
  pauseTorrentDownload: (torrentId) => ipcRenderer.invoke("pause-torrent-download", torrentId),
  continueTorrentDownload: (torrentId) => ipcRenderer.invoke("continue-torrent-download", torrentId),
  toggleTorrentDownload: (torrentId) => ipcRenderer.invoke("toggle-torrent-download", torrentId),
  cancelDownload: (mediaInfo) => ipcRenderer.invoke("cancel-torrent-download", mediaInfo),
  addTorrentToDownloadQueue: (torrentId) => ipcRenderer.invoke("add-torrent-to-download-queue", torrentId),
  removeTorrentFromDownloadQueue: (torrentId) => ipcRenderer.invoke("remove-torrent-from-download-queue", torrentId),
  shiftDownloadQueueElement: (torrentId, offset) => ipcRenderer.invoke("shift-download-queue-element", torrentId, offset),
  updateDownloadCategorie:(callback) => ipcRenderer.on("update-download-categorie",(event,data) => callback(data)),
  getDownloadQueueList: () => ipcRenderer.invoke("get-download-queue-list"),

  getMsgFromMainProcess: (callback)=> ipcRenderer.on("msg-from-main-process",(event,data)=>callback(data)),
  getFetchingTorrentErrors: (callback)=> ipcRenderer.on("torrent-fetching-error",(event,data)=>callback(data)),
  getDownloadErrorsReports: (callback)=> ipcRenderer.on("report-download-errors",(event,data)=>callback(data)),
  getDownloadProgress:(callback) => ipcRenderer.on("download-progress-stream",(event,data) => callback(data)),
  getSubtitlesDownloadProgress:(callback) => ipcRenderer.on("subtitles-download-progress",(event,data) => callback(data)),
  getTorrentStreamingReport:(callback) => ipcRenderer.on("torrent-streaming-report",(event,data) => callback(data)),
  updateDownloadStatus:(callback) => ipcRenderer.on("update-download-status",(event,data) => callback(data)),

  downloadImage: (downloadPath, imageUrl) => ipcRenderer.invoke("download-image",downloadPath, imageUrl),
  downloadBackdrop: (backgroundImageUrl, title) => ipcRenderer.invoke("download-backdrop", backgroundImageUrl, title),
  checkFileExists: (filePath) => ipcRenderer.invoke("check-file-exists", filePath),

  loadPageCachedDataFromHistory: (currentPageURL) => ipcRenderer.invoke("load-cached-data-from-history",currentPageURL),

  addSearchHistoryItem: (query) => ipcRenderer.invoke("add-search-history-item", query),
  getSearchHistory: () => ipcRenderer.invoke("get-search-history"), 
  removeSearchHistoryItem: (query) => ipcRenderer.invoke("remove-search-history-item", query),

  validateTMDBApiKey: (inputedApiKey)=> ipcRenderer.invoke("validate-tmdb-api-key",inputedApiKey),
  validateWyzieApiKey: (inputedApiKey)=> ipcRenderer.invoke("validate-wyzie-api-key",inputedApiKey),

  saveApiKey: (apiKey) => ipcRenderer.invoke("save-api-key",apiKey),

  openExternalLink: (url) => ipcRenderer.invoke("open-external-link",url),
  sendSystemNotification: (options) => ipcRenderer.send("send-system-notification", options),

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', (event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('updates-download-progress', (event, data) => callback(data)),
  onUpdateDownloadFailed: (callback) => ipcRenderer.on('update-download-error', (event, data) => callback(data)),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  restartAndUpdate: () => ipcRenderer.send("restart-and-update")
});

const zoomFactor = ipcRenderer.sendSync('get-zoom-factor');
if (zoomFactor) {
  webFrame.setZoomFactor(zoomFactor);
}

const canGoBack = ipcRenderer.sendSync("can-go-back");
const isFullscreened = ipcRenderer.sendSync("is-fullscreened");
contextBridge.exposeInMainWorld("__initialNavState", {
  canGoBack: canGoBack,
  isFullscreened: isFullscreened,
});
