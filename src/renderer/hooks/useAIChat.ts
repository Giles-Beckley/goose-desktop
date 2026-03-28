import { useCallback } from 'react';
import { useAIChatStore, type ChatMessage } from '../stores/aiChatStore';
import { useConnectionStore } from '../stores/connectionStore';
import { SYSTEM_PROMPT } from '../../shared/systemPrompt';

const KEEP_FULL_PAIRS = 2; // Keep last 2 user/assistant exchanges in full

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: any }>;
}

/**
 * Trim conversation history to manage token usage:
 * - Last N exchanges: kept in full (including any tool call data)
 * - Older exchanges: stripped to just user question + assistant's final text answer
 *   (removes tool_use, tool_result, and mcp blocks that inflate token counts)
 * - Old tool-role messages: removed entirely
 */
function trimConversationHistory(messages: ApiMessage[]): ApiMessage[] {
  const totalMessages = messages.length;
  const keepFromIndex = Math.max(0, totalMessages - (KEEP_FULL_PAIRS * 2));

  return messages
    .map((msg, index) => {
      // Keep recent messages intact
      if (index >= keepFromIndex) {
        return msg;
      }

      // Strip old tool_result messages entirely
      if ((msg as any).role === 'tool') {
        return null;
      }

      // For older user messages, keep text only
      if (msg.role === 'user') {
        if (Array.isArray(msg.content)) {
          const textOnly = msg.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          return { role: 'user' as const, content: textOnly || '[Previous question]' };
        }
        return msg;
      }

      // For older assistant messages, strip tool_use blocks, keep text only
      if (msg.role === 'assistant') {
        if (Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
          return { role: 'assistant' as const, content: textParts || '[Previous response]' };
        }
        // String content — truncate if very long
        if (typeof msg.content === 'string' && msg.content.length > 2000) {
          return { role: 'assistant' as const, content: msg.content.substring(0, 2000) + '\n[Truncated]' };
        }
        return msg;
      }

      return msg;
    })
    .filter((msg): msg is ApiMessage => msg !== null);
}

export function useAIChat() {
  const {
    messages,
    isProcessing,
    addUserMessage,
    addAssistantMessage,
    setProcessing,
    updateLastAssistant,
    clearChat,
  } = useAIChatStore();

  const { licenseKey } = useConnectionStore();

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isProcessing) return;

      if (!licenseKey) {
        addAssistantMessage({
          content: 'You need a license key to use the AI Assistant. Add one in Settings.',
          error: 'no_license_key',
        });
        return;
      }

      addUserMessage(userInput);
      setProcessing(true);
      addAssistantMessage({ isLoading: true });

      try {
        // Build raw conversation history
        const rawHistory: ApiMessage[] = [
          ...messages
            .filter((m) => m.content && !m.isLoading)
            .map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: userInput },
        ];

        // Trim older exchanges to reduce token usage
        const conversationHistory = trimConversationHistory(rawHistory);

        const response = await window.electronAPI.ai.chat({
          licenseKey,
          messages: conversationHistory as Array<{ role: string; content: string }>,
          systemPrompt: SYSTEM_PROMPT,
        });

        if (response.success) {
          const textContent = (response.content ?? [])
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

          updateLastAssistant({
            content: textContent,
            contentBlocks: response.content,
            isLoading: false,
            model: response.model,
            tier: response.tier,
            usage: response.usage,
          });
        } else {
          let errorMsg = response.error || 'Something went wrong.';
          if (response.status === 429) {
            errorMsg = "You've reached your usage limit. " + errorMsg;
          } else if (response.status === 401) {
            errorMsg = 'Your API key is invalid. Please check Settings.';
          }
          updateLastAssistant({
            content: errorMsg,
            isLoading: false,
            error: response.error,
          });
        }
      } catch (error: any) {
        updateLastAssistant({
          content: `Connection error: ${error.message}. Check your internet connection.`,
          isLoading: false,
          error: error.message,
        });
      } finally {
        setProcessing(false);
      }
    },
    [messages, isProcessing, licenseKey]
  );

  return { messages, isProcessing, sendMessage, clearChat, hasApiKey: !!licenseKey };
}
