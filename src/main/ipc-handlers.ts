import { ipcMain, safeStorage, Notification, net, app, shell, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_FILE = 'credentials.enc';
const LICENSE_KEY_FILE = 'license-key.enc';

function getCredentialsPath(): string {
  return path.join(app.getPath('userData'), CREDENTIALS_FILE);
}

function getLicenseKeyPath(): string {
  return path.join(app.getPath('userData'), LICENSE_KEY_FILE);
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

  // Open URL in system browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Save file with system dialog
  ipcMain.handle('dialog:save-file', async (_event, filename: string, base64Content: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const ext = path.extname(filename).replace('.', '');
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: filename,
      filters: [
        { name: ext.toUpperCase(), extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return false;
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return true;
  });

  // Open file picker for images — returns { filePath, base64, filename } or null
  ipcMain.handle('dialog:pick-image', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    };
    const mime = mimeMap[ext] || 'image/jpeg';

    return { filePath, base64, filename, mime };
  });

  // Upload a local image file to WordPress via MCP tool call
  // Writes the file to a temp location, starts a temp server, calls upload_image_from_url, cleans up
  ipcMain.handle('media:upload-local', async (_event, payload: {
    siteUrl: string;
    apiKey: string;
    base64: string;
    filename: string;
    mime: string;
  }) => {
    const http = require('http');
    const buffer = Buffer.from(payload.base64, 'base64');

    // Start a temporary HTTP server to serve the file
    return new Promise((resolve) => {
      const server = http.createServer((_req: any, res: any) => {
        res.writeHead(200, {
          'Content-Type': payload.mime,
          'Content-Length': buffer.length,
        });
        res.end(buffer);
      });

      server.listen(0, '127.0.0.1', async () => {
        const port = server.address().port;
        const tempUrl = `http://127.0.0.1:${port}/${payload.filename}`;

        try {
          // Call MCP upload_image_from_url via the MCP endpoint
          const normalizedUrl = payload.siteUrl.replace(/\/+$/, '');
          const mcpUrl = `${normalizedUrl}/wp-json/mcp/v1/mcp?api_key=${encodeURIComponent(payload.apiKey)}`;

          const mcpBody = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: 'upload_image_from_url',
              arguments: {
                url: tempUrl,
                filename: payload.filename,
              },
            },
          };

          const response = await net.fetch(mcpUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mcpBody),
          });

          const data = await response.json();

          // Parse the MCP response to get attachment_id
          const resultText = data?.result?.content?.[0]?.text;
          if (resultText) {
            const parsed = JSON.parse(resultText);
            if (parsed.success) {
              resolve({
                success: true,
                attachment_id: parsed.attachment_id,
                url: parsed.url,
              });
            } else {
              resolve({ success: false, error: parsed.error ?? 'Upload failed' });
            }
          } else if (data?.error) {
            resolve({ success: false, error: data.error.message ?? 'MCP error' });
          } else {
            resolve({ success: false, error: 'Unexpected response' });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          resolve({ success: false, error: message });
        } finally {
          server.close();
        }
      });
    });
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

  // Save license key securely
  ipcMain.handle('license:save-key', async (_event, licenseKey: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available on this system');
      }
      const encrypted = safeStorage.encryptString(licenseKey);
      fs.writeFileSync(getLicenseKeyPath(), encrypted);
      return true;
    } catch (error) {
      console.error('Failed to save license key:', error);
      return false;
    }
  });

  // Load license key
  ipcMain.handle('license:get-key', async () => {
    try {
      const keyPath = getLicenseKeyPath();
      if (!fs.existsSync(keyPath)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      const encrypted = fs.readFileSync(keyPath);
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('Failed to load license key:', error);
      return null;
    }
  });

  // Clear license key
  ipcMain.handle('license:clear-key', async () => {
    try {
      const keyPath = getLicenseKeyPath();
      if (fs.existsSync(keyPath)) {
        fs.unlinkSync(keyPath);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear license key:', error);
      return false;
    }
  });

  // Validate license key against GGM License Server
  ipcMain.handle('license:validate', async (_event, licenseKey: string, siteUrl: string) => {
    try {
      const response = await net.fetch('https://wpgoose.com/wp-json/ggm-license/v1/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, site_url: siteUrl }),
      });
      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: 'network_error', message: `Failed to validate license: ${message}` };
    }
  });

  // Get license status from GGM License Server
  ipcMain.handle('license:status', async (_event, licenseKey: string) => {
    try {
      const response = await net.fetch('https://wpgoose.com/wp-json/ggm-license/v1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey }),
      });
      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: 'network_error', message: `Failed to check license status: ${message}` };
    }
  });

  // Deactivate license for a site
  ipcMain.handle('license:deactivate', async (_event, licenseKey: string, siteUrl: string) => {
    try {
      const response = await net.fetch('https://wpgoose.com/wp-json/ggm-license/v1/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, site_url: siteUrl }),
      });
      return await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: 'network_error', message: `Failed to deactivate license: ${message}` };
    }
  });
}
