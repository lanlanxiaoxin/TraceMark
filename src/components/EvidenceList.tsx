import { useTranslation } from 'react-i18next'
import type { EvidenceItem } from '@/env'
import { getDateLocaleTag } from '@/i18n'

interface EvidenceListProps {
  evidence: EvidenceItem[]
}

const META_KEYS = [
  'commitHash',
  'commitMessage',
  'file',
  'project',
  'windowTitle',
  'changedFiles',
  'processName',
  'filesChanged',
  'insertions',
  'deletions'
] as const

function formatEvidenceTime(startedAt?: number, endedAt?: number): string | null {
  if (startedAt == null) return null
  const locale = getDateLocaleTag()
  const start = new Date(startedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
  if (endedAt == null || endedAt === startedAt) return start
  const end = new Date(endedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${start} – ${end}`
}

export function EvidenceList({ evidence }: EvidenceListProps): JSX.Element {
  const { t } = useTranslation()

  const metaLabel = (key: string): string => {
    const map: Record<string, string> = {
      processName: t('evidence.processName'),
      file: t('evidence.file'),
      project: t('evidence.project'),
      windowTitle: t('evidence.windowTitle'),
      filesChanged: t('evidence.filesChanged'),
      insertions: t('evidence.insertions'),
      deletions: t('evidence.deletions'),
      changedFiles: t('evidence.changedFiles'),
      commitMessage: t('evidence.commitMessage'),
      commitHash: 'Commit'
    }
    return map[key] ?? key
  }

  const metadataLines = (metadata?: Record<string, unknown>): string[] => {
    if (!metadata) return []
    const lines: string[] = []

    for (const key of META_KEYS) {
      const value = metadata[key]
      if (value == null || value === '') continue
      if (typeof value === 'string' || typeof value === 'number') {
        lines.push(`${metaLabel(key)}：${value}`)
      }
    }

    for (const [key, value] of Object.entries(metadata)) {
      if ((META_KEYS as readonly string[]).includes(key)) continue
      if (value == null || value === '') continue
      if (typeof value === 'string' || typeof value === 'number') {
        lines.push(`${metaLabel(key)}：${value}`)
      }
    }

    return lines.slice(0, 6)
  }

  if (evidence.length === 0) {
    return <p className="text-xs text-gray-500">{t('evidence.empty')}</p>
  }

  return (
    <ul className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
      {evidence.map((item, i) => {
        const timeLabel = formatEvidenceTime(item.startedAt, item.endedAt)
        const meta = metadataLines(item.metadata)
        return (
          <li
            key={`${item.type}-${item.activityLogId ?? i}`}
            className="text-xs text-gray-600 space-y-1 border-b border-gray-100 last:border-0 pb-2 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="uppercase text-gray-400 font-medium tracking-wide">{item.type}</span>
              {timeLabel ? <span className="text-gray-400 tabular-nums">{timeLabel}</span> : null}
              {item.activityLogId != null ? (
                <span className="text-gray-400">
                  {t('evidence.activityId', { id: item.activityLogId })}
                </span>
              ) : null}
            </div>
            <p className="text-gray-800 break-words">{item.summary}</p>
            {meta.length > 0 ? (
              <ul className="text-[11px] text-gray-600 space-y-0.5">
                {meta.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
