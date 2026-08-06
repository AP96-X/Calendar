import dayjs from 'dayjs';

// Event color palette (matches original app)
export const EVENT_COLORS = [
  '#4A90D9', '#27AE60', '#E74C3C', '#F39C12', '#8E44AD',
  '#1ABC9C', '#E67E22', '#2C3E50', '#E91E63', '#00BCD4',
];

// Lunar festivals list (from original app)
const LUNAR_FESTIVALS = ['春节', '元宵节', '端午节', '七夕', '中元节', '中秋节', '重阳节', '腊八节', '除夕'];

// Festival name → plain lunar day text mapping
// Backend returns festival names as the `lunar` field; we convert back to plain lunar day
const FESTIVAL_TO_LUNAR_DAY: Record<string, string> = {
  '春节': '初一',
  '元宵节': '十五',
  '端午节': '初五',
  '七夕': '初七',
  '中元节': '十五',
  '中秋节': '十五',
  '重阳节': '初九',
  '腊八节': '初八',
  '除夕': '三十',
};

// Holiday name shortening map (from original app)
const HOLIDAY_SHORT_MAP: Record<string, string> = {
  '元旦': '元旦', '元旦假期': '元旦',
  '春节': '春节', '春节假期': '春节',
  '清明节': '清明', '清明假期': '清明',
  '劳动节': '劳动', '劳动节假期': '劳动',
  '端午节': '端午', '端午假期': '端午',
  '中秋节': '中秋', '中秋假期': '中秋',
  '国庆节': '国庆', '国庆假期': '国庆',
};

export function formatDate(d: Date | dayjs.Dayjs): string {
  return dayjs(d).format('YYYY-MM-DD');
}

export function getTodayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function getMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function getWeekLabel(date: string): string {
  const d = dayjs(date);
  const weekNum = getISOWeekNumber(d.toDate());
  const weekDates = getWeekDates(date);
  const start = dayjs(weekDates[0]);
  const end = dayjs(weekDates[6]);
  const startStr = `${start.month() + 1}月${start.date()}日`;
  const endStr = `${end.month() + 1}月${end.date()}日`;
  return `${d.year()}年 ${startStr}-${endStr} 第${weekNum}周`;
}

export function getDayLabel(date: string): string {
  const d = dayjs(date);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.year()}年${d.month() + 1}月${d.date()}日 星期${weekdays[d.day()]}`;
}

export function getISOWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 3600 * 1000));
}

// Get Monday-based weekday (0=Mon, 6=Sun)
export function getMondayWeekday(date: Date | dayjs.Dayjs): number {
  const d = dayjs(date);
  return (d.day() + 6) % 7;
}

// Get the Monday of the week containing the given date
export function getWeekStart(date: string): dayjs.Dayjs {
  const d = dayjs(date);
  const weekday = (d.day() + 6) % 7; // 0=Mon
  return d.subtract(weekday, 'day');
}

// Get all dates in a week (Mon-Sun) starting from the given date's week
export function getWeekDates(date: string): string[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));
}

// Get all dates for a month grid (6 weeks x 7 days, Mon-based)
export function getMonthGridDates(year: number, month: number): { date: string; isCurrentMonth: boolean }[] {
  const firstOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const firstWeekday = (firstOfMonth.day() + 6) % 7; // 0=Mon
  const gridStart = firstOfMonth.subtract(firstWeekday, 'day');

  const dates: { date: string; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = gridStart.add(i, 'day');
    dates.push({
      date: d.format('YYYY-MM-DD'),
      isCurrentMonth: d.year() === year && d.month() + 1 === month,
    });
  }
  return dates;
}

// Check if a date is today
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayStr();
}

// Check if lunar text is a festival
export function isLunarFestival(lunarText: string): boolean {
  return LUNAR_FESTIVALS.includes(lunarText);
}

// Get short holiday name
export function getShortHolidayName(fullName: string): string {
  return HOLIDAY_SHORT_MAP[fullName] || fullName.substring(0, 2);
}

// Get lunar display text from meta
// ALWAYS returns the plain lunar date text (e.g., "廿一", "初七")
// The backend may return festival names (e.g., "七夕") in the lunar field;
// we convert them back to plain lunar day text.
// Festivals/solar terms/holidays are shown as badges via getDayBadges
export function getLunarDisplay(meta: { lunar: string; holiday: string | null; solar_term: string } | undefined): {
  text: string;
  className: string;
} {
  if (!meta) return { text: '', className: '' };
  const lunarText = meta.lunar || '';
  // If the backend returned a festival name, convert to plain lunar day
  if (lunarText && FESTIVAL_TO_LUNAR_DAY[lunarText]) {
    return { text: FESTIVAL_TO_LUNAR_DAY[lunarText], className: '' };
  }
  return { text: lunarText, className: '' };
}

// Badge type with optional title for tooltip
export interface DayBadge {
  text: string;
  className: string;
  title?: string;
}

// Get badge info for a day
// Shows solar term, holiday, and festival names at top-right corner
export function getDayBadges(meta: {
  is_holiday: boolean;
  is_workday: boolean;
  is_weekend: boolean;
  is_adjust_work: boolean;
  holiday: string | null;
  solar_term: string;
  lunar: string;
  adjust_for: string | null;
} | undefined): DayBadge[] {
  if (!meta) return [];
  const badges: DayBadge[] = [];

  if (meta.is_adjust_work) {
    const tooltip = meta.adjust_for ? `${meta.adjust_for}补班` : '调休补班';
    badges.push({ text: '班', className: 'cal-badge-work', title: tooltip });
  }
  if (meta.is_holiday && meta.holiday) {
    const shortName = getShortHolidayName(meta.holiday);
    badges.push({ text: shortName, className: 'cal-badge-rest', title: meta.holiday });
  }
  // Show solar term as a badge
  if (meta.solar_term) {
    badges.push({ text: meta.solar_term, className: 'cal-badge-term', title: `二十四节气：${meta.solar_term}` });
  }
  // Show lunar festival as a badge (e.g., 七夕, 中元节)
  if (meta.lunar && isLunarFestival(meta.lunar)) {
    badges.push({ text: meta.lunar, className: 'cal-badge-festival', title: `传统节日：${meta.lunar}` });
  }

  return badges;
}

// Get holiday banner info (rest/work indicator)
export function getHolidayBanner(meta: {
  holiday: string | null;
  is_adjust_work: boolean;
  adjust_for: string | null;
  is_weekend: boolean;
  is_workday: boolean;
} | undefined): { text: string; type: 'rest' | 'work' } | null {
  if (!meta) return null;

  if (meta.holiday) {
    return { text: meta.holiday, type: 'rest' };
  }
  if (meta.is_adjust_work) {
    const text = meta.adjust_for ? `补${meta.adjust_for}班` : '调休上班';
    return { text, type: 'work' };
  }
  if (meta.is_weekend && !meta.is_workday) {
    return { text: '周末', type: 'rest' };
  }
  return null;
}

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
