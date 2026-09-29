import { useEffect, useMemo, useRef } from 'react';
import { Checkbox, Empty, Button, Modal, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CalendarEvent, DayMeta } from '../types';
import { getDayLabel, getLunarDisplay, getDayBadges, RECURRENCE_LABELS, isToday } from '../utils/calendar';

interface DayViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  meta?: DayMeta;
  onEventClick: (event: CalendarEvent) => void;
  onEventToggle: (eventId: number) => void;
  onAddEvent: (date: string) => void;
  onDeleteEvent: (eventId: number) => void;
}

const HOUR_HEIGHT = 56; // 每小时对应的像素高度
const MIN_EVENT_HEIGHT = 26; // 事件方块最小高度
const MIN_EVENT_HEIGHT_WITH_NOTE = 46; // 有备注时的最小高度：容纳标题 + 一行备注
const MIN_DURATION = 30; // 最短显示时长（分钟）
const DEFAULT_DURATION = 60; // 未填结束时间时的默认时长（分钟）
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// 全天 / 未设置时间的事件在时间轴上占用的时段（08:30 ~ 17:30）
const ALL_DAY_START = 8 * 60 + 30;
const ALL_DAY_END = 17 * 60 + 30;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function DayView({
  selectedDate,
  events,
  meta,
  onEventClick,
  onEventToggle,
  onAddEvent,
  onDeleteEvent,
}: DayViewProps) {
  const lunarInfo = getLunarDisplay(meta);
  const badges = getDayBadges(meta);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 全天 / 未设置时间的事件统一按 08:30~17:30 落到时间轴上；其余按实际时间定位
  const { laidOut, laneCount } = useMemo(() => {
    const items = events
      .map((e) => {
        const allDay = !!e.all_day || !e.time;
        if (allDay) {
          return { ev: e, start: ALL_DAY_START, end: ALL_DAY_END, allDay };
        }
        const start = toMinutes(e.time as string);
        const rawEnd = e.end_time ? toMinutes(e.end_time) : start + DEFAULT_DURATION;
        const end = Math.max(rawEnd, start + MIN_DURATION);
        return { ev: e, start, end, allDay };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);

    // 正常情况下同一天不会有时间重叠，这里做泳道兜底（数据异常时并排显示而不是叠在一起）
    const laneEnds: number[] = [];
    const laid = items.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.end);
      } else {
        laneEnds[lane] = it.end;
      }
      return { ...it, lane };
    });

    return { laidOut: laid, laneCount: Math.max(1, laneEnds.length) };
  }, [events]);

  const firstStart = laidOut.length > 0 ? laidOut[0].start : null;

  // 打开某天时自动滚动到第一个事件（无事件则滚到 08:00 附近）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = firstStart != null
      ? (firstStart / 60) * HOUR_HEIGHT - 40
      : 8 * HOUR_HEIGHT;
    el.scrollTop = Math.max(0, target);
  }, [selectedDate, firstStart]);

  const showNowLine = isToday(selectedDate);
  const now = dayjs();
  const nowTop = ((now.hour() * 60 + now.minute()) / 60) * HOUR_HEIGHT;

  const handleDelete = (ev: CalendarEvent) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除事件"${ev.title}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => onDeleteEvent(ev.id),
    });
  };

  return (
    <div style={{ background: 'var(--cal-surface)', borderRadius: 8, boxShadow: '0 1px 3px var(--cal-shadow)', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid var(--cal-primary)' }}>
        <div>
          <h3 style={{ fontSize: 22, marginBottom: 4 }}>{getDayLabel(selectedDate)}</h3>
          <div style={{ fontSize: 14, color: 'var(--cal-text-2)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {lunarInfo.text && <span className={`cal-day-lunar ${lunarInfo.className}`} style={{ fontSize: 14 }}>{lunarInfo.text}</span>}
            {badges.map((b, i) => (
              <span key={i} className={`cal-badge ${b.className}`} title={b.title}>{b.text}</span>
            ))}
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddEvent(selectedDate)}>
          添加事件
        </Button>
      </div>

      {events.length === 0 ? (
        <Empty description="今日暂无事件" style={{ padding: '40px 0' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddEvent(selectedDate)}>
            添加事件
          </Button>
        </Empty>
      ) : (
        <>
          {/* 时间刻度轴 */}
          <div
            ref={scrollRef}
            style={{
              position: 'relative',
              maxHeight: 620,
              overflowY: 'auto',
              border: '1px solid var(--cal-border-subtle)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex' }}>
              {/* 刻度列 */}
              <div style={{ width: 58, flexShrink: 0, background: 'var(--cal-surface-2)' }}>
                {HOURS.map((h) => (
                  <div key={h} style={{ height: HOUR_HEIGHT, position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        top: -7,
                        right: 8,
                        fontSize: 11,
                        color: 'var(--cal-text-3)',
                        background: 'var(--cal-surface-2)',
                        padding: '0 2px',
                      }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* 事件区 */}
              <div style={{ position: 'relative', flex: 1, borderLeft: '1px solid var(--cal-border)' }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: HOUR_HEIGHT,
                      borderTop: h === 0 ? 'none' : '1px solid var(--cal-border-subtle)',
                      background: h % 2 === 0 ? 'var(--cal-surface)' : 'var(--cal-surface-2)',
                    }}
                  />
                ))}

                {/* 当前时间指示线 */}
                {showNowLine && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, borderTop: '2px solid var(--cal-danger)', zIndex: 3, pointerEvents: 'none' }}>
                    <span style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--cal-danger)' }} />
                  </div>
                )}

                {/* 事件方块 */}
                {laidOut.map(({ ev, start, end, lane, allDay }) => {
                  const widthPct = 100 / laneCount;
                  const top = (start / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((end - start) / 60) * HOUR_HEIGHT,
                    ev.description ? MIN_EVENT_HEIGHT_WITH_NOTE : MIN_EVENT_HEIGHT,
                  );
                  return (
                    <div
                      key={ev.id}
                      className={`cal-timeline-event ${ev.completed ? 'completed' : ''}`}
                      style={{
                        top,
                        left: `calc(${lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 6px)`,
                        height,
                        background: ev.color,
                      }}
                      onClick={() => onEventClick(ev)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <Checkbox
                          checked={ev.completed}
                          onChange={(e) => {
                            e.stopPropagation();
                            onEventToggle(ev.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ transform: 'scale(0.8)', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 11, opacity: 0.9, flexShrink: 0 }}>
                          {hhmm(start)}{allDay || ev.end_time ? `-${hhmm(end)}` : ''}
                        </span>
                        {ev.recurrence ? (
                          <Tooltip title={`重复：${RECURRENCE_LABELS[ev.recurrence] || ev.recurrence}`}>
                            <SyncOutlined style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }} />
                          </Tooltip>
                        ) : null}
                        <span className="tl-title" style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.title}
                        </span>
                      </div>
                      {ev.description ? (
                        <div className="tl-desc" style={{ fontSize: 11, lineHeight: '15px', opacity: 0.85, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {ev.description}
                        </div>
                      ) : null}
                      <DeleteOutlined
                        className="tl-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ev);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
