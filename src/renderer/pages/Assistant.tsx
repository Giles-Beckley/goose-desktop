import { ChatPanel } from '../components/ChatPanel';
import { useAIChat } from '../hooks/useAIChat';
import { useConnectionStore } from '../stores/connectionStore';

export function Assistant() {
  const { clearChat, messages } = useAIChat();
  const { licenseValid } = useConnectionStore();

  if (!licenseValid) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-2xl mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Assistant</h2>
          <p className="text-sm text-gray-500 mb-4">
            The AI Assistant requires a license key. Get yours to unlock AI-powered store management.
          </p>
          <button
            onClick={() => window.electronAPI.shell.openExternal('https://wpgoose.com/desktop-key/')}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Get a License Key
          </button>
          <p className="text-xs text-gray-400 mt-3">
            Already have a key? Add it in Settings.
          </p>
        </div>
      </div>
    );
  }

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
