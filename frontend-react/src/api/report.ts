import client from './client';
import type {
  ReportPeriod, ReportItem, ReportResult, ReportPeriodStats, ReportUsage, ReportPrompt, WeeklyPreview,
} from '../types';

export const reportApi = {
  /**
   * 生成 AI 总结（周/月/季/年度）。
   * period: 'week'|'month'|'quarter'|'year'，start/end 为手动选择的起止日期（YYYY-MM-DD），
   * note 为生成前用户人工输入的补充说明（可选），
   * items 为用户整理后的事项清单（可选；不传则后端使用自动聚合清单），
   * prompt 为自定义提示词模板（可选；不传则使用用户已保存模板或默认模板）。
   * 额度不足时后端返回 429（code=REPORT_LIMIT_EXCEEDED），由调用方提示。
   */
  generateAiReport(
    period: ReportPeriod,
    start: string,
    end: string,
    note?: string,
    items?: ReportItem[],
    prompt?: string,
  ): Promise<ReportResult> {
    return client
      .post<ReportResult>('/api/reports/ai', {
        period,
        start,
        end,
        note: note || undefined,
        items: items && items.length > 0 ? items : undefined,
        prompt: prompt || undefined,
      })
      .then((r) => r.data);
  },

  /**
   * 生成周报（周报三块区域润色模式）。
   * work_done / next_work / help_needed 为用户整理后的三块内容，AI 负责润色。
   */
  generateWeeklyReport(
    start: string,
    end: string,
    workDone: string,
    nextWork: string,
    helpNeeded: string,
  ): Promise<ReportResult> {
    return client
      .post<ReportResult>('/api/reports/ai', {
        period: 'week',
        start,
        end,
        work_done: workDone,
        next_work: nextWork,
        help_needed: helpNeeded,
      })
      .then((r) => r.data);
  },

  /**
   * 聚合预览：按手动选择的时间范围统计事件，返回聚合后的事项清单（不消耗次数）。
   * 周报模式（period='week'）可传 next_start/next_end，额外返回三块区域预填数据。
   */
  getPreview(
    period: ReportPeriod,
    start: string,
    end: string,
    nextStart?: string,
    nextEnd?: string,
  ): Promise<ReportPeriodStats & Partial<WeeklyPreview>> {
    return client
      .get<ReportPeriodStats & Partial<WeeklyPreview>>('/api/reports/preview', {
        params: {
          period,
          start,
          end,
          ...(nextStart && nextEnd ? { next_start: nextStart, next_end: nextEnd } : {}),
        },
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
