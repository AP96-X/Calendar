// ========== Auth Types ==========
export interface UserInfo {
  logged_in: boolean;
  user_id: number;
  username: string;
  display_name: string;
  role: 'admin' | 'user';
}

export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

// ========== Event Types ==========
export interface CalendarEvent {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM or null
  color: string;
  completed: boolean; // backend returns bool
  created_at?: string;
  updated_at?: string;
}

export interface EventInput {
  title: string;
  date: string;
  time?: string | null;
  color?: string;
  completed?: boolean;
}

// Events returned as a map: { 'YYYY-MM-DD': CalendarEvent[] }
export type EventsByDate = Record<string, CalendarEvent[]>;

// ========== Calendar Meta Types ==========
export interface DayMeta {
  lunar: string;
  holiday: string | null;
  solar_term: string;
  is_holiday: boolean;
  is_workday: boolean;
  is_weekend: boolean;
  is_adjust_work: boolean;
  adjust_for: string | null;
}

export type CalendarMeta = Record<string, DayMeta>;

export interface MetaStatus {
  year: number;
  month: number;
  cached: boolean;
  days_cached: number;
  updated_at: string;
}

// ========== User Management Types ==========
export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'admin' | 'user';
  enabled: boolean; // backend returns bool
  created_at: string;
  updated_at?: string;
}

// ========== Profile Types ==========
export interface Profile {
  username: string;
  display_name: string;
  role: 'admin' | 'user';
  created_at: string;
}

// ========== Audit Types ==========
export interface AuditLog {
  id: number;
  admin: string;
  action: string;
  target: string;
  details: string;
  created_at: string;
}

export interface LoginLog {
  id: number;
  username: string;
  ip_address: string;
  attempted_at: string;
  success: boolean; // backend returns bool
}

// ========== API Response ==========
export interface ApiResponse<T = unknown> {
  success?: boolean;
  error?: string;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

// ========== AI Report Types ==========
export type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';

/** 聚合后的事项（相同标题合并，count 为出现次数；生成前可由用户整理修改） */
export interface ReportItem {
  title: string;
  count: number;
  completed: number;
  color: string;
}

export interface ReportPeriodStats {
  period: ReportPeriod;
  label: string;
  start: string;
  end: string;
  total: number;
  completed: number;
  pending: number;
  completion_rate: number;
  by_color: Record<string, { total: number; completed: number }>;
  /** 相同事件已整合：按标题合并，count 为出现次数 */
  aggregated: ReportItem[];
  /** 该时间范围内的全部原始事件（逐条；由 AI 在生成阶段整合并合并相同/相似事件） */
  events: ReportEvent[];
}

export interface ReportUsage {
  month: string;
  used: number;
  limit: number;
  remaining: number;
}

/** 提示词模板：default_prompt 为系统默认模板，custom_prompt 为用户已保存的自定义模板（null=未自定义） */
export interface ReportPrompt {
  default_prompt: string;
  custom_prompt: string | null;
}

export interface ReportEvent {
  title: string;
  date: string;
  time: string;
  color: string;
  completed: boolean;
}

/** 周报三块区域预填数据（均按标题去重） */
export interface ReportResult {
  success: boolean;
  period: ReportPeriod;
  markdown: string;
  /** 统计信息（周报润色模式下为 null） */
  stats: ReportPeriodStats | null;
  events: ReportEvent[];
  model: string | null;
  degraded: boolean;
  /** AI 输出是否因超过生成长度上限被截断（已自动重试一次后仍截断） */
  truncated?: boolean;
  ai_error: string | null;
  usage?: ReportUsage;
  generated_at: string;
}
