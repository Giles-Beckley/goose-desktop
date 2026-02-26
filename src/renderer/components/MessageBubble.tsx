import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../stores/aiChatStore';

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <div className={`bg-white border rounded-2xl rounded-bl-md px-4 py-3 ${
          message.error ? 'border-red-300' : 'border-gray-200'
        }`}>
          {message.isLoading ? (
            <LoadingDots />
          ) : (
            <div className="text-sm text-gray-800 prose prose-sm max-w-none prose-table:text-sm prose-td:px-3 prose-td:py-1 prose-th:px-3 prose-th:py-1">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full text-sm border-collapse border border-gray-200 rounded">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-100">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-medium border border-gray-200">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border border-gray-200">
                      {children}
                    </td>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                      return <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
                    }
                    return (
                      <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto my-3">
                        <code className="text-sm font-mono">{children}</code>
                      </pre>
                    );
                  },
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
                  ),
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!message.isLoading && (message.model || message.tier) && (
          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-[10px] text-gray-400">
              {message.model && formatModel(message.model)}
              {message.tier && (
                <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-medium text-gray-500">
                  {message.tier}
                </span>
              )}
              {message.usage && ` · ${message.usage.input_tokens + message.usage.output_tokens} tokens`}
            </span>
          </div>
        )}

        {message.error && !message.isLoading && (
          <div className="mt-1 px-1">
            <span className="text-[10px] text-red-400">Error occurred</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function formatModel(model: string): string {
  if (model.includes('sonnet')) return 'Sonnet 4.5';
  if (model.includes('opus')) return 'Opus 4.6';
  if (model.includes('haiku')) return 'Haiku 4.5';
  return model;
}
