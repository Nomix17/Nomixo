const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.invoke('change-page', page),
  goBack: () => ipcRenderer.invoke('go-back'),
  getVideoUrl: (magnet) => ipcRenderer.invoke('get-video-url', magnet),
  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen"),
  getAPIKEY: () => ipcRenderer.invoke("get-api-key"),
  saveVideo: () => ipcRenderer.invoke("save-video"),
  applySettings: (SettingsObj) => ipcRenderer.invoke("apply-settings", SettingsObj),
  applyTheme: (ThemeObj) => ipcRenderer.send("apply-theme",ThemeObj),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  loadTheme: () => ipcRenderer.invoke("load-theme"),
  addMediaToLibrary: (mediaEntryPoint) => ipcRenderer.send("add-to-lib",mediaEntryPoint),
  removeMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("remove-from-lib",mediaEntryPoint),
  loadMediaLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-lib",targetIdentification),
  loadDownloadLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-download-lib",targetIdentification),
  downloadTorrent: (torrentInformation) => ipcRenderer.invoke("download-torrent",torrentInformation),
  getDownloadProgress:(fn) => ipcRenderer.on("download-progress-stream",(event,data) => fn(data)),
  cancelDownload: (mediaInfo) => ipcRenderer.invoke("cancel-torrent-download", mediaInfo),
  toggleTorrentDownload: (torrentId) => ipcRenderer.invoke("toggle-torrent-download", torrentId)
});

