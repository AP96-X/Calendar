import { Modal, Button, Space, Tag, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  UndoOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  SyncOutlined,
  ProfileOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CalendarEvent, EventUpdateScope } from '../types';
import { formatEventTime, RECURRENCE_LABELS } from '../utils/calendar';

interface EventDetailModalProps {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: number, scope?: EventUpdateScope) => void;
  onToggleComplete: (eventId: number) => void;
}

export default function EventDetailModal({
  open,
  event,
  onClose,
  onEdit,
  onDelete,
  onToggleComplete,
}: EventDetailModalProps) {
  if (!event) return null;

  const isSeries = !!event.recurrence_group;

  const confirmDelete = (scope: EventUpdateScope) => {
    const series = scope === 'series';
    Modal.confirm({
      title: series ? '确认删除整个系列' : '确认删除',
      content: series
        ? `确定要删除重复事件"${event.title}"的整个系列吗？`
        : `确定要删除事件"${event.title}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        onDelete(event.id, scope);
        onClose();
      },
    });
  };

  const deleteMenu: MenuProps['items'] = [
    { key: 'single', label: '仅删除此事件' },
    { key: 'series', label: '删除整个系列', danger: true },
  ];

  const handleToggleComplete = () => {
    // 完成/取消完成的提示由父级 handleEventToggle 统一显示，避免重复弹出
    onToggleComplete(event.id);
    onClose();
  };

  const handleEdit = () => {
    onClose();
    onEdit(event);
  };

  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const eventDate = dayjs(event.date);
  const weekdayStr = `星期${weekdayNames[eventDate.day()]}`;
  const timeText = formatEventTime(event);

  return (
    <Modal
      title="事件详情"
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isSeries ? (
            <Dropdown
              menu={{
                items: deleteMenu,
                onClick: ({ key }) => confirmDelete(key as EventUpdateScope),
              }}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除 <DownOutlined />
              </Button>
            </Dropdown>
          ) : (
            <Button danger icon={<DeleteOutlined />} onClick={() => confirmDelete('single')}>
              删除
            </Button>
          )}
          <Space>
            <Button
              icon={event.completed ? <UndoOutlined /> : <CheckOutlined />}
              onClick={handleToggleComplete}
              style={event.completed ? { color: '#e74c3c' } : { color: '#27ae60' }}
            >
              {event.completed ? '取消完成' : '标记完成'}
            </Button>
            <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
              编辑
            </Button>
          </Space>
        </div>
      }
      width={440}
    >
      {/* Event title with color indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div
          style={{
            width: 6,
            height: 28,
            borderRadius: 3,
            background: event.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            textDecoration: event.completed ? 'line-through' : 'none',
            opacity: event.completed ? 0.6 : 1,
            wordBreak: 'break-word',
          }}
        >
          {event.title}
        </span>
      </div>

      {/* Status tag */}
      <div style={{ marginBottom: 16 }}>
        {event.completed ? (
          <Tag color="success" style={{ fontSize: 13, padding: '2px 10px' }}>
            <CheckOutlined /> 已完成
          </Tag>
        ) : (
          <Tag color="processing" style={{ fontSize: 13, padding: '2px 10px' }}>
            <ClockCircleOutlined /> 待完成
          </Tag>
        )}
      </div>

      {/* Detail rows */}
      <div
        style={{
          background: '#f8fafc',
          borderRadius: 8,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarOutlined style={{ color: '#6b7280', fontSize: 15 }} />
          <span style={{ color: '#6b7280', fontSize: 13, minWidth: 36 }}>日期</span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {eventDate.format('YYYY年MM月DD日')} {weekdayStr}
          </span>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClockCircleOutlined style={{ color: '#6b7280', fontSize: 15 }} />
          <span style={{ color: '#6b7280', fontSize: 13, minWidth: 36 }}>时间</span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {timeText || '未设置'}
          </span>
        </div>

        {/* Recurrence */}
        {event.recurrence && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SyncOutlined style={{ color: '#6b7280', fontSize: 15 }} />
            <span style={{ color: '#6b7280', fontSize: 13, minWidth: 36 }}>重复</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              {RECURRENCE_LABELS[event.recurrence] || event.recurrence}
              {event.recurrence_end ? `，至 ${event.recurrence_end}` : ''}
            </span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <ProfileOutlined style={{ color: '#6b7280', fontSize: 15, marginTop: 2 }} />
            <span style={{ color: '#6b7280', fontSize: 13, minWidth: 36 }}>备注</span>
            <span style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {event.description}
            </span>
          </div>
        )}

        {/* Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: event.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#6b7280', fontSize: 13, minWidth: 36 }}>标签</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: event.color }}>
            {event.color}
          </span>
        </div>

        {/* Created time */}
        {event.created_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              创建于 {dayjs(event.created_at).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
