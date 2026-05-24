import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, FolderOpen } from 'lucide-react'
import type { ProjectAliasType, ProjectRoleTemplate, ProjectSpace } from '@/env'
import { listProjectAliases, replaceProjectAliases } from '@/lib/projectSpaces'
import { pickDirectory } from '@/lib/dialog'

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
  const { t } = useTranslation()
  const [name, setName] = useState(space?.name ?? '')
  const [privacyAlias, setPrivacyAlias] = useState(space?.privacyAlias ?? '')
  const [description, setDescription] = useState(space?.description ?? '')
  const [roleTemplate, setRoleTemplate] = useState<ProjectRoleTemplate>(
    space?.roleTemplate ?? 'developer'
  )
  const [gitPath, setGitPath] = useState('')
  const [browserKeywords, setBrowserKeywords] = useState('')
  const [documentKeywords, setDocumentKeywords] = useState('')
  const [meetingKeywords, setMeetingKeywords] = useState('')
  const [chatKeywords, setChatKeywords] = useState('')
  const [nameAliases, setNameAliases] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!space)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
      setDocumentKeywords(
        aliases.filter(a => a.aliasType === 'document').map(a => a.value).join(', ')
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
      title: t('projectSpace.pickFolderTitle'),
      defaultPath: gitPath.trim() || undefined
    })
    if (typeof picked === 'string') setGitPath(picked)
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
        documentDirs: '',
        meetingKeywords: meetingKeywords.trim(),
        chatKeywords: chatKeywords.trim(),
        nameAliases: nameAliases.trim()
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500 p-4">{t('common.loadingShort')}</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ps-name" className="block text-sm font-medium text-gray-700 mb-1">
          {t('projectSpace.name')}
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
        <label htmlFor="ps-git" className="block text-sm font-medium text-gray-700 mb-1">
          {t('projectSpace.gitPath')}
        </label>
        <div className="flex gap-2">
          <input
            id="ps-git"
            value={gitPath}
            onChange={e => setGitPath(e.target.value)}
            placeholder={t('projectSpace.optional')}
            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => void browseGitPath()}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            aria-label={t('projectSpace.browseFolderAria')}
          >
            <FolderOpen className="w-4 h-4" />
            {t('common.browse')}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="ps-names" className="block text-sm font-medium text-gray-700 mb-1">
          {t('projectSpace.aliases')}
        </label>
        <input
          id="ps-names"
          value={nameAliases}
          onChange={e => setNameAliases(e.target.value)}
          placeholder={t('projectSpace.aliasesPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="ps-browser" className="block text-sm font-medium text-gray-700 mb-1">
          {t('projectSpace.browserKeywords')}
        </label>
        <input
          id="ps-browser"
          value={browserKeywords}
          onChange={e => setBrowserKeywords(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showAdvanced ? t('projectSpace.advancedToggleHide') : t('projectSpace.advancedToggleShow')}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-1 border-l-2 border-gray-100">
          <div>
            <label htmlFor="ps-privacy" className="block text-sm font-medium text-gray-700 mb-1">
              {t('projectSpace.privacyAlias')}
            </label>
            <input
              id="ps-privacy"
              value={privacyAlias}
              onChange={e => setPrivacyAlias(e.target.value)}
              placeholder={t('projectSpace.privacyAliasPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="ps-role" className="block text-sm font-medium text-gray-700 mb-1">
              {t('projectSpace.roleTemplate')}
            </label>
            <select
              id="ps-role"
              value={roleTemplate}
              onChange={e => setRoleTemplate(e.target.value as ProjectRoleTemplate)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="developer">{t('projectSpace.roleDeveloper')}</option>
              <option value="pm">{t('projectSpace.rolePm')}</option>
              <option value="implementation">{t('projectSpace.roleImplementation')}</option>
              <option value="office">{t('projectSpace.roleOffice')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="ps-doc" className="block text-sm font-medium text-gray-700 mb-1">
              {t('projectSpace.docKeywords')}
            </label>
            <input
              id="ps-doc"
              value={documentKeywords}
              onChange={e => setDocumentKeywords(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="ps-meeting" className="block text-sm font-medium text-gray-700 mb-1">
              {t('projectSpace.meetingKeywords')}
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
              {t('projectSpace.chatKeywords')}
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
              {t('projectSpace.description')}
            </label>
            <textarea
              id="ps-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600"
        >
          {t('common.cancel')}
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
