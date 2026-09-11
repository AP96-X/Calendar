import { useCallback, useEffect, useState } from 'react';
import {
  Modal, Input, DatePicker, Select, Segmented, List, Tag, Empty, Spin, Space, Button, Checkbox,
} from 'antd';
import { SearchOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { eventsApi } from '../api/events';
import { EVENT_COLORS, formatEventTime, RECURRENCE_LABELS } from '../utils/calendar';
import type { CalendarEvent } from '../types';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  /** 点击结果：跳转到该事件日期并打开详情 */
  onJump: (event: CalendarEvent) => void;
  /** 结果里直接切换完成状态后回调（用于刷新日历视图） */
  onToggle: (eventId: number) => void;
}

type StatusFilter = 'all' | '0' | '1';

export default function SearchModal({ open, onClose, onJump, onToggle }: SearchModalProps) {
  const [keyword, setKeyword] = useState('');
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [color, setColor] = useState<string>('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.search({
        q: keyword.trim() || undefined,
        start: range?.[0]?.format('YYYY-MM-DD'),
        end: range?.[1]?.format('YYYY-MM-DD'),
        color: color || undefined,
        completed: status === 'all' ? undefined : status,
        limit: 200,
      });
      setResults(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [keyword, range, color, status]);

  // 打开弹窗时先拉一次（默认展示最近事件）
  useEffect(() => {
    if (open) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleToggle = async (ev: CalendarEvent) => {
    await onToggle(ev.id);
    // 本地即时更新，避免整表重查
    setResults((prev) => prev.map((x) => (x.id === ev.id ? { ...x, completed: !x.completed } : x)));
  };

  return (
    <Modal
      title="搜索 / 筛选事件"
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
    >
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索标题或备注..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={runSearch}
            style={{ width: 240 }}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            format="YYYY-MM-DD"
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            value={color}
            onChange={setColor}
            style={{ width: 130 }}
            options={[{ value: '', label: '全部颜色' }, ...EVENT_COLORS.map((c) => ({ value: c, label: c }))]}
          />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
            options={[
              { label: '全部', value: 'all' },
              { label: '未完成', value: '0' },
              { label: '已完成', value: '1' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={runSearch} loading={loading}>
            搜索
          </Button>
        </Space>

        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          共 {results.length} 条结果{results.length >= 200 ? '（已达上限，请缩小范围）' : ''}
        </div>

        <Spin spinning={loading}>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {results.length === 0 && !loading ? (
              <Empty description="没有匹配的事件" style={{ padding: '32px 0' }} />
            ) : (
              <List
                size="small"
                dataSource={results}
                renderItem={(ev) => (
                  <List.Item
                    key={ev.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      onJump(ev);
                      onClose();
                    }}
                    actions={[
                      <Checkbox
                        key="done"
                        checked={ev.completed}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleToggle(ev)}
                      />,
                    ]}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>{ev.date}</span>
                      {formatEventTime(ev) && (
                        <Tag icon={<ClockCircleOutlined />} color="default" style={{ marginInlineEnd: 0 }}>
                          {formatEventTime(ev)}
                        </Tag>
                      )}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          textDecoration: ev.completed ? 'line-through' : 'none',
                          opacity: ev.completed ? 0.55 : 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.title}
                      </span>
                      {ev.recurrence ? (
                        <Tag icon={<SyncOutlined />} color="blue" style={{ marginInlineEnd: 0 }}>
                          {RECURRENCE_LABELS[ev.recurrence] || ev.recurrence}
                        </Tag>
                      ) : null}
                      {ev.description ? (
                        <span style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.description}
                        </span>
                      ) : null}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Spin>
      </Space>
    </Modal>
  );
}
