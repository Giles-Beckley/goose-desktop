import { useState, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useMcp } from '../hooks/useMcp';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { UpdaterStatus } from '../../shared/types';

export function Settings() {
  const {
    siteUrl, apiKey, status,
    aiConnected, aiTier, aiEmail,
    aiLimits, aiUsageToday, aiUsageMonth,
    licenseKey, licenseValid, licensePlanTier, licenseStatus, licenseExpiresAt, licenseEmail,
    setCredentials, clearCredentials, setOnboarded,
    setAiStatus, setLicense, clearLicense,
  } = useConnectionStore();
  const { testConnection } = useMcp();

  const [url, setUrl] = useState(siteUrl);
  const [key, setKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  // AI settings
  const [testingAi, setTestingAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');

  // License key entry
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState('');
  const [changingLicense, setChangingLicense] = useState(false);

  // Fetch AI status on mount if we have a valid license
  useEffect(() => {
    async function loadAiStatus() {
      if (!licenseKey || !licenseValid) return;
      try {
        const statusResp = await window.electronAPI.ai.status(licenseKey);
        if (statusResp.connected) {
          setAiStatus(statusResp);
        }
      } catch { /* ignore */ }
    }
    loadAiStatus();
  }, [licenseKey, licenseValid, setAiStatus]);

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
    await window.electronAPI.license.clearKey();
    clearLicense();
    clearCredentials();
    setOnboarded(false);
    setUrl('');
    setKey('');
    setMessage('Disconnected and credentials cleared.');
  };

  const handleTestAiConnection = async () => {
    if (!licenseKey) {
      setAiMessage('No license key found. Please activate a license first.');
      return;
    }
    setTestingAi(true);
    setAiMessage('');
    try {
      const statusResp = await window.electronAPI.ai.status(licenseKey);
      if (statusResp.connected) {
        setAiStatus(statusResp);
        setAiMessage('AI connection is active!');
      } else {
        setAiMessage('Connection failed. Your license may not include AI access.');
      }
    } catch {
      setAiMessage('Failed to reach the AI service.');
    }
    setTestingAi(false);
  };

  const handleActivateLicense = async () => {
    if (!newLicenseKey) {
      setLicenseMessage('Please enter a license key.');
      return;
    }
    setActivatingLicense(true);
    setLicenseMessage('');
    try {
      const result = await window.electronAPI.license.validate(newLicenseKey, siteUrl);
      if (result.success) {
        await window.electronAPI.license.saveKey(newLicenseKey);
        setLicense({
          licenseKey: newLicenseKey,
          valid: true,
          planTier: result.plan_tier,
          status: 'active',
          expiresAt: result.expires_at,
        });

        // Link MCP server to the license so AI can use store tools
        if (siteUrl && apiKey) {
          try {
            await window.electronAPI.ai.updateMcp({
              licenseKey: newLicenseKey,
              siteUrl,
              mcpApiKey: apiKey,
            });
          } catch {
            // Non-critical
          }
        }

        // Fetch AI status with the new license key
        try {
          const statusResp = await window.electronAPI.ai.status(newLicenseKey);
          if (statusResp.connected) {
            setAiStatus(statusResp);
          }
        } catch {
          // AI status fetch is non-critical
        }

        setNewLicenseKey('');
        setChangingLicense(false);
        setLicenseMessage('License activated successfully!');
      } else {
        const errorMessages: Record<string, string> = {
          invalid_license: 'Invalid license key. Please check and try again.',
          license_suspended: 'This license has been suspended.',
          license_revoked: 'This license has been revoked.',
          license_expired: 'This license has expired. Please renew.',
          site_limit_reached: 'Site activation limit reached. Deactivate another site or upgrade.',
        };
        setLicenseMessage(errorMessages[result.error ?? ''] ?? result.message ?? 'License validation failed.');
      }
    } catch {
      setLicenseMessage('Failed to validate license. Check your connection.');
    }
    setActivatingLicense(false);
  };

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

        {/* AI License */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">AI License</h2>
          <div className="space-y-3">
            {licenseValid ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">Active</span>
                  {licensePlanTier && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      licensePlanTier === 'developer' ? 'bg-purple-100 text-purple-700' :
                      licensePlanTier === 'agency' ? 'bg-blue-100 text-blue-700' :
                      licensePlanTier === 'unlimited' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {licensePlanTier.charAt(0).toUpperCase() + licensePlanTier.slice(1)}
                    </span>
                  )}
                </div>
                {licenseKey && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">License Key</label>
                    <code className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      {licenseKey.substring(0, 9)}...{licenseKey.substring(licenseKey.length - 4)}
                    </code>
                  </div>
                )}
                {licenseEmail && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Licensed To</label>
                    <p className="text-sm text-gray-700">{licenseEmail}</p>
                  </div>
                )}
                {licenseExpiresAt && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Expires</label>
                    <p className="text-sm text-gray-700">
                      {new Date(licenseExpiresAt).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {/* AI details — part of the license */}
                <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
                  <label className="block text-xs font-medium text-gray-500">AI Assistant</label>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${aiConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-700">
                      {aiConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>

                  {/* Usage This Month */}
                  {aiLimits && (
                    <div>
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

                  {aiMessage && (
                    <p className={`text-sm ${aiMessage.includes('active') ? 'text-green-600' : 'text-red-600'}`}>
                      {aiMessage}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button onClick={handleTestAiConnection} disabled={testingAi} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
                      {testingAi && <LoadingSpinner size="sm" />}
                      Test AI Connection
                    </button>
                    {!changingLicense && (
                      <button
                        onClick={() => {
                          setChangingLicense(true);
                          setNewLicenseKey('');
                          setLicenseMessage('');
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Change License
                      </button>
                    )}
                  </div>
                </div>

                {/* Change license form */}
                {changingLicense && (
                  <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New License Key</label>
                      <input
                        type="text"
                        value={newLicenseKey}
                        onChange={(e) => setNewLicenseKey(e.target.value.toUpperCase())}
                        placeholder="GGMC-XXXX-XXXX-XXXX-XXXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {licenseMessage && (
                      <p className={`text-sm ${licenseMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                        {licenseMessage}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={handleActivateLicense}
                        disabled={activatingLicense || !newLicenseKey}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {activatingLicense && <LoadingSpinner size="sm" />}
                        {activatingLicense ? 'Activating...' : 'Update License'}
                      </button>
                      <button
                        onClick={() => {
                          setChangingLicense(false);
                          setNewLicenseKey('');
                          setLicenseMessage('');
                        }}
                        disabled={activatingLicense}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  A license key unlocks the AI Assistant. Get yours at{' '}
                  <button
                    onClick={() => window.electronAPI.shell.openExternal('https://wpgoose.com/desktop-key/')}
                    className="text-primary-600 hover:text-primary-700 underline"
                  >
                    wpgoose.com/desktop-key
                  </button>
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Key</label>
                  <input
                    type="text"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value.toUpperCase())}
                    placeholder="GGMC-XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {licenseMessage && (
                  <p className={`text-sm ${licenseMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {licenseMessage}
                  </p>
                )}
                <button
                  onClick={handleActivateLicense}
                  disabled={activatingLicense || !newLicenseKey}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {activatingLicense && <LoadingSpinner size="sm" />}
                  {activatingLicense ? 'Activating...' : 'Activate License'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Updates */}
        <UpdatesSection />

        {/* About */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-sm text-gray-600">Goose Commerce Desktop v{__APP_VERSION__}</p>
          <p className="text-sm text-gray-500 mt-1">A desktop client for managing your Goose Commerce store.</p>
        </div>
      </div>
    </div>
  );
}

function UpdatesSection() {
  const [status, setStatus] = useState<UpdaterStatus>({ state: 'idle', currentVersion: __APP_VERSION__ });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Pull whatever the main process already knows (e.g. from auto-check on launch)
    window.electronAPI.updater.getStatus().then((s) => {
      if (mounted && s) setStatus(s);
    });
    const unsubscribe = window.electronAPI.updater.onStatus((s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await window.electronAPI.updater.check();
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = () => window.electronAPI.updater.download();
  const handleInstall = () => window.electronAPI.updater.install();

  const renderState = () => {
    switch (status.state) {
      case 'checking':
        return <p className="text-sm text-gray-500 flex items-center gap-2"><LoadingSpinner size="sm" />Checking for updates...</p>;
      case 'available':
        return (
          <div className="space-y-3">
            <p className="text-sm text-primary-700">
              Version <strong>{status.version}</strong> is available (you have {status.currentVersion}).
            </p>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Download update
            </button>
          </div>
        );
      case 'downloading': {
        const pct = status.progressPct ?? 0;
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">Downloading update... {pct}%</p>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      }
      case 'downloaded':
        return (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              Update <strong>{status.version}</strong> downloaded. Restart to install.
            </p>
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Restart and install
            </button>
          </div>
        );
      case 'not-available':
        return <p className="text-sm text-green-700">You're on the latest version.</p>;
      case 'error':
        return <p className="text-sm text-red-600">Update check failed: {status.error ?? 'Unknown error'}</p>;
      default:
        return <p className="text-sm text-gray-500">Click below to check for updates.</p>;
    }
  };

  const showCheckButton = status.state === 'idle' || status.state === 'not-available' || status.state === 'error';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Updates</h2>
      <div className="space-y-3">
        {renderState()}
        {showCheckButton && (
          <button
            onClick={handleCheck}
            disabled={checking}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {checking && <LoadingSpinner size="sm" />}
            Check for updates
          </button>
        )}
      </div>
    </div>
  );
}

