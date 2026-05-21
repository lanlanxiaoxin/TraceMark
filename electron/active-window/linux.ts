import type { ActivityProvider } from './types'

/** Linux：接口预留，暂不采集前台窗口 */
export const linuxActivityProvider: ActivityProvider = {
  platform: 'linux',
  async getActiveWindow() {
    return null
  },
  explainPermissions: () =>
    'Linux 版尚未实现前台窗口采集；时间轴与资产功能仍可使用历史数据。'
}
