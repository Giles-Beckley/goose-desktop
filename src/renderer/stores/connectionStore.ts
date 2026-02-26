import { create } from 'zustand';
import type { ConnectionStatus, AIStatusResponse } from '../../shared/types';

interface ConnectionState {
  siteUrl: string;
  apiKey: string;
  status: ConnectionStatus;
  isOnboarded: boolean;

  // GC proxy auth
  gcApiKey: string;
  aiTier: string;
  aiConnected: boolean;
  aiAllowedModels: string[];
  aiDefaultModel: string;
  aiLimits: { daily_requests: number; monthly_requests: number; max_tokens: number } | null;
  aiUsageToday: { requests: number; input_tokens: number; output_tokens: number } | null;
  aiUsageMonth: { requests: number; input_tokens: number; output_tokens: number } | null;
  aiEmail: string;

  setSiteUrl: (url: string) => void;
  setApiKey: (key: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setCredentials: (siteUrl: string, apiKey: string) => void;
  setOnboarded: (onboarded: boolean) => void;
  setGcApiKey: (key: string) => void;
  setAiStatus: (status: AIStatusResponse) => void;
  clearCredentials: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  siteUrl: '',
  apiKey: '',
  status: 'disconnected',
  isOnboarded: false,

  gcApiKey: '',
  aiTier: 'free',
  aiConnected: false,
  aiAllowedModels: [],
  aiDefaultModel: 'claude-haiku-4-5-20251001',
  aiLimits: null,
  aiUsageToday: null,
  aiUsageMonth: null,
  aiEmail: '',

  setSiteUrl: (url) => set({ siteUrl: url }),
  setApiKey: (key) => set({ apiKey: key }),
  setStatus: (status) => set({ status }),
  setCredentials: (siteUrl, apiKey) => set({ siteUrl, apiKey }),
  setOnboarded: (onboarded) => set({ isOnboarded: onboarded }),
  setGcApiKey: (key) => set({ gcApiKey: key }),
  setAiStatus: (status: AIStatusResponse) =>
    set({
      aiConnected: status.connected,
      aiTier: status.tier,
      aiEmail: status.email,
      aiAllowedModels: status.allowed_models,
      aiDefaultModel: status.default_model,
      aiLimits: status.limits,
      aiUsageToday: status.usage?.today ?? null,
      aiUsageMonth: status.usage?.month ?? null,
    }),
  clearCredentials: () =>
    set({
      siteUrl: '',
      apiKey: '',
      status: 'disconnected',
      isOnboarded: false,
      gcApiKey: '',
      aiConnected: false,
      aiTier: 'free',
      aiAllowedModels: [],
      aiEmail: '',
      aiLimits: null,
      aiUsageToday: null,
      aiUsageMonth: null,
    }),
}));
