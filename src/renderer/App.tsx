import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Exports } from './pages/Exports';
import { Discounts } from './pages/Discounts';
import { Locations } from './pages/Locations';
import { Settings } from './pages/Settings';
import { Assistant } from './pages/Assistant';
import { Register } from './pages/Register';
import { FloatingChatButton } from './components/FloatingChatButton';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useConnectionStore } from './stores/connectionStore';
import { Starting } from './pages/Starting';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('React error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">Something went wrong</h2>
          <pre className="text-xs text-red-500 bg-red-50 p-3 rounded overflow-auto">{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const { isOnboarded, licenseValid, setOnboarded, setSites, setActiveSite, setAiStatus, setLicense } = useConnectionStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCredentials() {
      try {
        // Load the multisite state (auto-migrates a legacy single-site install
        // on first run). The active site determines onboarding; setActiveSite
        // re-points the connection and runs the connect-time probes (access,
        // store settings, locations) itself under its staleness guard.
        const { sites, activeSiteId } = await window.electronAPI.sites.load();
        setSites(sites);
        const activeSite =
          sites.find((s) => s.id === activeSiteId) ?? sites[0] ?? null;
        if (activeSite) {
          setActiveSite(activeSite.id);
          setOnboarded(true);
        }

        // Load and validate license key (for AI features — non-blocking)
        const savedLicenseKey = await window.electronAPI.license.getKey();
        if (savedLicenseKey) {
          const licenseResult = await window.electronAPI.license.status(savedLicenseKey);

          if (licenseResult.success && licenseResult.status === 'active') {
            const isExpired = licenseResult.expires_at && new Date(licenseResult.expires_at) < new Date();

            if (!isExpired) {
              setLicense({
                licenseKey: savedLicenseKey,
                valid: true,
                planTier: licenseResult.plan_tier,
                status: licenseResult.status,
                expiresAt: licenseResult.expires_at,
                email: licenseResult.customer_email,
              });

              // Ensure MCP server is linked to the license, using the active site.
              if (activeSite?.siteUrl && activeSite?.apiKey) {
                try {
                  await window.electronAPI.ai.updateMcp({
                    licenseKey: savedLicenseKey,
                    siteUrl: activeSite.siteUrl,
                    mcpApiKey: activeSite.apiKey,
                  });
                } catch {
                  // Non-critical
                }
              }

              // Fetch AI status using the license key directly
              try {
                const statusResp = await window.electronAPI.ai.status(savedLicenseKey);
                if (statusResp.connected) {
                  setAiStatus(statusResp);
                }
              } catch {
                // Non-critical — AI status fetch can fail silently
              }
            } else {
              await window.electronAPI.license.clearKey();
            }
          } else if (licenseResult.error === 'network_error') {
            // Can't reach server — allow offline use with cached license
            setLicense({
              licenseKey: savedLicenseKey,
              valid: true,
            });
          } else {
            // License invalid/suspended/revoked — clear it silently
            await window.electronAPI.license.clearKey();
          }
        }
      } catch (error) {
        console.error('Failed to load credentials:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCredentials();
  }, [setOnboarded, setSites, setActiveSite, setAiStatus, setLicense]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isOnboarded) {
    return <Register />;
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/starting" element={<Starting />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/exports" element={<Exports />} />
            <Route path="/discounts" element={<Discounts />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        {licenseValid && <FloatingChatButton />}
      </HashRouter>
    </ErrorBoundary>
  );
}
