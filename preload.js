const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  navigateTo: (page) => ipcRenderer.invoke('change-page', page),
  goBack: () => ipcRenderer.invoke('go-back',event),
  getVideoUrl: (magnet) => ipcRenderer.invoke('get-video-url', magnet),
  toggleFullscreen: () => ipcRenderer.invoke("request-fullscreen")
});

