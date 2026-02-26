import { useState } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Register() {
  const { setCredentials, setOnboarded, setStatus, setGcApiKey, setAiStatus } = useConnectionStore();

  const [email, setEmail] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async () => {
    if (!email || !siteUrl || !mcpApiKey) {
      setError('Please fill in all fields.');
      return;
    }

    setRegistering(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await window.electronAPI.ai.register({
        email,
        siteUrl,
        mcpApiKey,
      });

      if (result.success && result.api_key) {
        // Save the GC API key securely
        await window.electronAPI.credentials.saveGCApiKey(result.api_key);
        setGcApiKey(result.api_key);

        // Also save site credentials for MCP
        await window.electronAPI.credentials.save({ siteUrl, apiKey: mcpApiKey });
        setCredentials(siteUrl, mcpApiKey);

        // Fetch status/tier info
        try {
          const status = await window.electronAPI.ai.status(result.api_key);
          if (status.connected) {
            setAiStatus(status);
          }
        } catch {
          // Non-critical — proceed anyway
        }

        setStatus('connected');
        setOnboarded(true);
      } else {
        setError(result.message || result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Check your internet connection.');
    } finally {
      setRegistering(false);
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
            Register your store to get started with AI-powered management.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

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

            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-600">{successMessage}</p>
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={registering || !email || !siteUrl || !mcpApiKey}
              className="w-full px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {registering && <LoadingSpinner size="sm" />}
              {registering ? 'Registering...' : 'Register & Connect'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Your credentials are stored securely using OS-level encryption.<br />
          No Anthropic API key needed — AI is included with your account.
        </p>
      </div>
    </div>
  );
}
