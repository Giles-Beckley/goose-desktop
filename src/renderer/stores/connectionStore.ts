import { create } from 'zustand';
import type { ConnectionStatus, AIStatusResponse, LicensePlanTier, LicenseValidationStatus, GgmcAccess, SiteConnection } from '../../shared/types';
import type { Currency, AddressSettings } from '../../shared/currency';
import { DEFAULT_CURRENCY, DEFAULT_ADDRESS_SETTINGS } from '../../shared/currency';
import { McpClient } from '../services/mcpClient';
import { MCP_TOOLS } from '../../shared/mcpTools';

/**
 * Monotonic generation counter for site-scoped async probes. Each call to
 * setActiveSite() bumps this; a probe captures the value at kick-off and
 * discards its result if the counter has since moved on (i.e. the user
 * switched sites again, or A→B→A). This guarantees a slow probe for a site we
 * left can never clobber the access/currency state of the site we're now on.
 */
let activeSiteGeneration = 0;

interface ConnectionState {
  siteUrl: string;
  apiKey: string;
  status: ConnectionStatus;
  isOnboarded: boolean;

  // Multisite: the connected sites and which one is active. The scalar
  // siteUrl/apiKey/access/currency fields above are *derived* from the active
  // site — setActiveSite() is the single place that re-points them.
  sites: SiteConnection[];
  activeSiteId: string | null;

  // AI status (populated from license-based AI proxy)
  aiTier: string;
  aiConnected: boolean;
  aiAllowedModels: string[];
  aiDefaultModel: string;
  aiLimits: { daily_requests: number; monthly_requests: number; max_tokens: number } | null;
  aiUsageToday: { requests: number; input_tokens: number; output_tokens: number } | null;
  aiUsageMonth: { requests: number; input_tokens: number; output_tokens: number } | null;
  aiEmail: string;

  // License (also serves as AI auth key)
  licenseKey: string;
  licenseValid: boolean;
  licensePlanTier: LicensePlanTier | '';
  licenseStatus: LicenseValidationStatus | '';
  licenseExpiresAt: string | null;
  licenseEmail: string;

  // Premium component gates (null = not yet probed)
  locationsEnabled: boolean | null;
  setLocationsEnabled: (enabled: boolean | null) => void;

  // Access Group for the active key (null = not yet known / unrestricted).
  // Read from initialize's ggmcAccess block; re-read whenever the key changes.
  access: GgmcAccess | null;
  setAccess: (access: GgmcAccess | null) => void;

  // Store currency (from the plugin's get_store_settings tool). Defaults to USD
  // until fetched; stays at default on older plugins that lack the tool.
  currency: Currency;
  setCurrency: (currency: Currency) => void;

  // Store address capabilities (from get_store_settings). Defaults to single
  // billing/shipping until fetched / on older plugins.
  addressSettings: AddressSettings;
  setAddressSettings: (addresses: AddressSettings) => void;

  setSiteUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setCredentials: (siteUrl: string, apiKey: string) => void;
  setOnboarded: (onboarded: boolean) => void;

  // Multisite actions. setSites replaces the whole list (e.g. after add/remove);
  // setActiveSite re-points the connection at one site, synchronously resetting
  // the previous site's access/currency state, then re-running the connect-time
  // probes for the new site under a generation guard so stale results are dropped.
  setSites: (sites: SiteConnection[]) => void;
  setActiveSite: (id: string) => void;
  setAiStatus: (status: AIStatusResponse) => void;
  setLicense: (data: {
    licenseKey: string;
    valid: boolean;
    planTier?: LicensePlanTier;
    status?: LicenseValidationStatus;
    expiresAt?: string | null;
    email?: string;
  }) => void;
  clearLicense: () => void;
  clearCredentials: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  siteUrl: '',
  apiKey: '',
  status: 'disconnected',
  isOnboarded: false,

  sites: [],
  activeSiteId: null,

  aiTier: 'free',
  aiConnected: false,
  aiAllowedModels: [],
  aiDefaultModel: 'claude-haiku-4-5-20251001',
  aiLimits: null,
  aiUsageToday: null,
  aiUsageMonth: null,
  aiEmail: '',

  licenseKey: '',
  licenseValid: false,
  licensePlanTier: '',
  licenseStatus: '',
  licenseExpiresAt: null,
  licenseEmail: '',

  locationsEnabled: null,
  setLocationsEnabled: (enabled) => set({ locationsEnabled: enabled }),

  access: null,
  setAccess: (access) => set({ access }),

  currency: DEFAULT_CURRENCY,
  setCurrency: (currency) => set({ currency }),

  addressSettings: DEFAULT_ADDRESS_SETTINGS,
  setAddressSettings: (addresses) => set({ addressSettings: addresses }),

  setSiteUrl: (url) => set({ siteUrl: url }),
  setApiKey: (key) => set({ apiKey: key }),
  setStatus: (status) => set({ status }),
  setCredentials: (siteUrl, apiKey) => set({ siteUrl, apiKey }),
  setOnboarded: (onboarded) => set({ isOnboarded: onboarded }),

  setSites: (sites) => set({ sites }),

  setActiveSite: (id) => {
    const site = get().sites.find((s) => s.id === id);
    if (!site) return;

    // Bump the generation FIRST so any probe still running for the previous
    // site fails its staleness check the moment it resolves.
    const generation = ++activeSiteGeneration;

    // Synchronous reset: point the connection at the new site and clear all
    // access-derived state to its safe default *now*, in one render. access:null
    // means "unknown → show everything" (see shared/access.ts), so the worst
    // transient is a momentarily-permissive menu, never the previous site's
    // restrictions leaking through. currency/addresses fall back to defaults
    // until the new site's get_store_settings resolves.
    set({
      activeSiteId: id,
      siteUrl: site.siteUrl,
      apiKey: site.apiKey,
      status: 'connecting',
      access: null,
      locationsEnabled: null,
      currency: DEFAULT_CURRENCY,
      addressSettings: DEFAULT_ADDRESS_SETTINGS,
    });

    // Probe the new site. Every set() inside is guarded by isCurrent() so a
    // result that arrives after another switch is discarded.
    const isCurrent = () => activeSiteGeneration === generation;
    const client = new McpClient(site.siteUrl, site.apiKey);

    void (async () => {
      try {
        const ok = await client.testConnection();
        if (isCurrent()) set({ status: ok ? 'connected' : 'error' });
      } catch {
        if (isCurrent()) set({ status: 'error' });
      }
    })();

    void (async () => {
      try {
        const access = await client.getAccess();
        if (isCurrent()) set({ access });
      } catch {
        if (isCurrent()) set({ access: null });
      }
    })();

    void (async () => {
      try {
        const settings = await client.getStoreSettings();
        if (!isCurrent()) return;
        if (settings.currency) set({ currency: settings.currency });
        if (settings.addresses) set({ addressSettings: settings.addresses });
      } catch { /* keep defaults */ }
    })();

    void (async () => {
      try {
        await client.initialize();
        const result = await client.callTool(MCP_TOOLS.LIST_OUTLETS, { limit: 1 });
        const text = result?.content?.[0]?.text;
        let enabled = true;
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data?.error === 'license_inactive') enabled = false;
          } catch { /* treat as enabled */ }
        }
        if (isCurrent()) set({ locationsEnabled: enabled });
      } catch {
        // Network/connection issue — treat as enabled so the UI doesn't vanish.
        if (isCurrent()) set({ locationsEnabled: true });
      }
    })();
  },
  setAiStatus: (status: AIStatusResponse) =>
    set({
      aiConnected: status.connected ?? false,
      aiTier: status.tier ?? 'free',
      aiEmail: status.email ?? '',
      aiAllowedModels: status.allowed_models ?? [],
      aiDefaultModel: status.default_model ?? 'claude-haiku-4-5-20251001',
      aiLimits: status.limits ?? null,
      aiUsageToday: status.usage?.today ?? null,
      aiUsageMonth: status.usage?.month ?? null,
    }),
  setLicense: (data) =>
    set({
      licenseKey: data.licenseKey,
      licenseValid: data.valid,
      licensePlanTier: data.planTier ?? '',
      licenseStatus: data.status ?? '',
      licenseExpiresAt: data.expiresAt ?? null,
      licenseEmail: data.email ?? '',
    }),
  clearLicense: () =>
    set({
      licenseKey: '',
      licenseValid: false,
      licensePlanTier: '',
      licenseStatus: '',
      licenseExpiresAt: null,
      licenseEmail: '',
      aiConnected: false,
      aiTier: 'free',
      aiAllowedModels: [],
      aiEmail: '',
      aiLimits: null,
      aiUsageToday: null,
      aiUsageMonth: null,
    }),
  clearCredentials: () => {
    // Any in-flight site probe must not resurrect state after a full clear.
    activeSiteGeneration++;
    set({
      siteUrl: '',
      apiKey: '',
      status: 'disconnected',
      isOnboarded: false,
      sites: [],
      activeSiteId: null,
      access: null,
      currency: DEFAULT_CURRENCY,
      addressSettings: DEFAULT_ADDRESS_SETTINGS,
      locationsEnabled: null,
      aiConnected: false,
      aiTier: 'free',
      aiAllowedModels: [],
      aiEmail: '',
      aiLimits: null,
      aiUsageToday: null,
      aiUsageMonth: null,
      licenseKey: '',
      licenseValid: false,
      licensePlanTier: '',
      licenseStatus: '',
      licenseExpiresAt: null,
      licenseEmail: '',
    });
  },
}));
