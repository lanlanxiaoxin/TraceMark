import { useState, useEffect, useCallback } from 'react'
import { getAllSettings, setSetting } from '@/lib/db'

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    getAllSettings()
      .then(setSettings)
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = useCallback(async (key: string, value: string) => {
    setSavingKey(key)
    setSettings(prev => ({ ...prev, [key]: value }))
    try {
      await setSetting(key, value)
    } catch {
      const fresh = await getAllSettings()
      setSettings(fresh)
    } finally {
      setSavingKey(null)
    }
  }, [])

  return {
    settings,
    loading,
    savingKey,
    updateSetting
  }
}
