import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { registerAIHandlers } from './ai-handler';
import { registerUpdateHandlers, checkForUpdatesQuiet } from './updater';
import { createTray } from './tray';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Remove the default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Goose Commerce',
    frame: false,
    icon: path.join(
      app.isPackaged ? process.resourcesPath : path.join(__dirname, '../..'),
      'resources/icon.png'
    ),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  // Window control handlers for custom title bar
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // Show window when ready to prevent flicker
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // Trigger a silent update check ~5s after the window is ready (packaged builds only)
    setTimeout(() => checkForUpdatesQuiet(), 5000);
  });

  // Load the app — use app.isPackaged to detect dev vs production
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing on Windows
  mainWindow.on('close', (event) => {
    if (process.platform === 'win32' && mainWindow) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  registerAIHandlers();
  createWindow();
  registerUpdateHandlers(mainWindow);

  if (mainWindow) {
    createTray(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before-quit to actually close the window on Windows
app.on('before-quit', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});
