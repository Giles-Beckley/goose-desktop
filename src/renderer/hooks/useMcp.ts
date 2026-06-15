import { useCallback, useRef } from 'react';
import { McpClient } from '../services/mcpClient';
import { useConnectionStore } from '../stores/connectionStore';
import { isAccessDenied } from '../../shared/access';
import type { McpToolResult } from '../../shared/types';

let initialized = false;
let initPromise: Promise<void> | null = null;

export function useMcp() {
  const { siteUrl, apiKey, setStatus, setAccess } = useConnectionStore();
  const clientRef = useRef<McpClient | null>(null);

  const getClient = useCallback((): McpClient | null => {
    if (!siteUrl || !apiKey) return null;

    if (!clientRef.current || clientRef.current['siteUrl'] !== siteUrl) {
      clientRef.current = new McpClient(siteUrl, apiKey);
      initialized = false;
      initPromise = null;
    }
    return clientRef.current;
  }, [siteUrl, apiKey]);

  const ensureInitialized = useCallback(async (): Promise<void> => {
    const client = getClient();
    if (!client) return;

    if (initialized) return;

    if (!initPromise) {
      initPromise = (async () => {
        try {
          await client.initialize();
          initialized = true;
        } catch (error) {
          console.error('Failed to initialize MCP:', error);
          initPromise = null;
        }
      })();
    }

    await initPromise;
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
    args: Record<string, unknown> = {}
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
      } else {
        setStatus('error');
      }
      return null;
    }
  }, [getClient, setStatus, setAccess, ensureInitialized]);

  const readResource = useCallback(async (
    uri: string
  ): Promise<McpToolResult | null> => {
    const client = getClient();
    if (!client) return null;

    try {
      await ensureInitialized();
      return await client.readResource(uri);
    } catch (error) {
      console.error(`Failed to read resource ${uri}:`, error);
      setStatus('error');
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
