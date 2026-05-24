import type { RecallSearchResult } from '@/env'

export { ASSET_SEARCH_HINT, parseAssetSearchQuery } from '../../shared/asset-search-query'

export function searchWorkAssetsRecall(
  query: string,
  options?: { limit?: number; rerank?: boolean; activityLimit?: number }
): Promise<RecallSearchResult> {
  return window.electronAPI.searchWorkAssetsRecall(query, options)
}
