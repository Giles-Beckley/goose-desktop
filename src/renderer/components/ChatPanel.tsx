import { useEffect, useRef } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';
import { UsageBadge } from './UsageBadge';

interface ChatPanelProps {
  showHeader?: boolean;
  onClose?: () => void;
}

export function ChatPanel({ showHeader = false, onClose }: ChatPanelProps) {
  const { messages, isProcessing, sendMessage, clearChat, hasApiKey } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <SuggestedPrompts onSelect={sendMessage} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {!hasApiKey && messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
            Register your store to use the AI assistant. Go to Settings to connect.
          </div>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isProcessing || !hasApiKey} />

      <UsageBadge />
    </div>
  );
}
