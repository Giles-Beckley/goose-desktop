import { ipcMain, net } from 'electron';

const PROXY_BASE_URL = 'https://wpgoose.com/wp-json/ggm-license/v1/ai';

// Timeout for AI chat requests (3 minutes — these can involve multiple MCP tool calls)
const CHAT_TIMEOUT_MS = 180_000;
// Timeout for other AI requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Makes an HTTP request to the AI proxy endpoint on the license server.
 * Authenticates using the license key via X-GC-API-Key header.
 */
async function proxyRequest(
  endpoint: string,
  method: 'GET' | 'POST',
  licenseKey: string,
  body?: object,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${PROXY_BASE_URL}${endpoint}`;

    const request = net.request({
      method,
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-GC-API-Key', licenseKey);

    let responseData = '';
    let timedOut = false;

    // Set up timeout
    const timer = setTimeout(() => {
      timedOut = true;
      request.abort();
      resolve({
        success: false,
        error: 'Request timed out. The operation may still be processing on the server. Try again or break the task into smaller steps.',
      });
    }, timeoutMs);

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        clearTimeout(timer);
        if (timedOut) return;

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
          // Response is not JSON — likely an HTML error page (502, 504, etc.)
          const statusCode = response.statusCode ?? 0;
          let friendlyMessage: string;

          if (statusCode === 504 || responseData.includes('Gateway Time-out')) {
            friendlyMessage = 'The server timed out processing this request. The operation involved too many steps. Try breaking it into smaller tasks (e.g. update 3 products at a time).';
          } else if (statusCode === 502 || responseData.includes('Bad Gateway')) {
            friendlyMessage = 'The server returned a bad gateway error. Please try again in a moment.';
          } else if (statusCode === 503) {
            friendlyMessage = 'The server is temporarily unavailable. Please try again in a moment.';
          } else {
            friendlyMessage = `Server error (HTTP ${statusCode}). Please try again.`;
          }

          resolve({
            success: false,
            error: friendlyMessage,
          });
        }
      });
    });

    request.on('error', (error) => {
      clearTimeout(timer);
      if (timedOut) return;
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
    licenseKey: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt: string;
    model?: string;
  }) => {
    try {
      const result = await proxyRequest('/chat', 'POST', payload.licenseKey, {
        messages: payload.messages,
        system_prompt: payload.systemPrompt,
        model: payload.model,
      }, CHAT_TIMEOUT_MS);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  });

  // Get connection status and tier info
  ipcMain.handle('ai:status', async (_event, licenseKey: string) => {
    try {
      return await proxyRequest('/status', 'GET', licenseKey);
    } catch (error: any) {
      return {
        connected: false,
        error: error.message || String(error),
      };
    }
  });

  // Get usage stats
  ipcMain.handle('ai:usage', async (_event, licenseKey: string) => {
    try {
      return await proxyRequest('/usage', 'GET', licenseKey);
    } catch (error: any) {
      return { error: error.message || String(error) };
    }
  });

  // Update MCP server config on the license record
  ipcMain.handle('ai:update-mcp', async (_event, payload: {
    licenseKey: string;
    siteUrl: string;
    mcpApiKey: string;
  }) => {
    try {
      return await proxyRequest('/mcp', 'POST', payload.licenseKey, {
        site_url: payload.siteUrl,
        mcp_api_key: payload.mcpApiKey,
      });
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  });
}
