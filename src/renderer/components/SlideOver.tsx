import { useEffect, useRef } from 'react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}

export function SlideOver({ open, onClose, title, children, wide }: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative bg-white shadow-xl flex flex-col ${wide ? 'w-[600px]' : 'w-[440px]'} max-w-full animate-slide-in`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-goose-border">
          <h2 className="text-lg font-display font-semibold text-goose-text">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-goose-text-light hover:text-goose-text hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
