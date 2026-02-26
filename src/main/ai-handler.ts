import { ipcMain, net } from 'electron';

const PROXY_BASE_URL = 'https://wpgoose.com/wp-json/gc-ai/v1';

/**
 * Makes an HTTP request to the wpgoose.com proxy endpoint.
 * Uses Electron's net module for proper proxy/certificate handling.
 */
async function proxyRequest(
  endpoint: string,
  method: 'GET' | 'POST',
  gcApiKey: string,
  body?: object
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${PROXY_BASE_URL}${endpoint}`;

    const request = net.request({
      method,
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-GC-API-Key', gcApiKey);

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (response.statusCode && response.statusCode >= 400) {
            resolve({
              success: false,
              error: parsed.message || parsed.error || `HTTP ${response.statusCode}`,
              status: response.statusCode,
            });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData.substring(0, 200)}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (body && method === 'POST') {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

export function registerAIHandlers(): void {

  // Send a chat message through the proxy
  ipcMain.handle('ai:chat', async (_event, payload: {
    gcApiKey: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt: string;
    model?: string;
  }) => {
    try {
      const result = await proxyRequest('/chat', 'POST', payload.gcApiKey, {
        messages: payload.messages,
        system_prompt: payload.systemPrompt,
        model: payload.model,
      });
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  });

  // Get connection status and tier info
  ipcMain.handle('ai:status', async (_event, gcApiKey: string) => {
    try {
      return await proxyRequest('/status', 'GET', gcApiKey);
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || String(error),
      };
    }
  });

  // Get usage stats
  ipcMain.handle('ai:usage', async (_event, gcApiKey: string) => {
    try {
      return await proxyRequest('/usage', 'GET', gcApiKey);
    } catch (error: any) {
      return { error: error.message || String(error) };
    }
  });

  // Register a new user (no auth needed for this one)
  ipcMain.handle('ai:register', async (_event, payload: {
    email: string;
    siteUrl: string;
    mcpApiKey: string;
  }) => {
    try {
      return await new Promise((resolve, reject) => {
        const request = net.request({
          method: 'POST',
          url: `${PROXY_BASE_URL}/register`,
        });
        request.setHeader('Content-Type', 'application/json');

        let data = '';
        request.on('response', (response) => {
          response.on('data', (chunk) => { data += chunk.toString(); });
          response.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('Invalid response')); }
          });
        });
        request.on('error', reject);
        request.write(JSON.stringify({
          email: payload.email,
          site_url: payload.siteUrl,
          mcp_api_key: payload.mcpApiKey,
        }));
        request.end();
      });
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  });
}
