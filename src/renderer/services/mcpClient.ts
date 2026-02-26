import type { McpRequest, McpResponse, McpTool, McpToolResult, ConnectionStatus } from '../../shared/types';

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
