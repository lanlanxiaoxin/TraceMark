import { useState } from 'react'
import { ChevronDown, ChevronRight, Star, Trash2, MessageSquarePlus, MessageSquare } from 'lucide-react'
import type { ActivityLog } from '@/lib/activityLogs'
import {
  formatTime,
  formatDuration,
  markActivityImportant,
  addActivityNote,
  softDeleteActivity
} from '@/lib/activityLogs'
import { getCategoryLabel, getCategoryColor } from '@/lib/categoryLabels'

interface TimelineItemProps {
  log: ActivityLog
  onDeleted?: (id: number) => void
}

function displayTitle(log: ActivityLog): string {
  if (log.parsed_file && log.parsed_project) {
    return `${log.parsed_file} · ${log.parsed_project}`
  }
  if (log.parsed_file) return log.parsed_file
  if (log.parsed_project) return log.parsed_project
  return log.sanitized_title || log.window_title || '（无窗口标题）'
}

export function TimelineItem({ log, onDeleted }: TimelineItemProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [isImportant, setIsImportant] = useState(log.is_important === 1)
  const [note, setNote] = useState(log.user_note || '')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteDraft, setNoteDraft] = useState(log.user_note || '')
  const [savingNote, setSavingNote] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const duration = formatDuration(log.started_at, log.ended_at)
  const categoryLabel = getCategoryLabel(log.category)
  const categoryColor = getCategoryColor(log.category)

  if (deleted) return <></>

  const handleToggleImportant = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const next = !isImportant
    setIsImportant(next)
    await markActivityImportant(log.id, next)
  }

  const handleStartNote = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setShowNoteInput(true)
    setNoteDraft(note)
  }

  const handleSaveNote = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (noteDraft === note) { setShowNoteInput(false); return }
    setSavingNote(true)
    setNote(noteDraft)
    await addActivityNote(log.id, noteDraft)
    setSavingNote(false)
    setShowNoteInput(false)
  }

  const handleCancelNote = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setShowNoteInput(false)
    setNoteDraft(note)
  }

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    await softDeleteActivity(log.id)
    setDeleted(true)
    onDeleted?.(log.id)
  }

  return (
    <div className={`border-b border-gray-100 last:border-0 ${isImportant ? 'bg-amber-50/50' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50/80 transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0">
          {formatTime(log.started_at)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${categoryColor}`}>
          {categoryLabel}
        </span>
        <span className="text-sm text-gray-900 truncate flex-1">{displayTitle(log)}</span>
        <span className="text-xs text-gray-500 tabular-nums shrink-0">{duration}</span>

        <button
          type="button"
          onClick={handleToggleImportant}
          className={`shrink-0 p-1 rounded transition-colors ${
            isImportant ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'
          }`}
          aria-label={isImportant ? '取消标记重要' : '标记重要'}
        >
          <Star className={`w-4 h-4 ${isImportant ? 'fill-current' : ''}`} />
        </button>

        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-[4.5rem] space-y-2">
          <p className="text-xs text-gray-500">
            进程: <span className="font-mono">{log.process_name}</span>
          </p>
          {log.sanitized_title && (
            <p className="text-xs text-gray-500 break-all">窗口: {log.sanitized_title}</p>
          )}
          {log.executable_path && (
            <p className="text-xs text-gray-400 break-all font-mono">{log.executable_path}</p>
          )}
          <p className="text-xs text-gray-400">
            {formatTime(log.started_at)} – {formatTime(log.ended_at)}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleStartNote}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border transition-colors ${
                note
                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <MessageSquarePlus className="w-3 h-3" />
              备注
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border transition-colors ${
                confirmDelete
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              {confirmDelete ? '确认删除？' : '删除'}
            </button>
          </div>

          {showNoteInput && (
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveNote(e as unknown as React.MouseEvent)
                  if (e.key === 'Escape') handleCancelNote(e as unknown as React.MouseEvent)
                }}
                placeholder="添加备注..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNote ? '保存...' : '保存'}
              </button>
              <button
                type="button"
                onClick={handleCancelNote}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          )}

          {note && !showNoteInput && (
            <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span>{note}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
