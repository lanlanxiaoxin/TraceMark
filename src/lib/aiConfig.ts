export interface AiPreset {
  id: string
  label: string
  description: string
  baseUrl: string
  model: string
}

export interface ResolvedAiConfig {
  providerType: 'preset' | 'custom'
  label: string
  baseUrl: string
  model: string
  apiKey: string
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek-V4-Flash',
    description: '性价比首选，最新非推理模型',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash'
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek-V4-Pro',
    description: '深度推理模型，复杂任务首选',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro'
  },
  {
    id: 'qwen3.6-flash',
    label: 'Qwen3.6-Flash',
    description: '超长上下文，低成本快速模型',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-flash'
  },
  {
    id: 'qwen3.6-plus',
    label: 'Qwen3.6-Plus',
    description: '阿里通义千问均衡性能模型',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-plus'
  },
  {
    id: 'qwen3.6-max-preview',
    label: 'Qwen3.6-Max-Preview',
    description: '阿里旗舰最强模型（预览版）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-max-preview'
  },
  {
    id: 'kimi-k2.6',
    label: 'Kimi K2.6',
    description: '月之暗面旗舰模型，128K 上下文，支持思考',
    baseUrl: 'https://api.moonshot.cn',
    model: 'kimi-k2.6'
  },
  {
    id: 'glm-5.1',
    label: '智谱 GLM-5.1',
    description: '智谱最新旗舰模型，长程任务显著提升',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.1'
  },
  {
    id: 'glm-4.7-flash',
    label: '智谱 GLM-4.7-Flash',
    description: '智谱免费快速模型，适合开发调试',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.7-flash'
  },
  {
    id: 'hunyuan-turbos-latest',
    label: '混元-TurboS',
    description: '腾讯旗舰模型，更强推理能力',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    model: 'hunyuan-turbos-latest'
  },
  {
    id: 'hunyuan-lite',
    label: '混元-Lite',
    description: '免费测试，适合开发调试',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    model: 'hunyuan-lite'
  },
  {
    id: 'openai-gpt-4o',
    label: 'OpenAI GPT-4o',
    description: 'OpenAI 通用旗舰模型，多模态',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  }
]

export function getPresetById(id: string): AiPreset | undefined {
  return AI_PRESETS.find(p => p.id === id)
}

export function resolveAiConfig(settings: Record<string, string>): ResolvedAiConfig {
  const apiKey = settings.api_key ?? ''

  if (settings.ai_provider_type === 'custom') {
    return {
      providerType: 'custom',
      label: settings.ai_custom_model?.trim() || '自定义模型',
      baseUrl: normalizeBaseUrl(settings.ai_custom_base_url ?? ''),
      model: settings.ai_custom_model?.trim() ?? '',
      apiKey
    }
  }

  const presetId = settings.ai_preset || settings.ai_model || AI_PRESETS[0].id
  const preset = getPresetById(presetId) ?? AI_PRESETS[0]

  return {
    providerType: 'preset',
    label: preset.label,
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function isAiConfigValid(config: ResolvedAiConfig): boolean {
  if (!config.baseUrl || !config.model) return false
  try {
    new URL(config.baseUrl.startsWith('http') ? config.baseUrl : `https://${config.baseUrl}`)
    return true
  } catch {
    return false
  }
}
