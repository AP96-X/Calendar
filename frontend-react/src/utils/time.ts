import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// 中国时区（北京时间，UTC+8）：后端所有时间字段均按该时区存储与返回
export const CN_TIMEZONE = 'Asia/Shanghai';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

// 后端统一返回的存储格式：YYYY-MM-DD HH:mm:ss（中国时区）
const CN_DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
// 仅日期：YYYY-MM-DD
const CN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// ISO 8601（含 T 分隔，或带 Z / ±HH:MM 时区后缀）
const ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
// RFC 822 / HTTP-date（如 'Sat, 08 Sep 2026 00:05:52 GMT'）
const RFC822_RE = /^\w{3},\s*(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/;

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * 将后端返回的时间字符串按中国时区（Asia/Shanghai）显示，
 * 默认以「年月日 时分秒」中文格式展示（如 2026年08月02日 12:00:21）。
 *
 * 兼容后端可能返回的多种格式：
 *   - 'YYYY-MM-DD HH:mm:ss'（SQLite 直接返回的字符串，按中国时区解析）
 *   - ISO 8601（带 T / Z / 时区偏移，会换算到中国时区）
 *   - RFC 822（MySQL datetime 被 Flask 默认序列化成 'Sat, 08 Sep 2026 00:05:52 GMT'）
 *   - 'YYYY-MM-DD' 纯日期
 * 无法识别或为空时原样返回，避免破坏性转换。
 */
export function formatCnTime(value?: string | null, template = 'YYYY年MM月DD日 HH:mm:ss'): string {
  if (!value) return '-';
  const raw = String(value).trim();
  if (!raw) return '-';

  try {
    // 后端标准格式：字段本身已是中国时区，直接按该时区解析
    if (CN_DATETIME_RE.test(raw) || CN_DATE_RE.test(raw)) {
      return dayjs.tz(raw, CN_TIMEZONE).format(template);
    }
    // ISO：仅在显式带时区信息时做时区换算，否则按字面字段展示
    if (ISO_RE.test(raw)) {
      const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw);
      const parsed = hasZone ? dayjs(raw).tz(CN_TIMEZONE) : dayjs(raw);
      if (parsed.isValid()) return parsed.format(template);
    }
    // RFC 822：字段时间值即数据库中的中国时区时间，忽略 GMT 标签，仅重排格式
    const rfc = RFC822_RE.exec(raw);
    if (rfc) {
      const iso = `${rfc[3]}-${MONTHS[rfc[2]] || '01'}-${rfc[1].padStart(2, '0')} ` +
        `${rfc[4]}:${rfc[5]}:${rfc[6]}`;
      const parsed = dayjs(iso);
      if (parsed.isValid()) return parsed.format(template);
    }
    const fallback = dayjs(raw);
    if (fallback.isValid()) return fallback.format(template);
  } catch {
    // 解析失败时返回原值
  }
  return raw;
}
