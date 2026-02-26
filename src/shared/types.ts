// Connection credentials
export interface ConnectionCredentials {
  siteUrl: string;
  apiKey: string;
}

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// MCP request/response types
export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: McpError;
}

export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP Tool
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// MCP Tool Call Result
export interface McpToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

// === AI PROXY TYPES ===

export interface GCAuthCredentials {
  gcApiKey: string;
}

export interface AIChatPayload {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system_prompt: string;
  model?: string;
}

export interface AIChatResponse {
  success: boolean;
  content?: Array<{
    type: 'text' | 'mcp_tool_use' | 'mcp_tool_result';
    text?: string;
    name?: string;
    input?: any;
    content?: any;
  }>;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
  tier?: string;
  error?: string;
  status?: number;
}

export interface AIStatusResponse {
  connected: boolean;
  tier: string;
  email: string;
  has_mcp: boolean;
  allowed_models: string[];
  default_model: string;
  limits: {
    daily_requests: number;
    monthly_requests: number;
    max_tokens: number;
  };
  usage: {
    today: { requests: number; input_tokens: number; output_tokens: number };
    month: { requests: number; input_tokens: number; output_tokens: number };
  };
}

export interface AIRegistrationPayload {
  email: string;
  site_url: string;
  mcp_api_key: string;
}

export interface AIRegistrationResponse {
  success: boolean;
  api_key?: string;
  tier?: string;
  message?: string;
}

// IPC API exposed to renderer via contextBridge
export interface ElectronAPI {
  credentials: {
    save: (credentials: ConnectionCredentials) => Promise<boolean>;
    load: () => Promise<ConnectionCredentials | null>;
    clear: () => Promise<boolean>;
    saveGCApiKey: (key: string) => Promise<boolean>;
    getGCApiKey: () => Promise<string | null>;
  };
  mcp: {
    request: (siteUrl: string, apiKey: string, body: McpRequest) => Promise<McpResponse>;
  };
  ai: {
    chat: (payload: {
      gcApiKey: string;
      messages: Array<{ role: string; content: string }>;
      systemPrompt: string;
      model?: string;
    }) => Promise<AIChatResponse>;
    status: (gcApiKey: string) => Promise<AIStatusResponse>;
    usage: (gcApiKey: string) => Promise<any>;
    register: (payload: {
      email: string;
      siteUrl: string;
      mcpApiKey: string;
    }) => Promise<AIRegistrationResponse>;
  };
  notifications: {
    send: (title: string, body: string) => Promise<void>;
  };
}

// Product type
export interface Product {
  id: number;
  name: string;
  price: string;
  sale_price?: string;
  status: string;
  stock_quantity: number | null;
  stock?: number;
  sku: string;
  description?: string;
  short_description?: string;
  weight?: number;
  low_stock_threshold?: number;
  featured?: boolean;
  image?: string;
  image_url?: string;
  category_name?: string;
  categories?: Array<{ name: string; slug: string }>;
}

// Order type
export interface Order {
  id: number;
  order_number?: string;
  status: string;
  total: string;
  currency: string;
  currency_symbol?: string;
  date_created: string;
  notes?: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  line_items: Array<{
    name: string;
    product_id?: number;
    quantity: number;
    total: string;
  }>;
}

// Customer type
export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_created: string;
  orders_count: number;
  total_spent: string;
  phone?: string;
  company?: string;
  account_type?: 'individual' | 'business';
  tax_id?: string;
  is_tax_exempt?: boolean;
}

// Dashboard stats
export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  recentOrders: Order[];
}

// Declare global window interface for the electron API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
