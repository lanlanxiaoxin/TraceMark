import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  highlighted?: boolean
}

function displayTitle(log: ActivityLog): string {
  if (log.parsed_file && log.parsed_project) {
    return `${log.parsed_file} · ${log.parsed_project}`
  }
  if (log.parsed_file) return log.parsed_file
  if (log.parsed_project) return log.parsed_project
  return log.sanitized_title || log.window_title || ''
}

export function TimelineItem({ log, onDeleted, highlighted }: TimelineItemProps): JSX.Element {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(() => highlighted === true)
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

  useEffect(() => {
    if (highlighted) setExpanded(true)
  }, [highlighted])

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
    <div
      className={`border-b border-gray-100 last:border-0 ${
        highlighted
          ? 'border-l-4 border-l-indigo-500 bg-indigo-50/90 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]'
          : ''
      } ${!highlighted && isImportant ? 'bg-amber-50/50' : ''}`}
    >
      {highlighted ? (
        <p className="px-4 pt-2 text-[11px] font-medium text-indigo-700">{t('timeline.linkedActivity')}</p>
      ) : null}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          highlighted ? 'hover:bg-indigo-50' : 'hover:bg-gray-50/80'
        }`}
        aria-expanded={expanded}
      >
        <span className="text-xs text-gray-400 tabular-nums w-12 shrink-0">
          {formatTime(log.started_at)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${categoryColor}`}>
          {categoryLabel}
        </span>
        <span className="text-sm text-gray-900 truncate flex-1">
          {displayTitle(log) || t('timeline.noWindowTitle')}
        </span>
        <span className="text-xs text-gray-500 tabular-nums shrink-0">{duration}</span>

        <button
          type="button"
          onClick={handleToggleImportant}
          className={`shrink-0 p-1 rounded transition-colors ${
            isImportant ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-400'
          }`}
          aria-label={isImportant ? t('timeline.unmarkImportant') : t('timeline.markImportant')}
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
            {t('timeline.processLabel')}: <span className="font-mono">{log.process_name}</span>
          </p>
          {log.sanitized_title && (
            <p className="text-xs text-gray-500 break-all">
              {t('timeline.windowLabel')}: {log.sanitized_title}
            </p>
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
              {t('timeline.note')}
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
              {confirmDelete ? t('common.confirmDelete') : t('common.delete')}
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
                placeholder={t('timeline.notePlaceholder')}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNote ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={handleCancelNote}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                {t('common.cancel')}
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
