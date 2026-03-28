export function TitleBar() {
  return (
    <div
      className="h-8 flex items-center justify-between select-none shrink-0"
      style={{ backgroundColor: '#1E293B', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="pl-2.5 flex items-center">
        <img src="icon.png" alt="" className="w-4 h-4" draggable={false} />
      </div>

      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => window.electronAPI.window.minimize()}
          className="h-full px-3 flex items-center hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <svg className="w-3 h-3 text-white/70" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.maximize()}
          className="h-full px-3 flex items-center hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          <svg className="w-3 h-3 text-white/70" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.window.close()}
          className="h-full px-3 flex items-center hover:bg-red-500 transition-colors"
          title="Close"
        >
          <svg className="w-3 h-3 text-white/70" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
