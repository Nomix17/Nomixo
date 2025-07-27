const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.invoke('change-page', page),
  goBack: () => ipcRenderer.invoke('go-back'),
  getVideoUrl: (magnet) => ipcRenderer.invoke('get-video-url', magnet),
  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen"),
  getAPIKEY: () => ipcRenderer.invoke("get-api-key"),
  saveVideo: () => ipcRenderer.invoke("save-video"),
  applySettings: (SettingsObj) => ipcRenderer.invoke("apply-settings", SettingsObj),
  loadSettings: () => ipcRenderer.invoke("load-settings")
});

