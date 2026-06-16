import type { McpRequest, McpResponse, McpTool, McpToolResult, ConnectionStatus, GgmcAccess } from '../../shared/types';
import { extractAccess } from '../../shared/access';
import type { Currency, AddressSettings } from '../../shared/currency';
import { toCurrency, toAddressSettings } from '../../shared/currency';

export interface StoreSettings {
  currency: Currency | null;
  addresses: AddressSettings | null;
}

let requestId = 0;

function nextId(): number {
  return ++requestId;
}

function buildRequest(method: string, params?: Record<string, unknown>): McpRequest {
  return {
    jsonrpc: '2.0',
    id: nextId(),
    method,
    params,
  };
}

export class McpClient {
  private siteUrl: string;
  private apiKey: string;
  public status: ConnectionStatus = 'disconnected';

  constructor(siteUrl: string, apiKey: string) {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private async sendRequest(request: McpRequest): Promise<McpResponse> {
    return window.electronAPI.mcp.request(this.siteUrl, this.apiKey, request);
  }

  async initialize(): Promise<McpResponse> {
    const request = buildRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'goose-commerce-desktop',
        version: '1.0.0',
      },
    });
    return this.sendRequest(request);
  }

  /**
   * Initialize and return the key's Access Group block (ggmcAccess). Returns
   * null if the server doesn't advertise access info (older plugin) or the
   * call errors — callers should treat null as "unknown / unrestricted".
   */
  async getAccess(): Promise<GgmcAccess | null> {
    const response = await this.initialize();
    if (response.error) return null;
    return extractAccess(response.result);
  }

  /**
   * Re-check the current key's access without a full re-init, via the
   * `whoami` tool (returns `{ success, access: {...} }`). Returns null on error.
   */
  async whoami(): Promise<GgmcAccess | null> {
    try {
      const result = await this.callTool('whoami', {});
      const text = result?.content?.[0]?.text;
      if (!text) return null;
      return extractAccess(JSON.parse(text));
    } catch {
      return null;
    }
  }

  /**
   * Initialize and return the store's currency settings via get_store_settings.
   * Returns null if the plugin lacks the tool or the call errors — callers
   * should fall back to the default currency.
   */
  async getCurrency(): Promise<Currency | null> {
    return (await this.getStoreSettings()).currency;
  }

  /**
   * Initialize and return the store's settings (currency + address capabilities)
   * via get_store_settings. Each field is null if absent (older plugin) or on
   * error — callers should fall back to their own defaults.
   */
  async getStoreSettings(): Promise<StoreSettings> {
    try {
      await this.initialize();
      const result = await this.callTool('get_store_settings', {});
      const text = result?.content?.[0]?.text;
      if (!text) return { currency: null, addresses: null };
      const data = JSON.parse(text);
      return {
        currency: data?.currency ? toCurrency(data.currency) : null,
        addresses: data?.addresses ? toAddressSettings(data.addresses) : null,
      };
    } catch {
      return { currency: null, addresses: null };
    }
  }

  async listTools(): Promise<McpTool[]> {
    const request = buildRequest('tools/list');
    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(response.error.message);
    }

    const result = response.result as { tools?: McpTool[] } | undefined;
    return result?.tools ?? [];
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const request = buildRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result as McpToolResult;
  }

  async readResource(uri: string): Promise<McpToolResult> {
    const request = buildRequest('resources/read', { uri });
    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Resources return { contents: [...] }, normalise to match McpToolResult shape
    const result = response.result as { contents?: Array<{ text?: string; uri?: string; mimeType?: string }> };
    return {
      content: (result?.contents ?? []).map(c => ({
        type: 'text',
        text: c.text ?? '',
      })),
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      this.status = 'connecting';
      const response = await this.initialize();

      if (response.error) {
        this.status = 'error';
        return false;
      }

      this.status = 'connected';
      return true;
    } catch {
      this.status = 'error';
      return false;
    }
  }

  updateConfig(siteUrl: string, apiKey: string): void {
    this.siteUrl = siteUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.status = 'disconnected';
  }
}
