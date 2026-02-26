import { ChatPanel } from '../components/ChatPanel';
import { useAIChat } from '../hooks/useAIChat';

export function Assistant() {
  const { clearChat, messages } = useAIChat();

  return (
    <div className="h-full -m-6 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-bold text-gray-900">AI Assistant</h1>
          <p className="text-xs text-gray-500">Ask questions or give instructions about your store</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Chat
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
