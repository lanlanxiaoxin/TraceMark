import type { EvidenceItem } from '@/env'

interface EvidenceListProps {
  evidence: EvidenceItem[]
}

export function EvidenceList({ evidence }: EvidenceListProps): JSX.Element {
  if (evidence.length === 0) {
    return <p className="text-xs text-gray-500">暂无证据链</p>
  }

  return (
    <ul className="space-y-2">
      {evidence.map((item, i) => (
        <li
          key={`${item.type}-${item.activityLogId ?? i}`}
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0 items-start text-xs text-gray-600"
        >
          <span
            className="shrink-0 uppercase text-gray-400 font-medium tracking-wide whitespace-nowrap"
            title={item.type}
          >
            {item.type}
          </span>
          <span className="min-w-0 break-words text-gray-700">{item.summary}</span>
        </li>
      ))}
    </ul>
  )
}
