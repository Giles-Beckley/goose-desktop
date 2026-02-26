import { ipcMain, safeStorage, Notification, net, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_FILE = 'credentials.enc';
const GC_API_KEY_FILE = 'gc-api-key.enc';

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

function getGCApiKeyPath(): string {
  return path.join(app.getPath('userData'), GC_API_KEY_FILE);
}

export function registerIpcHandlers(): void {
  // Save credentials securely
  ipcMain.handle('credentials:save', async (_event, credentials: { siteUrl: string; apiKey: string }) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }

      const data = JSON.stringify(credentials);
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(getCredentialsPath(), encrypted);
      return true;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  });

  // Load credentials
  ipcMain.handle('credentials:load', async () => {
    try {
      const credPath = getCredentialsPath();
      if (!fs.existsSync(credPath)) {
        return null;
      }

      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }

      const encrypted = fs.readFileSync(credPath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return null;
    }
  });

  // Clear credentials
  ipcMain.handle('credentials:clear', async () => {
    try {
      const credPath = getCredentialsPath();
      if (fs.existsSync(credPath)) {
        fs.unlinkSync(credPath);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      return false;
    }
  });

  // Save GC API key securely
  ipcMain.handle('credentials:save-gc-api-key', async (_event, key: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }
      const encrypted = safeStorage.encryptString(key);
      fs.writeFileSync(getGCApiKeyPath(), encrypted);
      return true;
    } catch (error) {
      console.error('Failed to save GC API key:', error);
      return false;
    }
  });

  // Load GC API key
  ipcMain.handle('credentials:get-gc-api-key', async () => {
    try {
      const keyPath = getGCApiKeyPath();
      if (!fs.existsSync(keyPath)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      const encrypted = fs.readFileSync(keyPath);
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('Failed to load GC API key:', error);
      return null;
    }
  });

  // MCP request proxy
  ipcMain.handle('mcp:request', async (_event, siteUrl: string, apiKey: string, body: unknown) => {
    try {
      // Normalize the site URL
      const normalizedUrl = siteUrl.replace(/\/+$/, '');
      const url = `${normalizedUrl}/wp-json/mcp/v1/mcp?api_key=${encodeURIComponent(apiKey)}`;

      const response = await net.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        jsonrpc: '2.0',
        id: (body as { id?: unknown })?.id ?? null,
        error: {
          code: -32000,
          message: `Request failed: ${message}`,
        },
      };
    }
  });

  // Send native notification
  ipcMain.handle('notifications:send', async (_event, title: string, body: string) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
      });
      notification.show();
    }
  });
}
