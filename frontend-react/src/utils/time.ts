import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// 中国时区（北京时间，UTC+8）：后端所有时间字段均按该时区存储与返回
export const CN_TIMEZONE = 'Asia/Shanghai';

dayjs.extend(utc);
dayjs.extend(timezone);

// 后端统一返回的存储格式：YYYY-MM-DD HH:mm:ss（中国时区）
const CN_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * 将后端返回的「YYYY-MM-DD HH:mm:ss」时间字符串按中国时区（Asia/Shanghai）显示，
 * 默认以「年月日 时分秒」中文格式展示（如 2026年08月02日 12:00:21）。
 * 后端已统一按中国时区存储，此处按目标时区解析并格式化，
 * 确保页面展示始终为中国时区的时间显示方式。
 * 非该格式的原始值（含空值）原样返回，避免破坏性转换。
 */
export function formatCnTime(value?: string | null, template = 'YYYY年MM月DD日 HH:mm:ss'): string {
  if (!value) return '-';
  if (!CN_DATETIME_RE.test(value)) return value;
  try {
    return dayjs.tz(value, CN_TIMEZONE).format(template);
  } catch {
    return value;
  }
}
