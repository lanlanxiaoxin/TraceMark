import { useCallback, useEffect, useState } from 'react'
import { getPrivacyConsent, setPrivacyConsent, PRIVACY_CAPABILITIES } from '@/lib/privacy'

interface PrivacyConsentPanelProps {
  scopeType?: 'global' | 'project'
  projectId?: number | null
  compact?: boolean
}

export function PrivacyConsentPanel({
  scopeType = 'global',
  projectId = null,
  compact = false
}: PrivacyConsentPanelProps): JSX.Element {
  const scopeId = scopeType === 'project' && projectId != null ? String(projectId) : null
  const [l1, setL1] = useState(false)
  const [l2, setL2] = useState(false)
  const [l3, setL3] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, b, c] = await Promise.all([
        getPrivacyConsent(scopeType, scopeId, PRIVACY_CAPABILITIES.L1_CLOUD),
        getPrivacyConsent(scopeType, scopeId, PRIVACY_CAPABILITIES.L2_ENHANCED),
        projectId != null
          ? getPrivacyConsent('project', String(projectId), PRIVACY_CAPABILITIES.L3_PROJECT_DIR)
          : Promise.resolve(null)
      ])
      setL1(a?.enabled ?? false)
      setL2(b?.enabled ?? false)
      setL3(c?.enabled ?? false)
    } finally {
      setLoading(false)
    }
  }, [scopeType, scopeId, projectId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (cap: string, value: boolean, setter: (v: boolean) => void): Promise<void> => {
    setter(value)
    const st = cap === PRIVACY_CAPABILITIES.L3_PROJECT_DIR ? 'project' : scopeType
    const sid = cap === PRIVACY_CAPABILITIES.L3_PROJECT_DIR && projectId != null ? String(projectId) : scopeId
    await setPrivacyConsent(st, sid, cap as typeof PRIVACY_CAPABILITIES.L1_CLOUD, value)
  }

  if (loading) {
    return <p className="text-sm text-gray-400">加载授权状态…</p>
  }

  const row = (
    id: string,
    label: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    disabled?: boolean
  ) => (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => void onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300"
      />
      <span>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
      </span>
    </label>
  )

  return (
    <section className={compact ? 'space-y-3' : 'bg-white rounded-xl border border-gray-200 p-6 space-y-4'}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">分级采集与云端 AI</h2>
          <p className="text-sm text-gray-500 mt-1">
            按 PRO5.0 分级授权；生成复盘/报告前可预览实际上传内容。
          </p>
        </div>
      )}
      {row(
        'cap-l0',
        'L0 本地基础',
        '进程名、窗口标题、时长仅存本地（始终开启）',
        true,
        () => {},
        true
      )}
      {row('cap-l1', 'L1 云端结构化', '允许将脱敏后的项目名、分类、已确认资产等发送至云端 AI', l1, v =>
        void toggle(PRIVACY_CAPABILITIES.L1_CLOUD, v, setL1)
      )}
      {row(
        'cap-l2',
        'L2 增强摘要',
        'Git 统计、浏览器/会议标题摘要、活跃文档片段（不上传原始窗口标题与全文）',
        l2,
        v => void toggle(PRIVACY_CAPABILITIES.L2_ENHANCED, v, setL2)
      )}
      {projectId != null &&
        row(
          'cap-l3',
          'L3 项目目录文档',
          '仅读取本项目「绑定文档目录」下的片段摘要（需单独授权，未授权不扫描）',
          l3,
          v => void toggle(PRIVACY_CAPABILITIES.L3_PROJECT_DIR, v, setL3)
        )}
    </section>
  )
}
