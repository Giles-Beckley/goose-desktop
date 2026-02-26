import { useState } from 'react';
import { ChatPanel } from './ChatPanel';

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Slide-out panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/10 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col">
            <ChatPanel showHeader onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}

      {/* FAB button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-30 w-12 h-12 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all flex items-center justify-center"
          title="AI Assistant"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </button>
      )}
    </>
  );
}
