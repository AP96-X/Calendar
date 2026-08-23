import client from './client';
import type {
  ReportPeriod, ReportResult, ReportPeriodStats, ReportUsage, ReportPrompt,
} from '../types';

export const reportApi = {
  /**
   * 生成 AI 总结（周/月/季/年度）。
   * period: 'week'|'month'|'quarter'|'year'，start/end 为手动选择的起止日期（YYYY-MM-DD），
   * note 为生成前用户人工输入的补充说明（可选），
   * prompt 为自定义提示词模板（可选；不传则使用用户已保存模板或默认模板）。
   * 生成时后端将该时间范围内的全部事件提交给 AI，由 AI 整合并合并相同/相似事件。
   * 额度不足时后端返回 429（code=REPORT_LIMIT_EXCEEDED），由调用方提示。
   */
  generateAiReport(
    period: ReportPeriod,
    start: string,
    end: string,
    note?: string,
    prompt?: string,
  ): Promise<ReportResult> {
    return client
      .post<ReportResult>('/api/reports/ai', {
        period,
        start,
        end,
        note: note || undefined,
        prompt: prompt || undefined,
      })
      .then((r) => r.data);
  },

  /**
   * 聚合预览：按手动选择的时间范围统计事件，返回统计信息 + 全部原始事件（不消耗次数）。
   * events 为逐条原始事件，用于前端展示「将提交给 AI 的事件清单」。
   */
  getPreview(period: ReportPeriod, start: string, end: string): Promise<ReportPeriodStats> {
    return client
      .get<ReportPeriodStats>('/api/reports/preview', {
        params: { period, start, end },
      })
      .then((r) => r.data);
  },

  /** 查询当前用户本月 AI 报告剩余次数（不消耗次数） */
  getUsage(): Promise<ReportUsage> {
    return client.get('/api/reports/usage').then((r) => r.data);
  },

  /** 获取默认提示词模板与当前用户已保存的自定义模板 */
  getPrompt(): Promise<ReportPrompt> {
    return client.get('/api/reports/prompt').then((r) => r.data);
  },

  /** 保存当前用户的自定义提示词模板；传空字符串 = 恢复默认 */
  savePrompt(prompt: string): Promise<{ success: boolean; custom_prompt: string | null }> {
    return client.put('/api/reports/prompt', { prompt }).then((r) => r.data);
  },
};
