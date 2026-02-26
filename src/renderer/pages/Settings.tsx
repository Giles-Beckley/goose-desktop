import { useState, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Settings() {
  const {
    siteUrl, apiKey, status, gcApiKey,
    aiConnected, aiTier, aiEmail, aiAllowedModels, aiDefaultModel,
    aiLimits, aiUsageToday, aiUsageMonth,
    setCredentials, clearCredentials, setOnboarded,
    setGcApiKey, setAiStatus,
  } = useConnectionStore();
  const { testConnection } = useMcp();

  const [url, setUrl] = useState(siteUrl);
  const [key, setKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  // AI settings
  const [selectedModel, setSelectedModel] = useState(aiDefaultModel);
  const [testingAi, setTestingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [showGcKey, setShowGcKey] = useState(false);

  // Load GC API key and fetch status on mount
  useEffect(() => {
    async function loadGcKey() {
      const saved = await window.electronAPI.credentials.getGCApiKey();
      if (saved) {
        setGcApiKey(saved);
        try {
          const statusResp = await window.electronAPI.ai.status(saved);
          if (statusResp.connected) {
            setAiStatus(statusResp);
            setSelectedModel(statusResp.default_model);
          }
        } catch { /* ignore */ }
      }
    }
    loadGcKey();
  }, [setGcApiKey, setAiStatus]);

  const handleTestConnection = async () => {
    if (!url || !key) {
      setMessage('Please enter both Site URL and API Key.');
      return;
    }
    setTesting(true);
    setMessage('');
    const success = await testConnection(url, key);
    setMessage(success ? 'Connection successful!' : 'Connection failed. Please check your credentials.');
    setTesting(false);
  };

  const handleSave = async () => {
    if (!url || !key) {
      setMessage('Please enter both Site URL and API Key.');
      return;
    }
    const saved = await window.electronAPI.credentials.save({ siteUrl: url, apiKey: key });
    if (saved) {
      setCredentials(url, key);
      setMessage('Credentials saved successfully.');
    } else {
      setMessage('Failed to save credentials.');
    }
  };

  const handleDisconnect = async () => {
    await window.electronAPI.credentials.clear();
    clearCredentials();
    setOnboarded(false);
    setUrl('');
    setKey('');
    setMessage('Disconnected and credentials cleared.');
  };

  const handleTestAiConnection = async () => {
    if (!gcApiKey) {
      setAiMessage('No GC API key found. Please register first.');
      return;
    }
    setTestingAi(true);
    setAiMessage('');
    try {
      const statusResp = await window.electronAPI.ai.status(gcApiKey);
      if (statusResp.connected) {
        setAiStatus(statusResp);
        setAiMessage('AI connection is active!');
      } else {
        setAiMessage('Connection failed. Your API key may be invalid.');
      }
    } catch {
      setAiMessage('Failed to reach the AI service.');
    }
    setTestingAi(false);
  };

  const maskedGcKey = gcApiKey
    ? gcApiKey.substring(0, 6) + '...' + gcApiKey.substring(gcApiKey.length - 4)
    : '';

  const monthlyPct = aiLimits?.monthly_requests
    ? Math.min(((aiUsageMonth?.requests ?? 0) / aiLimits.monthly_requests) * 100, 100)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="max-w-xl space-y-6">
        {/* Connection Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store Connection</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mystore.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MCP API Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your MCP API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            {message && (
              <p className={`text-sm ${message.includes('successful') || message.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleTestConnection} disabled={testing} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
                {testing && <LoadingSpinner size="sm" />}
                Test Connection
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                Save
              </button>
              {status !== 'disconnected' && (
                <button onClick={handleDisconnect} className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors">
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Assistant</h2>
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${aiConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm text-gray-700">
                {aiConnected ? 'Connected' : 'Not connected'}
              </span>
              {aiTier && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  aiTier === 'business' ? 'bg-purple-100 text-purple-700' :
                  aiTier === 'pro' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {aiTier.charAt(0).toUpperCase() + aiTier.slice(1)}
                </span>
              )}
            </div>

            {/* Account info */}
            {aiEmail && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
                <p className="text-sm text-gray-700">{aiEmail}</p>
              </div>
            )}

            {/* GC API Key display */}
            {gcApiKey && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">GC API Key</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                    {showGcKey ? gcApiKey : maskedGcKey}
                  </code>
                  <button
                    onClick={() => setShowGcKey(!showGcKey)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {showGcKey ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(gcApiKey)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Usage This Month */}
            {aiLimits && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Usage This Month</label>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>{aiUsageMonth?.requests ?? 0} / {aiLimits.monthly_requests} requests</span>
                  <span className="text-xs text-gray-400">{monthlyPct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${monthlyPct >= 90 ? 'bg-red-500' : monthlyPct >= 70 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                    style={{ width: `${monthlyPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Today: {aiUsageToday?.requests ?? 0} / {aiLimits.daily_requests}</span>
                  <span>Max tokens: {aiLimits.max_tokens.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Model selection */}
            {aiAllowedModels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  {aiAllowedModels.map((m) => (
                    <option key={m} value={m}>{formatModelLabel(m)}</option>
                  ))}
                </select>
                {aiAllowedModels.length === 1 && (
                  <p className="text-xs text-gray-400 mt-1">Upgrade your plan for access to more models.</p>
                )}
              </div>
            )}

            {aiMessage && (
              <p className={`text-sm ${aiMessage.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
                {aiMessage}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleTestAiConnection} disabled={testingAi} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
                {testingAi && <LoadingSpinner size="sm" />}
                Test Connection
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-sm text-gray-600">Goose Commerce Desktop v1.0.0</p>
          <p className="text-sm text-gray-500 mt-1">A desktop client for managing your Goose Commerce store.</p>
        </div>
      </div>
    </div>
  );
}

function formatModelLabel(model: string): string {
  if (model.includes('haiku')) return 'Claude Haiku 4.5 (Fastest)';
  if (model.includes('sonnet')) return 'Claude Sonnet 4.5 (Recommended)';
  if (model.includes('opus')) return 'Claude Opus 4.6 (Most capable)';
  return model;
}
