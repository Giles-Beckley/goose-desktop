import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  credentials: {
    save: (credentials: { siteUrl: string; apiKey: string }) =>
      ipcRenderer.invoke('credentials:save', credentials),
    load: () => ipcRenderer.invoke('credentials:load'),
    clear: () => ipcRenderer.invoke('credentials:clear'),
  },
  sites: {
    load: () => ipcRenderer.invoke('sites:load'),
    save: (state: unknown) => ipcRenderer.invoke('sites:save', state),
    setActive: (id: string) => ipcRenderer.invoke('sites:set-active', id),
  },
  mcp: {
    request: (siteUrl: string, apiKey: string, body: unknown) =>
      ipcRenderer.invoke('mcp:request', siteUrl, apiKey, body),
  },
  ai: {
    chat: (payload: unknown) =>
      ipcRenderer.invoke('ai:chat', payload),
    status: (licenseKey: string) =>
      ipcRenderer.invoke('ai:status', licenseKey),
    usage: (licenseKey: string) =>
      ipcRenderer.invoke('ai:usage', licenseKey),
    updateMcp: (payload: { licenseKey: string; siteUrl: string; mcpApiKey: string }) =>
      ipcRenderer.invoke('ai:update-mcp', payload),
  },
  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke('shell:open-external', url),
  },
  dialog: {
    saveFile: (filename: string, base64Content: string) =>
      ipcRenderer.invoke('dialog:save-file', filename, base64Content),
    pickImage: () =>
      ipcRenderer.invoke('dialog:pick-image') as Promise<{ filePath: string; base64: string; filename: string; mime: string } | null>,
    pickFile: () =>
      ipcRenderer.invoke('dialog:pick-file') as Promise<{ filePath: string; base64: string; filename: string; mime: string; size: number } | null>,
  },
  media: {
    uploadLocal: (payload: { siteUrl: string; apiKey: string; base64: string; filename: string; mime: string }) =>
      ipcRenderer.invoke('media:upload-local', payload) as Promise<{ success: boolean; attachment_id?: number; url?: string; error?: string }>,
  },
  notifications: {
    send: (title: string, body: string) =>
      ipcRenderer.invoke('notifications:send', title, body),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    onStatus: (cb: (status: unknown) => void) => {
      const listener = (_event: unknown, status: unknown) => cb(status);
      ipcRenderer.on('updater:status', listener as any);
      return () => ipcRenderer.removeListener('updater:status', listener as any);
    },
  },
  license: {
    saveKey: (licenseKey: string) =>
      ipcRenderer.invoke('license:save-key', licenseKey),
    getKey: () =>
      ipcRenderer.invoke('license:get-key'),
    clearKey: () =>
      ipcRenderer.invoke('license:clear-key'),
    validate: (licenseKey: string, siteUrl: string) =>
      ipcRenderer.invoke('license:validate', licenseKey, siteUrl),
    status: (licenseKey: string) =>
      ipcRenderer.invoke('license:status', licenseKey),
    deactivate: (licenseKey: string, siteUrl: string) =>
      ipcRenderer.invoke('license:deactivate', licenseKey, siteUrl),
  },
});
