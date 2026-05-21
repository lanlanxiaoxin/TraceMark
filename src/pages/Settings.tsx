import { useSettings } from '@/hooks/useSettings'
import { AiSettingsSection } from '@/components/AiSettingsSection'
import { PrivacySettings } from '@/components/PrivacySettings'
import { PrivacyConsentPanel } from '@/components/PrivacyConsentPanel'
import { ActivityProviderSection } from '@/components/ActivityProviderSection'
import { CategorySettings } from '@/components/CategorySettings'

const POLL_INTERVALS = [
  { value: '3', label: '3 秒（更精细）' },
  { value: '5', label: '5 秒（推荐）' },
  { value: '10', label: '10 秒（更省电）' }
]

export function Settings(): JSX.Element {
  const { settings, loading, savingKey, updateSetting } = useSettings()

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        加载中...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        <p className="text-sm text-gray-500 mt-1">
          配置进程监听、隐私脱敏和 AI 生成偏好
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">进程监听</h2>
        <p className="text-sm text-gray-500">
          自动记录前台应用，解析工具分类与项目/文件名，无需手动配置目录。
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.process_monitoring_enabled !== 'false'}
            onChange={e =>
              updateSetting('process_monitoring_enabled', e.target.checked ? 'true' : 'false')
            }
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">启用进程监听</span>
            <p className="text-xs text-gray-500">关闭后不再记录新的前台应用活动</p>
          </div>
        </label>

        <div>
          <label htmlFor="poll-interval" className="block text-sm font-medium text-gray-700 mb-1">
            采样间隔
          </label>
          <select
            id="poll-interval"
            value={settings.poll_interval_seconds || '5'}
            onChange={e => updateSetting('poll_interval_seconds', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {POLL_INTERVALS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400">
          采集时自动分类并脱敏；原始窗口标题仅存本地，不上传 AI。
        </p>
      </section>

      <CategorySettings settings={settings} updateSetting={updateSetting} />

      <ActivityProviderSection />

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">系统通知</h2>
        <p className="text-sm text-gray-500">
          定时提醒生成日报/周报，点击通知可直接跳转到应用
        </p>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.daily_reminder_enabled !== 'false'}
            onChange={e =>
              updateSetting('daily_reminder_enabled', e.target.checked ? 'true' : 'false')
            }
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">每日提醒</span>
            <p className="text-xs text-gray-500">每天定时提醒生成当日日报</p>
          </div>
          <input
            type="time"
            value={settings.daily_reminder_time || '18:00'}
            onChange={e => updateSetting('daily_reminder_time', e.target.value)}
            disabled={settings.daily_reminder_enabled === 'false'}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
          />
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.friday_reminder_enabled !== 'false'}
            onChange={e =>
              updateSetting('friday_reminder_enabled', e.target.checked ? 'true' : 'false')
            }
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">周五提醒</span>
            <p className="text-xs text-gray-500">每周五定时提醒生成本周周报</p>
          </div>
          <input
            type="time"
            value={settings.friday_reminder_time || '16:00'}
            onChange={e => updateSetting('friday_reminder_time', e.target.value)}
            disabled={settings.friday_reminder_enabled === 'false'}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
          />
        </label>
      </section>

      <PrivacySettings settings={settings} updateSetting={updateSetting} />

      <PrivacyConsentPanel />

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">今日叙事</h2>
        <p className="text-sm text-gray-500">
          「今日」页顶部的叙事默认使用
          <span className="font-medium text-gray-800">本地规则</span>
          统计。若开启下方选项，可在叙事卡片中通过
          <span className="font-medium text-gray-800">上传预览</span>
          确认后再调用云端 AI 润色（需 API Key、非离线模式且同意 L1 授权）。
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.daily_narrative_use_ai === 'true'}
            onChange={e =>
              updateSetting('daily_narrative_use_ai', e.target.checked ? 'true' : 'false')
            }
            disabled={savingKey === 'daily_narrative_use_ai'}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">允许使用云端 AI 润色叙事</span>
            <p className="text-xs text-gray-500">
              关闭时仅离线规则叙事；开启后仍需在「今日」里每次点「上传预览并生成」才会请求模型。
            </p>
          </div>
        </label>
      </section>

      <AiSettingsSection
        settings={settings}
        savingKey={savingKey}
        updateSetting={updateSetting}
      />

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-1">
        <h2 className="text-lg font-semibold text-gray-900">关于</h2>
        <p className="text-sm text-gray-500">TraceMack v0.1.0</p>
        <p className="text-xs text-gray-400">个人工作痕迹自动记账本</p>
      </section>
    </div>
  )
}
