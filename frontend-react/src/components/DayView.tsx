import { Checkbox, Empty, Button, Space, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { CalendarEvent, DayMeta } from '../types';
import { getDayLabel, getLunarDisplay, getDayBadges } from '../utils/calendar';

interface DayViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  meta?: DayMeta;
  onEventClick: (event: CalendarEvent) => void;
  onEventToggle: (eventId: number) => void;
  onAddEvent: (date: string) => void;
  onDeleteEvent: (eventId: number) => void;
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

  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 24 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #4A90D9' }}>
        <h3 style={{ fontSize: 22, marginBottom: 4 }}>{getDayLabel(selectedDate)}</h3>
        <div style={{ fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {lunarInfo.text && <span className={`cal-day-lunar ${lunarInfo.className}`} style={{ fontSize: 14 }}>{lunarInfo.text}</span>}
          {badges.map((b, i) => (
            <span key={i} className={`cal-badge ${b.className}`} title={b.title}>{b.text}</span>
          ))}
        </div>
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <Empty
          description="今日暂无事件"
          style={{ padding: '40px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => onAddEvent(selectedDate)}>
            添加事件
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`cal-day-view-event ${ev.completed ? 'completed' : ''}`}
              style={{ borderLeftColor: ev.color }}
              onClick={() => onEventClick(ev)}
            >
              <Checkbox
                checked={ev.completed}
                onChange={(e) => {
                  e.stopPropagation();
                  onEventToggle(ev.id);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div style={{ width: 4, height: 40, borderRadius: 2, background: ev.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="event-title" style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.title}
                </div>
                {ev.time && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {ev.time}
                  </div>
                )}
              </div>
              <Space size="small" style={{ flexShrink: 0 }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev);
                  }}
                  title="编辑"
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: '确认删除',
                      content: `确定要删除事件"${ev.title}"吗？`,
                      okText: '删除',
                      okType: 'danger',
                      cancelText: '取消',
                      onOk: () => onDeleteEvent(ev.id),
                    });
                  }}
                  title="删除"
                />
              </Space>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
