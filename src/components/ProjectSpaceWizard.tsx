import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react'
import { pickDirectory } from '@/lib/dialog'
import type { ProjectRoleTemplate } from '@/env'

export interface ProjectWizardSaveData {
  name: string
  roleTemplate: ProjectRoleTemplate
  gitPath: string
  browserKeywords: string
  documentKeywords: string
  documentDirs: string
  meetingKeywords: string
  chatKeywords: string
  nameAliases: string
}

interface ProjectSpaceWizardProps {
  onSave: (data: ProjectWizardSaveData) => Promise<void>
  onCancel: () => void
  onOpenAdvanced?: () => void
}

export function ProjectSpaceWizard({
  onSave,
  onCancel,
  onOpenAdvanced
}: ProjectSpaceWizardProps): JSX.Element {
  const { t } = useTranslation()
  const steps = useMemo(
    () =>
      [
        { id: 1 as const, title: t('projectSpace.wizardName'), hint: t('projects.emptyBody') },
        { id: 2 as const, title: t('projectSpace.wizardGit'), hint: t('projectSpace.wizardGitHint') },
        { id: 3 as const, title: t('projectSpace.wizardKeywords'), hint: t('projectSpace.wizardKeywordsHint') }
      ] as const,
    [t]
  )
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [gitPath, setGitPath] = useState('')
  const [keywords, setKeywords] = useState('')
  const [saving, setSaving] = useState(false)

  const browseGitPath = async (): Promise<void> => {
    const picked = await pickDirectory({
      title: t('projectSpace.pickFolderTitle'),
      defaultPath: gitPath.trim() || undefined
    })
    if (typeof picked === 'string') setGitPath(picked)
  }

  const finish = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    const kw = (keywords.trim() || trimmed)
      .split(/[,，]/)
      .map(v => v.trim())
      .filter(Boolean)
      .join(', ')
    setSaving(true)
    try {
      await onSave({
        name: trimmed,
        roleTemplate: 'developer',
        gitPath: gitPath.trim(),
        browserKeywords: kw,
        documentKeywords: '',
        documentDirs: '',
        meetingKeywords: '',
        chatKeywords: '',
        nameAliases: kw
      })
    } finally {
      setSaving(false)
    }
  }

  const goNext = (): void => {
    if (step === 1 && !name.trim()) return
    if (step < 3) setStep(step + 1)
    else void finish()
  }

  const skipStep = (): void => {
    if (step === 2) {
      setGitPath('')
      setStep(3)
      return
    }
    if (step === 3) {
      setKeywords('')
      void finish()
      return
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2" aria-label={t('projectSpace.wizardProgress')}>
        {steps.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s.id <= step ? 'bg-gray-900' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {t('projectSpace.wizardStep', { step })}
        </p>
        <h2 className="text-lg font-semibold text-gray-900 mt-1">{steps[step - 1].title}</h2>
        <p className="text-sm text-gray-500 mt-1">{steps[step - 1].hint}</p>
      </div>

      {step === 1 && (
        <div>
          <label htmlFor="wizard-name" className="sr-only">
            {t('projectSpace.wizardName')}
          </label>
          <input
            id="wizard-name"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) goNext()
            }}
            placeholder="TraceMark"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <label htmlFor="wizard-git" className="sr-only">
            {t('projectSpace.gitPath')}
          </label>
          <div className="flex gap-2">
            <input
              id="wizard-git"
              autoFocus
              value={gitPath}
              onChange={e => setGitPath(e.target.value)}
              placeholder="D:\workspace\my-project"
              className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={() => void browseGitPath()}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              aria-label={t('projectSpace.browseAria')}
            >
              <FolderOpen className="w-4 h-4" />
              {t('common.browse')}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <label htmlFor="wizard-kw" className="sr-only">
            {t('projectSpace.wizardKeywordsField')}
          </label>
          <input
            id="wizard-kw"
            autoFocus
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            placeholder={name.trim() || t('projectSpace.wizardKeywordsPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-500 mt-2">
            {t('projectSpace.wizardKeywordsDefault', { name: name.trim() || '…' })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('common.back')}
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          disabled={saving || (step === 1 && !name.trim())}
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white disabled:opacity-50"
        >
          {step < 3 ? t('common.next') : saving ? t('projectSpace.wizardCreating') : t('projectSpace.wizardDone')}
          {step < 3 && <ChevronRight className="w-4 h-4" />}
        </button>
        {(step === 2 || step === 3) && (
          <button
            type="button"
            onClick={skipStep}
            disabled={saving}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t('common.skip')}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="ml-auto px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          {t('common.cancel')}
        </button>
      </div>

      {onOpenAdvanced && (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-4">
          {t('projectSpace.wizardAdvancedLink')}{' '}
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="text-gray-800 underline hover:no-underline"
          >
            {t('projectSpace.wizardUseAdvanced')}
          </button>
        </p>
      )}
    </div>
  )
}
