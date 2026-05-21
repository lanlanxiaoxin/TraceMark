import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { ProjectAliasType, ProjectRoleTemplate, ProjectSpace } from '@/env'
import { listProjectAliases, replaceProjectAliases } from '@/lib/projectSpaces'
import { pickDirectory } from '@/lib/dialog'
import { PrivacyConsentPanel } from '@/components/PrivacyConsentPanel'

interface ProjectSpaceFormProps {
  space?: ProjectSpace | null
  onSave: (data: {
    name: string
    privacyAlias?: string
    description?: string
    roleTemplate?: ProjectRoleTemplate
    gitPath: string
    browserKeywords: string
    documentKeywords: string
    documentDirs: string
    meetingKeywords: string
    chatKeywords: string
    nameAliases: string
  }) => Promise<void>
  onCancel: () => void
}

export function ProjectSpaceForm({ space, onSave, onCancel }: ProjectSpaceFormProps): JSX.Element {
  const [name, setName] = useState(space?.name ?? '')
  const [privacyAlias, setPrivacyAlias] = useState(space?.privacyAlias ?? '')
  const [description, setDescription] = useState(space?.description ?? '')
  const [roleTemplate, setRoleTemplate] = useState<ProjectRoleTemplate>(
    space?.roleTemplate ?? 'developer'
  )
  const [gitPath, setGitPath] = useState('')
  const [browserKeywords, setBrowserKeywords] = useState('')
  const [documentKeywords, setDocumentKeywords] = useState('')
  const [documentDirs, setDocumentDirs] = useState('')
  const [meetingKeywords, setMeetingKeywords] = useState('')
  const [chatKeywords, setChatKeywords] = useState('')
  const [nameAliases, setNameAliases] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!space)

  useEffect(() => {
    if (!space) {
      setLoading(false)
      return
    }
    listProjectAliases(space.id).then(aliases => {
      setGitPath(aliases.find(a => a.aliasType === 'repo')?.value ?? '')
      setBrowserKeywords(
        aliases.filter(a => a.aliasType === 'browser').map(a => a.value).join(', ')
      )
      const docAliases = aliases.filter(a => a.aliasType === 'document')
      setDocumentKeywords(
        docAliases.filter(a => !looksLikeDirectoryHint(a.value)).map(a => a.value).join(', ')
      )
      setDocumentDirs(
        docAliases.filter(a => looksLikeDirectoryHint(a.value)).map(a => a.value).join(', ')
      )
      setMeetingKeywords(
        aliases.filter(a => a.aliasType === 'meeting').map(a => a.value).join(', ')
      )
      setChatKeywords(aliases.filter(a => a.aliasType === 'chat').map(a => a.value).join(', '))
      setNameAliases(aliases.filter(a => a.aliasType === 'name').map(a => a.value).join(', '))
    }).finally(() => setLoading(false))
  }, [space])

  const browseGitPath = async (): Promise<void> => {
    const picked = await pickDirectory({
      title: '选择 Git 仓库所在文件夹',
      defaultPath: gitPath.trim() || undefined
    })
    if (typeof picked === 'string') setGitPath(picked)
  }

  const browseDocumentDirs = async (): Promise<void> => {
    const first = splitCommaPaths(documentDirs)[0]
    const picked = await pickDirectory({
      title: '选择绑定文档目录（可多选）',
      defaultPath: first || undefined,
      multiple: true
    })
    if (Array.isArray(picked) && picked.length > 0) {
      setDocumentDirs(mergeCommaPaths(documentDirs, picked))
    } else if (typeof picked === 'string') {
      setDocumentDirs(mergeCommaPaths(documentDirs, [picked]))
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        privacyAlias: privacyAlias.trim() || undefined,
        description: description.trim() || undefined,
        roleTemplate,
        gitPath: gitPath.trim(),
        browserKeywords: browserKeywords.trim(),
        documentKeywords: documentKeywords.trim(),
        documentDirs: documentDirs.trim(),
        meetingKeywords: meetingKeywords.trim(),
        chatKeywords: chatKeywords.trim(),
        nameAliases: nameAliases.trim()
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 p-4">加载中...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ps-name" className="block text-sm font-medium text-gray-700 mb-1">
          项目名称
        </label>
        <input
          id="ps-name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-privacy" className="block text-sm font-medium text-gray-700 mb-1">
          隐私别名（上传 AI 时使用）
        </label>
        <input
          id="ps-privacy"
          value={privacyAlias}
          onChange={e => setPrivacyAlias(e.target.value)}
          placeholder="例如 Project_A"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-role" className="block text-sm font-medium text-gray-700 mb-1">
          角色模板
        </label>
        <select
          id="ps-role"
          value={roleTemplate}
          onChange={e => setRoleTemplate(e.target.value as ProjectRoleTemplate)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="developer">程序员</option>
          <option value="pm">产品经理</option>
          <option value="implementation">实施工程师</option>
          <option value="office">泛办公</option>
        </select>
      </div>

      <div>
        <label htmlFor="ps-git" className="block text-sm font-medium text-gray-700 mb-1">
          Git 仓库路径
        </label>
        <div className="flex gap-2">
          <input
            id="ps-git"
            value={gitPath}
            onChange={e => setGitPath(e.target.value)}
            placeholder="D:\workspace\my-project"
            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => void browseGitPath()}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            aria-label="浏览选择 Git 仓库文件夹"
          >
            <FolderOpen className="w-4 h-4" />
            浏览
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="ps-names" className="block text-sm font-medium text-gray-700 mb-1">
          项目别名（逗号分隔）
        </label>
        <input
          id="ps-names"
          value={nameAliases}
          onChange={e => setNameAliases(e.target.value)}
          placeholder="traceMark, workflow-ai"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-browser" className="block text-sm font-medium text-gray-700 mb-1">
          浏览器关键词（逗号分隔）
        </label>
        <input
          id="ps-browser"
          value={browserKeywords}
          onChange={e => setBrowserKeywords(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-doc" className="block text-sm font-medium text-gray-700 mb-1">
          文档关键词（逗号分隔）
        </label>
        <input
          id="ps-doc"
          value={documentKeywords}
          onChange={e => setDocumentKeywords(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-doc-dir" className="block text-sm font-medium text-gray-700 mb-1">
          绑定文档目录（L3，逗号分隔绝对路径）
        </label>
        <div className="flex gap-2">
          <input
            id="ps-doc-dir"
            value={documentDirs}
            onChange={e => setDocumentDirs(e.target.value)}
            placeholder="D:\projects\foo\docs"
            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => void browseDocumentDirs()}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            aria-label="浏览选择文档目录"
          >
            <FolderOpen className="w-4 h-4" />
            浏览
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          可多次浏览追加多个目录；仅在开启该项目 L3 授权后扫描目录片段，不上传全文。
        </p>
      </div>

      <div>
        <label htmlFor="ps-meeting" className="block text-sm font-medium text-gray-700 mb-1">
          会议关键词（逗号分隔）
        </label>
        <input
          id="ps-meeting"
          value={meetingKeywords}
          onChange={e => setMeetingKeywords(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-chat" className="block text-sm font-medium text-gray-700 mb-1">
          聊天关键词（逗号分隔）
        </label>
        <input
          id="ps-chat"
          value={chatKeywords}
          onChange={e => setChatKeywords(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-desc" className="block text-sm font-medium text-gray-700 mb-1">
          描述
        </label>
        <textarea
          id="ps-desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {space?.id != null && (
        <PrivacyConsentPanel scopeType="project" projectId={space.id} compact />
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600"
        >
          取消
        </button>
      </div>
    </form>
  )
}

function splitCommaPaths(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map(v => v.trim())
    .filter(Boolean)
}

function mergeCommaPaths(current: string, add: string[]): string {
  const merged = [...splitCommaPaths(current)]
  for (const p of add) {
    if (!merged.includes(p)) merged.push(p)
  }
  return merged.join(', ')
}

function looksLikeDirectoryHint(value: string): boolean {
  const v = value.trim()
  return /^[A-Za-z]:[\\/]/.test(v) || v.startsWith('/') || v.startsWith('\\\\')
}

export function buildAliasesFromForm(data: {
  gitPath: string
  browserKeywords: string
  documentKeywords: string
  documentDirs: string
  meetingKeywords: string
  chatKeywords: string
  nameAliases: string
}): Array<{ aliasType: ProjectAliasType; value: string }> {
  const split = (s: string): string[] =>
    s.split(/[,，]/).map(v => v.trim()).filter(Boolean)

  const aliases: Array<{ aliasType: ProjectAliasType; value: string }> = []
  if (data.gitPath) aliases.push({ aliasType: 'repo', value: data.gitPath })
  for (const v of split(data.nameAliases)) aliases.push({ aliasType: 'name', value: v })
  for (const v of split(data.browserKeywords)) aliases.push({ aliasType: 'browser', value: v })
  for (const v of split(data.documentKeywords)) aliases.push({ aliasType: 'document', value: v })
  for (const v of split(data.documentDirs)) aliases.push({ aliasType: 'document', value: v })
  for (const v of split(data.meetingKeywords)) aliases.push({ aliasType: 'meeting', value: v })
  for (const v of split(data.chatKeywords)) aliases.push({ aliasType: 'chat', value: v })
  return aliases
}

export async function saveProjectAliases(
  projectId: number,
  data: {
    gitPath: string
    browserKeywords: string
    documentKeywords: string
    documentDirs: string
    meetingKeywords: string
    chatKeywords: string
    nameAliases: string
  }
): Promise<void> {
  await replaceProjectAliases(projectId, buildAliasesFromForm(data))
}
