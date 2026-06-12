import { contextBridge, ipcRenderer } from 'electron';
import type { RendererApi, ThemeInfo } from '../shared/ipc';

// The bridge is narrow and purpose-named: methods name capabilities, never
// transport. Raw ipcRenderer (or any whole Electron module) is never put on
// window — it would hand injected code every channel the app has
// (docs/principles/stack/electron/ipc-contracts.md).

const api: RendererApi = {
  getStatus: () => ipcRenderer.invoke('app:get-status'),
  getCoreHealth: () => ipcRenderer.invoke('core:health'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  onThemeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: ThemeInfo) =>
      callback(theme);
    ipcRenderer.on('theme:changed', listener);
    return () => {
      ipcRenderer.removeListener('theme:changed', listener);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
