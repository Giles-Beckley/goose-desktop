import { useCallback, useRef } from 'react';
import { McpClient } from '../services/mcpClient';
import { useConnectionStore } from '../stores/connectionStore';
import { isAccessDenied } from '../../shared/access';
import type { McpToolResult } from '../../shared/types';

const normalizeUrl = (u: string) => u.replace(/\/+$/, '');

export function useMcp() {
  const { siteUrl, apiKey, setStatus, setAccess } = useConnectionStore();
  const clientRef = useRef<McpClient | null>(null);

  const getClient = useCallback((): McpClient | null => {
    if (!siteUrl || !apiKey) return null;

    // Rebuild the client whenever the active site's URL or key changes. The
    // comparison uses the normalized URL (the client stores it stripped of
    // trailing slashes), and init state lives on the client itself, so a new
    // site always gets a fresh, separately-initialized connection.
    if (
      !clientRef.current ||
      clientRef.current.url !== normalizeUrl(siteUrl) ||
      clientRef.current['apiKey'] !== apiKey
    ) {
      clientRef.current = new McpClient(siteUrl, apiKey);
    }
    return clientRef.current;
  }, [siteUrl, apiKey]);

  const ensureInitialized = useCallback(async (): Promise<void> => {
    const client = getClient();
    if (!client) return;
    await client.ensureInitialized();
  }, [getClient]);

  const testConnection = useCallback(async (url?: string, key?: string): Promise<boolean> => {
    const client = url && key ? new McpClient(url, key) : getClient();
    if (!client) return false;

    setStatus('connecting');
    const success = await client.testConnection();
    setStatus(success ? 'connected' : 'error');
    return success;
  }, [getClient, setStatus]);

  const callTool = useCallback(async (
    toolName: string,
    args: Record<string, unknown> = {},
    opts?: { quiet?: boolean }
  ): Promise<McpToolResult | null> => {
    const client = getClient();
    if (!client) return null;

    try {
      await ensureInitialized();
      return await client.callTool(toolName, args);
    } catch (error) {
      console.error(`Failed to call tool ${toolName}:`, error);
      // The store is the final authority on access. If it rejected this call
      // because the key's group changed, refresh ggmcAccess so the UI re-gates.
      if (isAccessDenied(error)) {
        client.whoami().then((a) => { if (a) setAccess(a); }).catch(() => {});
      } else if (!opts?.quiet) {
        // A failing *feature* call (e.g. an optional/license-gated operation the
        // plugin rejects) is not a *connection* failure — callers can pass
        // { quiet: true } to surface the error locally without flipping the
        // whole app to "Connection Error".
        setStatus('error');
      }
      return null;
    }
  }, [getClient, setStatus, setAccess, ensureInitialized]);

  const readResource = useCallback(async (
    uri: string,
    opts?: { quiet?: boolean }
  ): Promise<McpToolResult | null> => {
    const client = getClient();
    if (!client) return null;

    try {
      await ensureInitialized();
      return await client.readResource(uri);
    } catch (error) {
      console.error(`Failed to read resource ${uri}:`, error);
      // A single failing resource (e.g. a server-side 500 on one endpoint) is
      // not a connection failure — callers can pass { quiet: true } to handle
      // it locally instead of marking the whole app disconnected.
      if (!opts?.quiet) setStatus('error');
      return null;
    }
  }, [getClient, setStatus, ensureInitialized]);

  return {
    testConnection,
    callTool,
    readResource,
    ensureInitialized,
  };
}
