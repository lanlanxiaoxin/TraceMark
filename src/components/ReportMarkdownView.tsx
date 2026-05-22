import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3 first:mt-0 border-b border-gray-100 pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-900 mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 leading-relaxed mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1.5 mb-4 text-sm text-gray-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1.5 mb-4 text-sm text-gray-700">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="text-gray-600 not-italic">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = Boolean(className?.includes('language-'))
    if (isBlock) {
      return (
        <code className="block rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono text-gray-800 overflow-x-auto">
          {children}
        </code>
      )
    }
    return (
      <code className="px-1 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <pre className="mb-4 overflow-x-auto">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-900 border-b border-gray-200 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-700 border-b border-gray-100 align-top">{children}</td>
  ),
  hr: () => <hr className="my-6 border-gray-200" aria-hidden />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-200 bg-amber-50/50 pl-4 pr-3 py-2 text-sm text-amber-900 rounded-r-lg mb-4">
      {children}
    </blockquote>
  )
}

interface ReportMarkdownViewProps {
  content: string
}

export function ReportMarkdownView({ content }: ReportMarkdownViewProps): JSX.Element {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}
