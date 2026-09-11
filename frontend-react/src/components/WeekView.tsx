import { useMemo, useRef, useState } from 'react';
import { Checkbox } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import type { EventsByDate, CalendarMeta, CalendarEvent } from '../types';
import { getWeekDates, isToday, getLunarDisplay, getDayBadges } from '../utils/calendar';

interface WeekViewProps {
  selectedDate: string;
  eventsData: EventsByDate;
  calendarMeta: CalendarMeta;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventToggle: (eventId: number) => void;
  /** 拖拽事件到其它日期；time 可选（拖到时间槽时同时改时间） */
  onEventDrop: (event: CalendarEvent, date: string, time?: string) => void;
  onDayHeaderClick: (date: string) => void;
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
// 拖拽时显示的时间槽（整点）
const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 - 22:00

export default function WeekView({
  selectedDate,
  eventsData,
  calendarMeta,
  onDayClick,
  onEventClick,
  onEventToggle,
  onEventDrop,
  onDayHeaderClick,
}: WeekViewProps) {
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const dragEventRef = useRef<CalendarEvent | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const endDrag = () => {
    dragEventRef.current = null;
    setDragging(false);
    setDragOverDate(null);
  };

  const applyDrop = (dateStr: string, time?: string) => {
    const dragged = dragEventRef.current;
    endDrag();
    if (dragged) onEventDrop(dragged, dateStr, time);
  };

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
        const isDropTarget = dragOverDate === dateStr;

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
              style={{
                padding: '4px 4px',
                gap: 3,
                minHeight: 220,
                ...(isDropTarget ? { outline: '2px dashed #4A90D9', outlineOffset: -2, background: '#eef5fd' } : {}),
              }}
              onClick={() => onDayClick(dateStr)}
              onDragOver={(e) => {
                if (dragEventRef.current == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverDate !== dateStr) setDragOverDate(dateStr);
              }}
              onDragLeave={() => {
                if (dragOverDate === dateStr) setDragOverDate(null);
              }}
              onDrop={(e) => {
                if (dragEventRef.current == null) return;
                e.preventDefault();
                applyDrop(dateStr);
              }}
            >
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`cal-week-event ${ev.completed ? 'completed' : ''}`}
                  style={{ background: ev.color, margin: '0 2px' }}
                  draggable
                  onDragStart={(e) => {
                    dragEventRef.current = ev;
                    setDragging(true);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(ev.id));
                  }}
                  onDragEnd={endDrag}
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
                  {ev.recurrence ? <SyncOutlined style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }} /> : null}
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{ev.title}</span>
                </div>
              ))}

              {dragging ? (
                <div
                  style={{ marginTop: 6, borderTop: '1px dashed #cbd5e1', paddingTop: 4 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginBottom: 3 }}>
                    拖到下方时间设置时间
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                    {HOUR_SLOTS.map((h) => {
                      const label = `${String(h).padStart(2, '0')}:00`;
                      return (
                        <div
                          key={h}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            applyDrop(dateStr, label);
                          }}
                          style={{
                            fontSize: 10,
                            textAlign: 'center',
                            padding: '2px 0',
                            borderRadius: 3,
                            background: '#f1f5f9',
                            color: '#475569',
                            cursor: 'copy',
                          }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
