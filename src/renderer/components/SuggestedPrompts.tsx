const SUGGESTIONS = [
  'What are my best selling products?',
  'How many orders came in today?',
  'Show me products that are low on stock',
  "What's my revenue this month?",
  "Which products haven't sold in 30 days?",
  'Show me my top 10 customers by spend',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-2xl mb-4">
        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Assistant</h3>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
        Ask questions about your store or give instructions in plain English.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
