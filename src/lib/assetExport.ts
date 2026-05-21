import type { ProjectSpace, WorkAsset } from '@/env'

const KIND_LABELS: Record<string, string> = {
  outcome: '成果',
  process: '过程',
  evidence: '证据'
}

function formatAssetDate(asset: WorkAsset): string {
  if (!asset.startedAt) return '—'
  const start = new Date(asset.startedAt).toLocaleDateString('zh-CN')
  if (!asset.endedAt || asset.endedAt === asset.startedAt) return start
  const end = new Date(asset.endedAt).toLocaleDateString('zh-CN')
  return `${start} – ${end}`
}

export function workAssetsToMarkdown(
  assets: WorkAsset[],
  projectById: Map<number, ProjectSpace>
): string {
  const lines = [
    '# 工作资产导出',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `共 ${assets.length} 条`,
    ''
  ]

  for (const asset of assets) {
    const project =
      asset.projectId != null ? projectById.get(asset.projectId)?.name ?? '未知项目' : '未归类'
    lines.push(`## ${asset.title}`)
    lines.push('')
    lines.push(`- **项目**：${project}`)
    lines.push(`- **类型**：${KIND_LABELS[asset.assetKind] ?? asset.assetKind}`)
    lines.push(`- **状态**：${asset.status}`)
    lines.push(`- **时间**：${formatAssetDate(asset)}`)
    if (asset.description) lines.push(`- **补充**：${asset.description}`)
    if (asset.impact) lines.push(`- **影响**：${asset.impact}`)
    if (asset.evidence.length > 0) {
      lines.push('- **证据**：')
      for (const e of asset.evidence) {
        lines.push(`  - [${e.type}] ${e.summary}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function workAssetsToJson(assets: WorkAsset[]): string {
  return JSON.stringify(assets, null, 2)
}
