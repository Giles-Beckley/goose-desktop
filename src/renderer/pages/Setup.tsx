import { useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Setup() {
  const { setCredentials, setOnboarded, setStatus } = useConnectionStore();
  const { testConnection } = useMcp();

  const [siteUrl, setSiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState(false);

  const handleTestConnection = async () => {
    if (!siteUrl || !apiKey) {
      setError('Please enter both Site URL and API Key.');
      return;
    }

    setTesting(true);
    setError('');
    setTested(false);

    const success = await testConnection(siteUrl, apiKey);

    if (success) {
      setTested(true);
      setStatus('connected');
    } else {
      setError('Connection failed. Please check your Site URL and API Key.');
    }
    setTesting(false);
  };

  const handleSaveAndContinue = async () => {
    if (!tested) {
      setError('Please test the connection first.');
      return;
    }

    const saved = await window.electronAPI.credentials.save({ siteUrl, apiKey });
    if (saved) {
      setCredentials(siteUrl, apiKey);
      setOnboarded(true);
    } else {
      setError('Failed to save credentials securely. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Goose Commerce</h1>
          <p className="text-gray-500 mt-2">
            Connect your WordPress store to get started.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Site URL
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => { setSiteUrl(e.target.value); setTested(false); }}
                placeholder="https://mystore.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your WordPress site address
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTested(false); }}
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

            {tested && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-600">Connection successful!</p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testing || !siteUrl || !apiKey}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testing && <LoadingSpinner size="sm" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                onClick={handleSaveAndContinue}
                disabled={!tested}
                className="w-full px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Your credentials are stored securely using OS-level encryption.
        </p>
      </div>
    </div>
  );
}
