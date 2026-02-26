import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  credentials: {
    save: (credentials: { siteUrl: string; apiKey: string }) =>
      ipcRenderer.invoke('credentials:save', credentials),
    load: () => ipcRenderer.invoke('credentials:load'),
    clear: () => ipcRenderer.invoke('credentials:clear'),
    saveGCApiKey: (key: string) =>
      ipcRenderer.invoke('credentials:save-gc-api-key', key),
    getGCApiKey: () =>
      ipcRenderer.invoke('credentials:get-gc-api-key'),
  },
  mcp: {
    request: (siteUrl: string, apiKey: string, body: unknown) =>
      ipcRenderer.invoke('mcp:request', siteUrl, apiKey, body),
  },
  ai: {
    chat: (payload: unknown) =>
      ipcRenderer.invoke('ai:chat', payload),
    status: (gcApiKey: string) =>
      ipcRenderer.invoke('ai:status', gcApiKey),
    usage: (gcApiKey: string) =>
      ipcRenderer.invoke('ai:usage', gcApiKey),
    register: (payload: unknown) =>
      ipcRenderer.invoke('ai:register', payload),
  },
  notifications: {
    send: (title: string, body: string) =>
      ipcRenderer.invoke('notifications:send', title, body),
  },
});
