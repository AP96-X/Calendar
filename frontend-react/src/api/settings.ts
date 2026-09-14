import client from './client';
import type { ApiResponse } from '../types';

export interface AdminSettingsPayload {
  values: Record<string, unknown>;
  customized: Record<string, boolean>;
  labels: Record<string, string>;
}

export const settingsApi = {
  /** 读取当前生效的系统设置（敏感项不回显真实值） */
  get(): Promise<AdminSettingsPayload> {
    return client.get('/api/admin/settings').then((r) => r.data);
  },

  /** 保存设置；仅提交表单中出现的项，未提交项保持不变 */
  update(values: Record<string, unknown>): Promise<ApiResponse & { updated: string[] }> {
    return client.put('/api/admin/settings', { values }).then((r) => r.data);
  },

  /** 恢复默认：删除数据库中的覆盖值，回落到环境变量 / 内置默认值 */
  reset(keys?: string[]): Promise<ApiResponse & { reset: string[] }> {
    return client.post('/api/admin/settings/reset', keys ? { keys } : { all: true }).then((r) => r.data);
  },
};
