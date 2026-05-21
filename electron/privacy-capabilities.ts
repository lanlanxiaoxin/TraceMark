import { getPrivacyConsent, setPrivacyConsent, type ConsentScopeType } from './privacy-consents'

/** PRO5.0 分级采集能力标识 */
export const PRIVACY_CAPABILITIES = {
  L1_CLOUD: 'l1_cloud_structured',
  L2_ENHANCED: 'l2_enhanced_summary',
  L3_PROJECT_DIR: 'l3_project_directory'
} as const

export type PrivacyCapability =
  (typeof PRIVACY_CAPABILITIES)[keyof typeof PRIVACY_CAPABILITIES]

/** L0 本地基础始终开启，不落库 */
export function isL0Enabled(): boolean {
  return true
}

export function isCapabilityEnabled(
  scopeType: ConsentScopeType,
  scopeId: string | null,
  capability: PrivacyCapability
): boolean {
  const row = getPrivacyConsent(scopeType, scopeId, capability)
  return row?.enabled === true
}

export function setCapabilityEnabled(
  scopeType: ConsentScopeType,
  scopeId: string | null,
  capability: PrivacyCapability,
  enabled: boolean
): void {
  setPrivacyConsent(scopeType, scopeId, capability, enabled)
}

/** 云端 AI（报告/复盘）需 L1 + API Key + 非离线 */
export function canUseCloudAi(): boolean {
  return isCapabilityEnabled('global', null, PRIVACY_CAPABILITIES.L1_CLOUD)
}
