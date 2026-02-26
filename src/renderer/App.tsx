import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';
import { Assistant } from './pages/Assistant';
import { Register } from './pages/Register';
import { FloatingChatButton } from './components/FloatingChatButton';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useConnectionStore } from './stores/connectionStore';

export function App() {
  const { isOnboarded, setCredentials, setOnboarded, setStatus, setGcApiKey, setAiStatus } = useConnectionStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCredentials() {
      try {
        // Load site credentials (MCP)
        const credentials = await window.electronAPI.credentials.load();
        if (credentials?.siteUrl && credentials?.apiKey) {
          setCredentials(credentials.siteUrl, credentials.apiKey);
          setStatus('connected');
        }

        // Load GC API key
        const gcKey = await window.electronAPI.credentials.getGCApiKey();
        if (gcKey) {
          setGcApiKey(gcKey);

          // If we have a GC key, we're onboarded
          setOnboarded(true);

          // Fetch AI status/tier info
          try {
            const statusResp = await window.electronAPI.ai.status(gcKey);
            if (statusResp.connected) {
              setAiStatus(statusResp);
            }
          } catch {
            // Non-critical — AI status fetch can fail silently
          }
        } else if (credentials?.siteUrl && credentials?.apiKey) {
          // Legacy: had site credentials but no GC key yet
          setOnboarded(true);
        }
      } catch (error) {
        console.error('Failed to load credentials:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCredentials();
  }, [setCredentials, setOnboarded, setStatus, setGcApiKey, setAiStatus]);

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
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <FloatingChatButton />
    </HashRouter>
  );
}
