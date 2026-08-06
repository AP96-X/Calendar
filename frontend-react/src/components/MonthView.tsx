import { useMemo } from 'react';
import { Checkbox } from 'antd';
import dayjs from 'dayjs';
import type { EventsByDate, CalendarMeta, CalendarEvent } from '../types';
import {
  getMonthGridDates,
  isToday,
  getLunarDisplay,
  getDayBadges,
  getISOWeekNumber,
} from '../utils/calendar';

interface MonthViewProps {
  year: number;
  month: number;
  eventsData: EventsByDate;
  calendarMeta: CalendarMeta;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventToggle: (eventId: number) => void;
  onWeekNumClick: (date: string) => void;
  onDayNumClick: (date: string) => void;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_EVENTS_SHOW = 3;

export default function MonthView({
  year,
  month,
  eventsData,
  calendarMeta,
  onDayClick,
  onEventClick,
  onEventToggle,
  onWeekNumClick,
  onDayNumClick,
}: MonthViewProps) {
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);

  // Calculate week numbers for each row
  const weekNumbers = useMemo(() => {
    const nums: number[] = [];
    for (let row = 0; row < 6; row++) {
      const weekStartDate = dayjs(gridDates[row * 7].date);
      nums.push(getISOWeekNumber(weekStartDate.toDate()));
    }
    return nums;
  }, [gridDates]);

  return (
    <div>
      {/* Weekday header - 六/日 already in red, no need to mark weekends in cells */}
      <div className="cal-month-header" style={{ display: 'grid', gridTemplateColumns: '36px repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>周次</div>
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            style={{
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: i >= 5 ? '#e74c3c' : '#6b7280',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="cal-month-grid" style={{ display: 'grid', gridTemplateColumns: '36px repeat(7, 1fr)' }}>
        {gridDates.map((cell, idx) => {
          const row = Math.floor(idx / 7);
          const col = idx % 7;

          // Render week number cell at the start of each row
          const cells: React.ReactNode[] = [];

          if (col === 0) {
            cells.push(
              <div
                key={`week-${row}`}
                onClick={() => onWeekNumClick(cell.date)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#6b7280',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e8f0fe';
                  e.currentTarget.style.color = '#4A90D9';
                  e.currentTarget.style.fontWeight = '600';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#6b7280';
                  e.currentTarget.style.fontWeight = 'normal';
                }}
              >
                {weekNumbers[row]}
              </div>
            );
          }

          const meta = calendarMeta[cell.date];
          const events = eventsData[cell.date] || [];
          // Only show lunar text (no duplicate holiday text - badges already show holiday info)
          const lunarInfo = getLunarDisplay(meta);
          const badges = getDayBadges(meta);
          const today = isToday(cell.date);

          cells.push(
            <div
              key={cell.date}
              className={`cal-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${today ? 'today' : ''}`}
              onClick={() => onDayClick(cell.date)}
            >
              {/* Day header: number + badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                <span
                  className="cal-day-num"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayNumClick(cell.date);
                  }}
                  title="查看当日"
                >
                  {parseInt(cell.date.split('-')[2], 10)}
                </span>
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {badges.map((b, i) => (
                    <span key={i} className={`cal-badge ${b.className}`} title={b.title}>{b.text}</span>
                  ))}
                </div>
              </div>
              {/* Lunar text only (no holiday banner to avoid duplication) */}
              <div className={`cal-day-lunar ${lunarInfo.className}`}>
                {lunarInfo.text}
              </div>

              {/* Events - flex-1 to fill remaining space for click area */}
              <div className="cal-day-events" style={{ flex: 1, minHeight: 40 }}>
                {events.slice(0, MAX_EVENTS_SHOW).map((ev) => (
                  <div
                    key={ev.id}
                    className={`cal-mini-event ${ev.completed ? 'completed' : ''}`}
                    style={{ background: ev.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                  >
                    {/* Desktop: checkbox; Mobile: hidden, use dot instead */}
                    <Checkbox
                      checked={ev.completed}
                      onChange={(e) => {
                        e.stopPropagation();
                        onEventToggle(ev.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        transform: 'scale(0.75)',
                        '--ant-color-primary': 'rgba(255,255,255,0.8)',
                      } as React.CSSProperties}
                    />
                    <span className="cal-mini-text" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.time && <span style={{ opacity: 0.8, marginRight: 2 }}>{ev.time}</span>}
                      {ev.title}
                    </span>
                  </div>
                ))}
                {events.length > MAX_EVENTS_SHOW && (
                  <div
                    className="cal-more-events"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayNumClick(cell.date);
                    }}
                  >
                    +{events.length - MAX_EVENTS_SHOW} 更多
                  </div>
                )}
              </div>
            </div>
          );

          return cells;
        })}
      </div>
    </div>
  );
}
