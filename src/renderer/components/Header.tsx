import { useConnectionStore } from '../stores/connectionStore';

export function Header() {
  const { siteUrl, status } = useConnectionStore();

  const statusColors: Record<string, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
  };

  const statusLabels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  return (
    <header className="h-14 bg-white border-b border-goose-border flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
        <span className="text-sm text-goose-text-light">
          {statusLabels[status]}
        </span>
        {siteUrl && (
          <span className="text-sm text-goose-text-light ml-2">
            {siteUrl}
          </span>
        )}
      </div>

      <button
        onClick={() => window.location.reload()}
        className="p-2 text-goose-text-light hover:text-goose-text hover:bg-gray-100 rounded-lg transition-colors"
        title="Refresh"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </header>
  );
}
