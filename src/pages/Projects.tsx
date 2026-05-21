import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { ProjectSpace, WorkAsset } from '@/env'
import {
  createProjectSpace,
  deleteProjectSpace,
  listProjectSpaces,
  updateProjectSpace
} from '@/lib/projectSpaces'
import { ProjectSpaceForm, saveProjectAliases } from '@/components/ProjectSpaceForm'
import { countWorkAssetsByProject, listWorkAssets, dayBounds } from '@/lib/workAssets'
import { EvidenceList } from '@/components/EvidenceList'
import { AssetLibrary } from '@/pages/AssetLibrary'
import { Retrospectives } from '@/pages/Retrospectives'

export type ProjectView = 'spaces' | 'library' | 'retro'

export interface ProjectsIntent {
  tab?: ProjectView
  projectId?: number | null
  /** ? tab === 'retro' ????????????? */
  retroWeekStartMs?: number
  /** ? tab === 'retro' ???????????????? */
  retroPhaseStart?: number
  retroPhaseEnd?: number
  /** ? tab === 'retro' ?????????? */
  retroType?: 'weekly' | 'project_phase'
}

export interface ReportJumpRequest {
  type: 'daily' | 'weekly'
  dateMs: number
}

interface ProjectsProps {
  intent?: ProjectsIntent
  onIntentConsumed?: () => void
  onOpenReports?: (intent: ReportJumpRequest) => void
}

interface FormSaveData {
  name: string
  privacyAlias?: string
  description?: string
  roleTemplate?: ProjectSpace['roleTemplate']
  gitPath: string
  browserKeywords: string
  documentKeywords: string
  documentDirs: string
  meetingKeywords: string
  chatKeywords: string
  nameAliases: string
}

const VIEW_TABS: { id: ProjectView; label: string }[] = [
  { id: 'spaces', label: '项目空间' },
  { id: 'library', label: '资产库' },
  { id: 'retro', label: '复盘' }
]

export function Projects({ intent, onIntentConsumed, onOpenReports }: ProjectsProps): JSX.Element {
  const [view, setView] = useState<ProjectView>(intent?.tab ?? 'spaces')
  const [spaces, setSpaces] = useState<ProjectSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ProjectSpace | 'new' | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [confirmedAssets, setConfirmedAssets] = useState<WorkAsset[]>([])
  const [retroPrefill, setRetroPrefill] = useState<{
    type?: 'weekly' | 'project_phase'
    weekStartMs?: number
    phaseStart?: number
    phaseEnd?: number
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSpaces(await listProjectSpaces())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!intent) return
    if (intent.tab) setView(intent.tab)
    if (intent.projectId !== undefined) setSelectedId(intent.projectId)
    if (
      intent.retroType ||
      intent.retroWeekStartMs !== undefined ||
      intent.retroPhaseStart !== undefined ||
      intent.retroPhaseEnd !== undefined
    ) {
      setRetroPrefill({
        type: intent.retroType,
        weekStartMs: intent.retroWeekStartMs,
        phaseStart: intent.retroPhaseStart,
        phaseEnd: intent.retroPhaseEnd
      })
    }
    if (
      intent.tab ||
      intent.projectId !== undefined ||
      intent.retroType ||
      intent.retroWeekStartMs !== undefined ||
      intent.retroPhaseStart !== undefined ||
      intent.retroPhaseEnd !== undefined
    ) {
      onIntentConsumed?.()
    }
  }, [intent, onIntentConsumed])

  useEffect(() => {
    if (selectedId == null) {
      setConfirmedAssets([])
      return
    }
    const { start, end } = dayBounds(Date.now())
    void listWorkAssets({
      projectId: selectedId,
      status: 'confirmed',
      dateStart: start - 30 * 24 * 60 * 60 * 1000,
      dateEnd: end,
      limit: 20
    }).then(setConfirmedAssets)
  }, [selectedId])

  const handleSave = async (data: FormSaveData): Promise<void> => {
    if (editing === 'new') {
      const created = await createProjectSpace({
        name: data.name,
        privacyAlias: data.privacyAlias,
        description: data.description,
        roleTemplate: data.roleTemplate ?? undefined
      })
      await saveProjectAliases(created.id, data)
    } else if (editing) {
      await updateProjectSpace(editing.id, {
        name: data.name,
        privacyAlias: data.privacyAlias ?? null,
        description: data.description ?? null,
        roleTemplate: data.roleTemplate ?? null
      })
      await saveProjectAliases(editing.id, data)
    }
    setEditing(null)
    await load()
  }

  const handleDelete = async (id: number): Promise<void> => {
    const assetCount = await countWorkAssetsByProject(id)
    const msg =
      assetCount > 0
        ? `确定删除此项目空间？将同时删除关联的 ${assetCount} 条工作资产、复盘与摘要记录。`
        : '确定删除此项目空间？'
    if (!confirm(msg)) return
    await deleteProjectSpace(id)
    if (selectedId === id) setSelectedId(null)
    await load()
  }

  if (editing) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {editing === 'new' ? '新建项目空间' : '编辑项目空间'}
        </h1>
        <ProjectSpaceForm
          space={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">项目</h1>
          <p className="text-sm text-gray-500 mt-1">项目空间、资产库与复盘</p>
        </div>
        {view === 'spaces' && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white shrink-0"
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-gray-100" role="tablist" aria-label="项目子页面">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
              view === tab.id ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'library' && <AssetLibrary initialProjectId={selectedId} />}
      {view === 'retro' && (
        <Retrospectives
          initialProjectId={selectedId}
          initialType={retroPrefill?.type}
          initialWeekStartMs={retroPrefill?.weekStartMs}
          initialPhaseStart={retroPrefill?.phaseStart}
          initialPhaseEnd={retroPrefill?.phaseEnd}
          onPrefillConsumed={() => setRetroPrefill(null)}
          onOpenReports={onOpenReports}
        />
      )}

      {view === 'spaces' && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-600 mb-4">还没有项目空间</p>
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                创建第一个项目
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {spaces.map(space => (
                <li
                  key={space.id}
                  className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                    selectedId === space.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setSelectedId(space.id === selectedId ? null : space.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-medium text-gray-900">{space.name}</h2>
                      {space.privacyAlias && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          隐私别名：{space.privacyAlias}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditing(space)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                        aria-label="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(space.id)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                        aria-label="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedId != null && confirmedAssets.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">近期已确认资产</h2>
              {confirmedAssets.map(asset => (
                <article key={asset.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-medium text-gray-900">{asset.title}</h3>
                  <EvidenceList evidence={asset.evidence} />
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}