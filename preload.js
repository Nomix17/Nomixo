const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (newPageURL,currentPageURL,cacheData) => ipcRenderer.send('change-page', newPageURL,currentPageURL,cacheData),
  goBack: (currentPageURL) => ipcRenderer.invoke('go-back',currentPageURL),
  canGoBack: () => ipcRenderer.invoke('can-go-back'),

  getFullVideoPath: (dirPath,fileName) => ipcRenderer.invoke("get-full-video-path",dirPath,fileName),
  getVideoUrl: (magnet,fileName) => ipcRenderer.invoke('get-video-url', magnet,fileName),

  StreamTorrentOverMpv: (metaData,subsObjects) => ipcRenderer.invoke('play-torrent-over-mpv',metaData, subsObjects),
  PlayVideoOverMpv: (metaData) => ipcRenderer.invoke('play-video-over-mpv',metaData),

  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen"),
  openFileSystemBrowser: (currentPath) => ipcRenderer.invoke("open-filesystem-browser",currentPath),
  getAPIKEY: () => ipcRenderer.invoke("get-api-key"),
  
  applySettings: (SettingsObj) => ipcRenderer.invoke("apply-settings", SettingsObj),
  applyTheme: (ThemeObj) => ipcRenderer.send("apply-theme",ThemeObj),
  applySubConfig: (JsonSubConfig) => ipcRenderer.send("apply-sub-config",JsonSubConfig),

  loadSettings: () => ipcRenderer.invoke("load-settings"),
  loadTheme: () => ipcRenderer.invoke("load-theme"),
  loadSubConfig: () => ipcRenderer.invoke("load-sub"),
  
  addMediaToLibrary: (mediaEntryPoint) => ipcRenderer.send("add-to-lib",mediaEntryPoint),
  removeMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("remove-from-lib",mediaEntryPoint),
  editMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("edit-element-lib",mediaEntryPoint),
  loadMediaLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-lib",targetIdentification),

  addElementToDownloadInfo: (torrentId, mediaInfo) => ipcRenderer.invoke("add-to-download-lib",torrentId, mediaInfo),
  removeElementFromDownloadLibraryInfo: (torrentId) => ipcRenderer.invoke("remove-from-download-lib",torrentId),
  editElementInDownloadLibraryInfo: (torrentId, key, value) => ipcRenderer.invoke("edit-download-lib",torrentId, key, value),
  loadDownloadLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-download-lib",targetIdentification),
  
  downloadSubtitles: (mediaInfo, subsObjects) => ipcRenderer.invoke("download-subtitles", mediaInfo, subsObjects),
  loadLocalSubs: (videoPath,identifyingElements) => ipcRenderer.invoke("load-local-subs",videoPath,identifyingElements),
  readSubFile: (filePath) => ipcRenderer.invoke("read-sub-file",filePath),

  downloadTorrent: (torrentInformation,subsObjects) => ipcRenderer.invoke("download-torrent",torrentInformation,subsObjects),
  getDownloadProgress:(fn) => ipcRenderer.on("download-progress-stream",(event,data) => fn(data)),
  toggleTorrentDownload: (torrentId) => ipcRenderer.invoke("toggle-torrent-download", torrentId),
  cancelDownload: (mediaInfo) => ipcRenderer.invoke("cancel-torrent-download", mediaInfo),
  updateDownloadCategorie:(fn) => ipcRenderer.on("update-download-categorie",(event,data) => fn(data)),

  getMsgFromMainProcess: (fn)=> ipcRenderer.on("msg-from-main-process",(event,data)=>fn(data)),
  getFetchingTorrentErrors: (fn)=> ipcRenderer.on("torrent-fetching-error",(event,data)=>fn(data)),
  getDownloadErrorsReports: (fn)=> ipcRenderer.on("report-download-errors",(event,data)=>fn(data)),

  downloadImage: (downloadPath, imageUrl) => ipcRenderer.invoke("download-image",downloadPath, imageUrl),

  loadPageCachedDataFromHistory: (currentPageURL) => ipcRenderer.invoke("load-cached-data-from-history",currentPageURL),

  validateApiKey: (inputedApiKey)=> ipcRenderer.invoke("validate-api-key",inputedApiKey),
  saveApiKey: (apiKey) => ipcRenderer.invoke("save-api-key",apiKey),

  openExternelLink: (url) => ipcRenderer.invoke("open-externel-link",url)
});

