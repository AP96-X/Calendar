import { useMemo } from 'react';
import { Checkbox } from 'antd';
import type { EventsByDate, CalendarMeta, CalendarEvent } from '../types';
import { getWeekDates, isToday, getLunarDisplay, getDayBadges } from '../utils/calendar';

interface WeekViewProps {
  selectedDate: string;
  eventsData: EventsByDate;
  calendarMeta: CalendarMeta;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventToggle: (eventId: number) => void;
  onDayHeaderClick: (date: string) => void;
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function WeekView({
  selectedDate,
  eventsData,
  calendarMeta,
  onDayClick,
  onEventClick,
  onEventToggle,
  onDayHeaderClick,
}: WeekViewProps) {
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      {weekDates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const meta = calendarMeta[dateStr];
        const events = eventsData[dateStr] || [];
        // Only show lunar text and badges - no duplicate holiday banner
        const lunarInfo = getLunarDisplay(meta);
        const badges = getDayBadges(meta);
        const today = isToday(dateStr);
        const dayNum = d.getDate();
        const isWeekend = i >= 5;

        return (
          <div key={dateStr} className="cal-week-col">
            {/* Header - clickable to switch to day view */}
            <div
              className={`cal-week-header ${today ? 'today' : ''}`}
              onClick={() => onDayHeaderClick(dateStr)}
              style={{ cursor: 'pointer', minHeight: 80 }}
            >
              <div style={{ fontSize: 11, color: isWeekend ? '#e74c3c' : '#6b7280' }}>
                {WEEKDAY_NAMES[i]}
              </div>
              <div className="cal-week-num" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                {dayNum}
              </div>
              {/* Badges only - no duplicate banner */}
              <div style={{ height: 16, display: 'flex', gap: 2, justifyContent: 'center', marginTop: 2 }}>
                {badges.map((b, bi) => (
                  <span key={bi} className={`cal-badge ${b.className}`} title={b.title}>{b.text}</span>
                ))}
              </div>
              <div className={`cal-day-lunar ${lunarInfo.className}`} style={{ marginTop: 2 }}>
                {lunarInfo.text}
              </div>
            </div>

            {/* Events area with padding to prevent overflow */}
            <div
              className="cal-week-body"
              style={{ padding: '4px 4px', gap: 3, overflow: 'hidden' }}
              onClick={() => onDayClick(dateStr)}
            >
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`cal-week-event ${ev.completed ? 'completed' : ''}`}
                  style={{ background: ev.color, margin: '0 2px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev);
                  }}
                >
                  <Checkbox
                    checked={ev.completed}
                    onChange={(e) => {
                      e.stopPropagation();
                      onEventToggle(ev.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ transform: 'scale(0.85)' }}
                  />
                  {ev.time && <span className="event-time" style={{ fontSize: 10, opacity: 0.8, flexShrink: 0 }}>{ev.time}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{ev.title}</span>
                </div>
              ))}
              <div
                className="cal-week-add"
                style={{ fontSize: 10, color: '#ccc', textAlign: 'center', padding: '4px 0', marginTop: 'auto', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(dateStr);
                }}
              >
                + 添加
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
