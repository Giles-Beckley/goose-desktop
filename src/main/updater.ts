import { app, ipcMain, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterStatus {
  state: UpdaterState;
  version?: string;
  currentVersion: string;
  progressPct?: number;
  error?: string;
}

let lastStatus: UpdaterStatus = { state: 'idle', currentVersion: app.getVersion() };

function broadcast(window: BrowserWindow | null, status: UpdaterStatus) {
  lastStatus = status;
  if (window && !window.isDestroyed()) {
    window.webContents.send('updater:status', status);
  }
}

export function registerUpdateHandlers(window: BrowserWindow | null): void {
  // The user opts in to download via the Settings UI; auto-check is allowed.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    broadcast(window, { state: 'checking', currentVersion: app.getVersion() });
  });

  autoUpdater.on('update-available', (info) => {
    broadcast(window, {
      state: 'available',
      version: info.version,
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('update-not-available', () => {
    broadcast(window, { state: 'not-available', currentVersion: app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcast(window, {
      state: 'downloading',
      currentVersion: app.getVersion(),
      progressPct: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcast(window, {
      state: 'downloaded',
      version: info.version,
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on('error', (err) => {
    broadcast(window, {
      state: 'error',
      currentVersion: app.getVersion(),
      error: err?.message ?? String(err),
    });
  });

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const remoteVersion = result?.updateInfo?.version;
      const available = !!remoteVersion && remoteVersion !== app.getVersion();
      return {
        available,
        version: remoteVersion,
        currentVersion: app.getVersion(),
      };
    } catch (err: any) {
      broadcast(window, {
        state: 'error',
        currentVersion: app.getVersion(),
        error: err?.message ?? String(err),
      });
      return {
        available: false,
        currentVersion: app.getVersion(),
        error: err?.message ?? String(err),
      };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      broadcast(window, {
        state: 'error',
        currentVersion: app.getVersion(),
        error: err?.message ?? String(err),
      });
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('updater:get-status', () => lastStatus);
}

export function checkForUpdatesQuiet(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch(() => {
    // errors already broadcast via the 'error' event
  });
}
