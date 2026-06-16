import { create } from 'zustand';
import type { ConnectionStatus, AIStatusResponse, LicensePlanTier, LicenseValidationStatus, GgmcAccess } from '../../shared/types';
import type { Currency } from '../../shared/currency';
import { DEFAULT_CURRENCY } from '../../shared/currency';

interface ConnectionState {
  siteUrl: string;
  apiKey: string;
  status: ConnectionStatus;
  isOnboarded: boolean;

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

  setSiteUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setCredentials: (siteUrl: string, apiKey: string) => void;
  setOnboarded: (onboarded: boolean) => void;
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

export const useConnectionStore = create<ConnectionState>((set) => ({
  siteUrl: '',
  apiKey: '',
  status: 'disconnected',
  isOnboarded: false,

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

  setSiteUrl: (url) => set({ siteUrl: url }),
  setApiKey: (key) => set({ apiKey: key }),
  setStatus: (status) => set({ status }),
  setCredentials: (siteUrl, apiKey) => set({ siteUrl, apiKey }),
  setOnboarded: (onboarded) => set({ isOnboarded: onboarded }),
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
  clearCredentials: () =>
    set({
      siteUrl: '',
      apiKey: '',
      status: 'disconnected',
      isOnboarded: false,
      access: null,
      currency: DEFAULT_CURRENCY,
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
    }),
}));
