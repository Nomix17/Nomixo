const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.invoke('change-page', page),
  goBack: () => ipcRenderer.invoke('go-back'),
  StreamVideo: (magnet,MediaId,MediaType,subsObjects,metaData) => ipcRenderer.invoke('play-torrent', magnet, MediaId, MediaType, subsObjects,metaData),
  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen"),
  getAPIKEY: () => ipcRenderer.invoke("get-api-key"),
  // saveVideo: () => ipcRenderer.invoke("save-video"),
  applySettings: (SettingsObj) => ipcRenderer.invoke("apply-settings", SettingsObj),
  applyTheme: (ThemeObj) => ipcRenderer.send("apply-theme",ThemeObj),
  applySubConfig: (JsonSubConfig) => ipcRenderer.send("apply-sub-config",JsonSubConfig),
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  loadTheme: () => ipcRenderer.invoke("load-theme"),
  loadSubConfig: () => ipcRenderer.invoke("load-sub"),
  addMediaToLibrary: (mediaEntryPoint) => ipcRenderer.send("add-to-lib",mediaEntryPoint),
  removeMediaFromLibrary: (mediaEntryPoint) => ipcRenderer.send("remove-from-lib",mediaEntryPoint),
  loadMediaLibraryInfo: (targetIdentification) => ipcRenderer.invoke("load-from-lib",targetIdentification)
});

