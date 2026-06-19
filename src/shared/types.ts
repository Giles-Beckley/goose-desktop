import type { Currency } from './currency';

// Connection credentials
export interface ConnectionCredentials {
  siteUrl: string;
  apiKey: string;
}

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// === MULTISITE ===

/**
 * One connected store. The app can hold several of these; exactly one is the
 * "active" site that the rest of the UI (Products, Orders, Settings…) operates
 * on. `id` is a stable, locally-generated identifier (not the site URL, so a
 * site can be re-pointed without losing its identity / overview position).
 */
export interface SiteConnection {
  id: string;
  label: string;
  siteUrl: string;
  apiKey: string;
}

/** Persisted multisite state: the list of sites plus which one is active. */
export interface SitesState {
  sites: SiteConnection[];
  activeSiteId: string | null;
}

/** Per-site health, derived from an MCP probe on the Starting overview page. */
export type SiteHealth = 'online' | 'offline' | 'error';

/**
 * A point-in-time snapshot of one site for the Starting overview. Built on the
 * page from per-site MCP calls; never persisted. `metrics`/`pending` are absent
 * when the site is unreachable.
 */
export interface SiteOverview {
  id: string;
  health: SiteHealth;
  /** ISO timestamp of when this snapshot was taken. */
  lastChecked: string;
  /** Short reason when health is 'error' (e.g. an HTTP message). */
  error?: string;
  /** The site's own store currency (for formatting its revenue). Absent when
   *  unreachable or on an older plugin — callers fall back to the default. */
  currency?: Currency;
  metrics?: {
    productCount: number | null;
    recentOrders: number | null;
    revenue: number | null;
  };
  pending?: {
    pendingOrders: number | null;
  };
}

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

// === ACCESS GROUPS (ggmcAccess) ===

/**
 * Per-domain access level enforced by the store's API-key Access Group.
 * A key with no group is unrestricted (every domain reports 'write').
 */
export type AccessLevel = 'none' | 'read' | 'write';

/**
 * The 15 business domains the store restricts per Access Group, plus the
 * 'general' pseudo-domain (dispatcher tools + whoami) which is always allowed.
 * These slugs are a stable contract — see docs/mcp-access-contract.md in the
 * plugin repo. Additions are backwards-compatible; renames are not.
 */
export type AccessDomain =
  | 'product'
  | 'variation'
  | 'attribute'
  | 'inventory'
  | 'order'
  | 'customer'
  | 'cart'
  | 'discount'
  | 'shipment'
  | 'review'
  | 'outlet'
  | 'document'
  | 'export'
  | 'taxonomy'
  | 'media';

/**
 * The ggmcAccess block returned in the `initialize` result (and by the
 * `whoami` tool). When `restricted` is false the key is unrestricted and
 * `domains` may be omitted; treat every domain as 'write'. When `restricted`
 * is true, `domains` carries a level for every domain (missing => 'none').
 */
export interface GgmcAccess {
  group_name?: string;
  restricted: boolean;
  domains?: Partial<Record<AccessDomain, AccessLevel>>;
}

// === AI PROXY TYPES ===

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

// === LICENSE TYPES ===

export type LicensePlanTier = 'basic' | 'unlimited' | 'agency' | 'developer';
export type LicenseValidationStatus = 'active' | 'suspended' | 'revoked';

export interface LicenseValidateResponse {
  success: boolean;
  message?: string;
  plan_tier?: LicensePlanTier;
  widget_limit?: number;
  site_limit?: number;
  expires_at?: string | null;
  error?: string;
}

export interface LicenseStatusResponse {
  success: boolean;
  license_key?: string;
  customer_email?: string;
  plan_tier?: LicensePlanTier;
  widget_limit?: number;
  site_limit?: number;
  status?: LicenseValidationStatus;
  expires_at?: string | null;
  activations?: Array<{
    site_url: string;
    activated_at: string;
    last_checked: string | null;
  }>;
  activations_count?: number;
  error?: string;
  message?: string;
}

// === UPDATER TYPES ===

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

// IPC API exposed to renderer via contextBridge
export interface ElectronAPI {
  credentials: {
    save: (credentials: ConnectionCredentials) => Promise<boolean>;
    load: () => Promise<ConnectionCredentials | null>;
    clear: () => Promise<boolean>;
  };
  sites: {
    load: () => Promise<SitesState>;
    save: (state: SitesState) => Promise<boolean>;
    setActive: (id: string) => Promise<boolean>;
  };
  mcp: {
    request: (siteUrl: string, apiKey: string, body: McpRequest) => Promise<McpResponse>;
  };
  ai: {
    chat: (payload: {
      licenseKey: string;
      messages: Array<{ role: string; content: string }>;
      systemPrompt: string;
      model?: string;
    }) => Promise<AIChatResponse>;
    status: (licenseKey: string) => Promise<AIStatusResponse>;
    usage: (licenseKey: string) => Promise<any>;
    updateMcp: (payload: { licenseKey: string; siteUrl: string; mcpApiKey: string }) => Promise<{ success: boolean; error?: string }>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  dialog: {
    saveFile: (filename: string, base64Content: string) => Promise<boolean>;
    pickImage: () => Promise<{ filePath: string; base64: string; filename: string; mime: string } | null>;
    pickFile: () => Promise<{ filePath: string; base64: string; filename: string; mime: string; size: number } | null>;
  };
  media: {
    uploadLocal: (payload: { siteUrl: string; apiKey: string; base64: string; filename: string; mime: string }) =>
      Promise<{ success: boolean; attachment_id?: number; url?: string; error?: string }>;
  };
  notifications: {
    send: (title: string, body: string) => Promise<void>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  updater: {
    check: () => Promise<{ available: boolean; version?: string; currentVersion: string; error?: string }>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    getStatus: () => Promise<UpdaterStatus>;
    onStatus: (cb: (status: UpdaterStatus) => void) => () => void;
  };
  license: {
    saveKey: (licenseKey: string) => Promise<boolean>;
    getKey: () => Promise<string | null>;
    clearKey: () => Promise<boolean>;
    validate: (licenseKey: string, siteUrl: string) => Promise<LicenseValidateResponse>;
    status: (licenseKey: string) => Promise<LicenseStatusResponse>;
    deactivate: (licenseKey: string, siteUrl: string) => Promise<LicenseValidateResponse>;
  };
}

// Product type
export interface Product {
  id: number;
  name: string;
  price: string;
  sale_price?: string;
  product_type?: string;
  status: string;
  stock_quantity: number | null;
  stock?: number;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  sku: string;
  description?: string;
  short_description?: string;
  weight?: number;
  low_stock_threshold?: number;
  featured?: boolean;
  image?: string;
  image_id?: number;
  image_url?: string;
  images?: string[];
  gallery_ids?: string;
  category_name?: string;
  categories?: Array<{ id: number; name: string; slug: string }>;
  tags?: Array<{ id: number; name: string; slug: string }>;
  created_at?: string;

  // Listing address (Locations premium component — single-location use case)
  listing_address_1?: string;
  listing_address_2?: string;
  listing_city?: string;
  listing_state?: string;
  listing_postcode?: string;
  listing_country?: string;
  listing_lat?: number | null;
  listing_lng?: number | null;
  listing_display?: 'exact' | 'approximate' | 'hidden';

  // Restock date (YYYY-MM-DD) — shown to customers when out of stock
  restock_date?: string;
}

// Locations / Outlets
export interface Outlet {
  id: number;
  name: string;
  slug: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string;
  email?: string;
  url?: string;
  opening_hours?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ProductOutletLink {
  outlet_id: number;
  outlet_name?: string;
  stock: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  price_override?: number | null;
}

// Category/Tag types
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent_id?: number | null;
  display_order?: number;
  status?: string;
  product_count?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  description?: string;
  status?: string;
  product_count?: number;
}

// Product attribute types
export interface AttributeGroup {
  id: number;
  name: string;
  description?: string;
  display_order?: number;
  attributes?: ProductAttribute[];
}

export interface ProductAttribute {
  id: number;
  name: string;
  group_id: number;
  attribute_type: 'text' | 'number' | 'select';
  options?: string[];
  unit?: string;
  filterable?: boolean;
  display_order?: number;
  value?: string | number;
}

// Product variation types
export interface VariationType {
  id: number;
  name: string;
  slug: string;
  input_type: string;
  options: string[];
  display_order?: number;
  status?: string;
}

export interface ProductVariation {
  id: number;
  product_id: number;
  sku: string;
  price: number | null;
  sale_price: number | null;
  stock: number | null;
  stock_status: string;
  is_default: boolean;
  status: string;
  attributes: Array<{
    type_id: number;
    type_name: string;
    value: string;
  }>;
}

// Order type (GGM Commerce schema)
export interface Order {
  id: number;
  order_number?: string;
  status: string;
  total_amount: number;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  created_at: string;
  updated_at?: string;
  payment_status?: string;
  subtotal?: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  currency?: string;
  notes?: string;
  items?: Array<{
    id: number;
    product_id: number;
    product_name?: string;
    product_sku?: string;
    product_image?: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  item_count?: number;
}

// Shipment types
export interface Shipment {
  id: number;
  order_id: number;
  carrier: string;
  tracking_number?: string;
  tracking_url?: string;
  status: string;
  weight?: number;
  cost?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// A saved customer address (billing or shipping). Returned by get_customer in
// the customer.addresses array; also created/updated via the *_customer_address
// MCP tools. The field names here are the MCP API names (address_line_1 etc.),
// which the plugin maps to its DB columns internally.
export interface CustomerAddress {
  id?: number;
  address_type: 'billing' | 'shipping';
  address_name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  is_default?: boolean;
}

// Customer type (GGM Commerce schema)
export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  phone?: string;
  company?: string;
  account_type?: 'individual' | 'business';
  tax_id?: string;
  is_tax_exempt?: boolean;
  total_orders: number;
  total_spent: number;
  last_order_date?: string;
  created_at: string;
  // Only populated by get_customer (not by list_customers).
  addresses?: CustomerAddress[];
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
