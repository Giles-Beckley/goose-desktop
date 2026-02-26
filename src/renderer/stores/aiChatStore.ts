import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  contentBlocks?: Array<{
    type: 'text' | 'mcp_tool_use' | 'mcp_tool_result';
    text?: string;
    name?: string;
    input?: any;
    content?: any;
  }>;
  isLoading?: boolean;
  error?: string;
  model?: string;
  tier?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AIChatStore {
  messages: ChatMessage[];
  isProcessing: boolean;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (message: Partial<ChatMessage>) => void;
  setProcessing: (processing: boolean) => void;
  updateLastAssistant: (updates: Partial<ChatMessage>) => void;
  clearChat: () => void;
}

export const useAIChatStore = create<AIChatStore>((set) => ({
  messages: [],
  isProcessing: false,

  addUserMessage: (content: string) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          timestamp: new Date(),
        },
      ],
    }));
  },

  addAssistantMessage: (message: Partial<ChatMessage>) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          ...message,
        },
      ],
    }));
  },

  setProcessing: (processing: boolean) => set({ isProcessing: processing }),

  updateLastAssistant: (updates: Partial<ChatMessage>) => {
    set((state) => {
      const messages = [...state.messages];
      const lastIdx = messages.findLastIndex((m) => m.role === 'assistant');
      if (lastIdx >= 0) {
        messages[lastIdx] = { ...messages[lastIdx], ...updates };
      }
      return { messages };
    });
  },

  clearChat: () => set({ messages: [] }),
}));
