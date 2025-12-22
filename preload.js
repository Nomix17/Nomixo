const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.invoke('change-page', page),
  goBack: () => ipcRenderer.invoke('go-back'),
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
  loadDownloadLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-download-lib",targetIdentification),
  downloadTorrent: (torrentInformation,subsObjects) => ipcRenderer.invoke("download-torrent",torrentInformation,subsObjects),
  getDownloadProgress:(fn) => ipcRenderer.on("download-progress-stream",(event,data) => fn(data)),
  cancelDownload: (mediaInfo) => ipcRenderer.invoke("cancel-torrent-download", mediaInfo),
  toggleTorrentDownload: (torrentId) => ipcRenderer.invoke("toggle-torrent-download", torrentId),
  getFullVideoPath: (dirPath,fileName) => ipcRenderer.invoke("get-full-video-path",dirPath,fileName),
  loadLocalSubs: (downloadPath,torrentId) => ipcRenderer.invoke("load-local-subs",downloadPath,torrentId),
  readSubFile: (filePath) => ipcRenderer.invoke("read-sub-file",filePath)
});

