# Goose Commerce Desktop App — Instructions for Claude Code

## Project Overview

I am building a cross-platform desktop application (Windows and Mac) for **Goose Commerce** (also known as **WP Goose** / **GGM Commerce**), a WordPress e-commerce plugin I am developing.

The desktop app will connect to a WordPress site running the Goose Commerce plugin via its existing **MCP (Model Context Protocol) server** endpoint, which is a REST/SSE-based API available at:

```
https://{site-url}/wp-json/mcp/v1/mcp?api_key={api_key}
```

The app should allow store owners to manage their store (products, orders, customers, settings) from a native desktop application without needing to be logged into the WordPress dashboard.

---

## Tech Stack

Please use the following stack:

- **Electron** — for cross-platform desktop packaging (Windows `.exe` + Mac `.dmg`)
- **React** — for the UI layer
- **TypeScript** — throughout (both main and renderer processes)
- **Vite** — as the build tool for the React renderer
- **Zustand** — for state management
- **electron-builder** — for packaging and distribution
- **electron-updater** — for auto-update support

---

## Project Scaffolding Requirements

### 1. Project Structure

Create the project with this structure:

```
goose-commerce-desktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.ts              # App entry point, window management
│   │   ├── preload.ts           # Preload script for IPC bridge
│   │   ├── ipc-handlers.ts      # IPC handler registration
│   │   └── tray.ts              # System tray integration
│   ├── renderer/                # React app (renderer process)
│   │   ├── App.tsx              # Root component with router
│   │   ├── main.tsx             # React entry point
│   │   ├── index.html           # HTML shell
│   │   ├── components/          # Shared UI components
│   │   │   ├── Layout.tsx       # App shell with sidebar navigation
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   ├── Header.tsx       # Top bar with connection status
│   │   │   └── LoadingSpinner.tsx
│   │   ├── pages/               # Route pages
│   │   │   ├── Dashboard.tsx    # Overview / stats
│   │   │   ├── Products.tsx     # Product listing and management
│   │   │   ├── Orders.tsx       # Order listing and management
│   │   │   ├── Customers.tsx    # Customer listing
│   │   │   └── Settings.tsx     # App and connection settings
│   │   ├── stores/              # Zustand stores
│   │   │   ├── connectionStore.ts   # Site URL, API key, connection status
│   │   │   ├── productsStore.ts
│   │   │   ├── ordersStore.ts
│   │   │   └── customersStore.ts
│   │   ├── services/            # API / MCP communication
│   │   │   └── mcpClient.ts     # MCP client — handles requests to the WP MCP endpoint
│   │   ├── hooks/               # Custom React hooks
│   │   │   └── useMcp.ts        # Hook for MCP operations
│   │   └── styles/
│   │       └── globals.css      # Global styles (Tailwind)
│   └── shared/                  # Types shared between main and renderer
│       └── types.ts
├── resources/                   # App icons and assets
│   └── icon.png
├── electron-builder.yml         # Build/packaging config
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

### 2. Main Process (`src/main/`)

- Create the main BrowserWindow with sensible defaults (1200x800, min 900x600)
- Use a **preload script** that exposes a safe IPC bridge to the renderer via `contextBridge`
- The IPC bridge should expose methods for:
  - Storing and retrieving connection credentials securely using Electron's `safeStorage` API
  - Making MCP requests (proxied through the main process for security)
  - Sending native notifications (e.g., new order received)
- Set up a **system tray** icon with a context menu (Show/Hide window, Quit)
- Enable `nodeIntegration: false` and `contextIsolation: true` for security

### 3. MCP Client (`src/renderer/services/mcpClient.ts`)

This is the core communication layer. The MCP endpoint on the WordPress site accepts JSON-RPC style requests. Create a client class that:

- Takes a site URL and API key as configuration
- Has methods for common operations:
  - `listTools()` — discover available MCP tools on the server
  - `callTool(toolName: string, args: object)` — invoke an MCP tool
  - `testConnection()` — verify the connection is working
- Handles errors gracefully (network errors, auth failures, timeouts)
- Includes a connection status state (connected / disconnected / error)

The MCP endpoint URL pattern is:
```
POST https://{siteUrl}/wp-json/mcp/v1/mcp?api_key={apiKey}
```

The request body follows the MCP protocol format. For now, stub the actual MCP message format — we will refine it once we test against the live endpoint.

### 4. Onboarding / First Launch Flow

On first launch (no saved credentials), show a **setup screen** where the user enters:

- **Site URL** — their WordPress site address (e.g., `https://mystore.com`)
- **API Key** — the MCP API key from the Goose Commerce plugin settings

Include a "Test Connection" button that calls the MCP endpoint to verify the credentials work before saving them.

Store credentials securely using Electron's `safeStorage` (OS keychain).

### 5. UI / Design

- Use **Tailwind CSS** for styling
- Clean, minimal design with a **sidebar navigation** layout
- Sidebar items: Dashboard, Products, Orders, Customers, Settings
- Use **react-router-dom** for page routing
- Header bar showing: connection status indicator (green dot = connected), site URL, and a refresh button
- The Dashboard page should be a placeholder with cards for: Total Products, Total Orders, Recent Orders list
- All other pages should be placeholder layouts ready for data

### 6. Packaging Configuration

Set up `electron-builder.yml` for:

- **Windows**: NSIS installer (`.exe`)
- **Mac**: DMG (`.dmg`)
- App name: "Goose Commerce"
- App ID: `com.wpgoose.desktop`
- Include `electron-updater` configuration pointing to a GitHub releases URL (we can change this later)

### 7. Package Scripts

In `package.json`, include scripts for:

- `dev` — run in development mode with hot reload
- `build` — build the React app and Electron
- `package:win` — package for Windows
- `package:mac` — package for Mac
- `package:all` — package for both platforms

---

## Security Considerations

- **Never store API keys in plain text** — use Electron `safeStorage`
- **Context isolation must be enabled** — no direct Node.js access from the renderer
- **All MCP communication should be proxied through the main process** via IPC, not directly from the renderer
- **Validate all data received from the MCP endpoint** before rendering

---

## What NOT to Do

- Do not use `nodeIntegration: true`
- Do not use localStorage for credentials
- Do not make HTTP requests directly from the renderer process
- Do not use class components — use functional components with hooks throughout
- Do not add unnecessary dependencies — keep it lean

---

## Getting Started

Please:

1. Initialise the project with `npm init`
2. Install all required dependencies
3. Set up the full project structure as described above
4. Implement the main process with preload and IPC bridge
5. Implement the React app with routing, layout, and placeholder pages
6. Implement the MCP client service
7. Implement the onboarding/setup flow
8. Set up Tailwind CSS
9. Set up electron-builder configuration
10. Make sure the app runs in dev mode with `npm run dev`

After scaffolding, give me a summary of what was created and any next steps.
