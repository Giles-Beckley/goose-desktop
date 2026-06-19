import { useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { TitleBar } from '../components/TitleBar';
import { newSiteId } from '../../shared/ids';
import type { SiteConnection } from '../../shared/types';

export function Register() {
  const { setSites, setActiveSite, setOnboarded } = useConnectionStore();
  const { testConnection } = useMcp();

  const [siteUrl, setSiteUrl] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!siteUrl || !mcpApiKey) {
      setError('Please fill in both fields.');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Test the MCP connection
      const success = await testConnection(siteUrl, mcpApiKey);

      if (!success) {
        setError('Connection failed. Please check your Site URL and MCP API Key.');
        setConnecting(false);
        return;
      }

      // Persist this as the first connected site, then make it active.
      // setActiveSite re-points the connection and runs the access/currency/
      // locations probes itself, so the UI gates domains from the start.
      const site: SiteConnection = {
        id: newSiteId(),
        label: siteUrl,
        siteUrl,
        apiKey: mcpApiKey,
      };
      await window.electronAPI.sites.save({ sites: [site], activeSiteId: site.id });
      setSites([site]);
      setActiveSite(site.id);
      setOnboarded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Check your internet connection.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Goose Commerce</h1>
          <p className="text-gray-500 mt-2">
            Connect to your store to get started.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WordPress Site URL
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://mystore.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your WordPress site address
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MCP API Key
              </label>
              <input
                type="password"
                value={mcpApiKey}
                onChange={(e) => setMcpApiKey(e.target.value)}
                placeholder="Enter your MCP API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Found in Goose Commerce &rarr; Settings &rarr; MCP API Key
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !siteUrl || !mcpApiKey}
              className="w-full px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connecting && <LoadingSpinner size="sm" />}
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Your credentials are stored securely using OS-level encryption.<br />
          Sign up for an AI-powered management key at{' '}
          <button
            onClick={() => window.electronAPI.shell.openExternal('https://wpgoose.com/desktop-key/')}
            className="text-primary-600 hover:text-primary-700 underline"
          >
            wpgoose.com/desktop-key
          </button>
        </p>
      </div>
      </div>
    </div>
  );
}
