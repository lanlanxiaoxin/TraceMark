import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AppPage } from '@/components/AppShell'
import type { ProjectsIntent } from '@/pages/Projects'
import { listProjectSpaces } from '@/lib/projectSpaces'
import { listWorkAssets } from '@/lib/workAssets'
import type { ProjectSpace, WorkAsset } from '@/env'

interface Candidate {
  id: string
  primary: string
  secondary?: string
  run: () => void
}

interface CommandPaletteProps {
  onNavigate: (page: AppPage, intent?: ProjectsIntent) => void
}

const NAV: Array<{
  id: string
  page: AppPage
  primary: string
  secondary: string
}> = [
  { id: 'n-today', page: 'today', primary: '今日', secondary: '工作资产收件箱' },
  { id: 'n-projects', page: 'projects', primary: '项目', secondary: '项目空间与资产库' },
  { id: 'n-timeline', page: 'timeline', primary: '时间轴', secondary: '原始活动' },
  { id: 'n-reports', page: 'reports', primary: '报告', secondary: '日报 / 周报' },
  { id: 'n-settings', page: 'settings', primary: '设置', secondary: '监听与 AI' }
]

export function CommandPalette({ onNavigate }: CommandPaletteProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [projects, setProjects] = useState<ProjectSpace[]>([])
  const [assets, setAssets] = useState<WorkAsset[]>([])
  const [active, setActive] = useState(0)

  const close = useCallback((): void => {
    setOpen(false)
    setQ('')
    setAssets([])
    setActive(0)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    void listProjectSpaces().then(setProjects)
  }, [open])

  useEffect(() => {
    if (!open) return
    const s = q.trim()
    if (s.length < 1) {
      setAssets([])
      return
    }
    const t = window.setTimeout(() => {
      void listWorkAssets({ search: s, limit: 14 }).then(setAssets)
    }, 180)
    return () => window.clearTimeout(t)
  }, [q, open])

  const candidates = useMemo((): Candidate[] => {
    const ql = q.trim().toLowerCase()
    const match = (s: string): boolean => !ql || s.toLowerCase().includes(ql)
    const out: Candidate[] = []

    for (const n of NAV) {
      if (match(n.primary) || match(n.secondary)) {
        out.push({
          id: n.id,
          primary: n.primary,
          secondary: n.secondary,
          run: () => {
            onNavigate(n.page)
            close()
          }
        })
      }
    }

    for (const p of projects) {
      if (match(p.name)) {
        out.push({
          id: `p-${p.id}`,
          primary: `项目：${p.name}`,
          secondary: '打开项目空间',
          run: () => {
            onNavigate('projects', { tab: 'spaces', projectId: p.id })
            close()
          }
        })
      }
    }

    for (const a of assets) {
      out.push({
        id: `a-${a.id}`,
        primary: a.title,
        secondary: `${a.status} · 工作资产`,
        run: () => {
          onNavigate('projects', {
            tab: 'library',
            projectId: a.projectId ?? undefined
          })
          close()
        }
      })
    }

    return out
  }, [q, projects, assets, onNavigate, close])

  useEffect(() => {
    setActive(0)
  }, [q, candidates.length])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive(i => Math.min(i + 1, Math.max(0, candidates.length - 1)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive(i => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && candidates[active]) {
        e.preventDefault()
        candidates[active].run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, candidates, active, close])

  if (!open) return <></>

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      onClick={e => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
          <input
            data-command-palette-input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="跳转页面、搜索项目或资产…"
            className="flex-1 min-w-0 py-2 text-sm outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
            Esc 关闭
          </kbd>
        </div>
        <ul className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
          {candidates.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">无匹配项</li>
          ) : (
            candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => c.run()}
                  className={`w-full text-left px-4 py-2.5 text-sm flex flex-col gap-0.5 ${
                    i === active ? 'bg-indigo-50 text-indigo-950' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <span className="font-medium">{c.primary}</span>
                  {c.secondary ? (
                    <span className="text-xs text-gray-500">{c.secondary}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="text-[10px] text-gray-400 px-4 py-2 border-t border-gray-100 bg-gray-50/80">
          Ctrl+K / ⌘K 打开 · 方向键选择 · Enter 确认
        </p>
      </div>
    </div>
  )
}
