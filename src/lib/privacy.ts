export const PRIVACY_CAPABILITIES = {
  L1_CLOUD: 'l1_cloud_structured',
  L2_ENHANCED: 'l2_enhanced_summary',
  L3_PROJECT_DIR: 'l3_project_directory'
} as const

export type PrivacyCapability =
  (typeof PRIVACY_CAPABILITIES)[keyof typeof PRIVACY_CAPABILITIES]

export function getPrivacyConsent(
  scopeType: 'global' | 'project' | 'app',
  scopeId: string | null,
  capability: PrivacyCapability
): Promise<{ enabled: boolean } | null> {
  return window.electronAPI.getPrivacyConsent(scopeType, scopeId, capability)
}

export function setPrivacyConsent(
  scopeType: 'global' | 'project' | 'app',
  scopeId: string | null,
  capability: PrivacyCapability,
  enabled: boolean
): Promise<unknown> {
  return window.electronAPI.setPrivacyConsent(scopeType, scopeId, capability, enabled)
}
