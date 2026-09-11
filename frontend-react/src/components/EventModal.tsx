import { useState, useEffect } from 'react';
import {
  Modal, Form, Input, DatePicker, TimePicker, Button, Space, ColorPicker,
  App, Switch, Select, Segmented, Alert, Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { eventsApi } from '../api/events';
import { EVENT_COLORS, RECURRENCE_LABELS } from '../utils/calendar';
import type { CalendarEvent, EventInput, EventUpdateScope, RecurrenceRule } from '../types';

const { Text } = Typography;

interface EventModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  event?: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

const RECURRENCE_OPTIONS = [
  { label: '不重复', value: '' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每年', value: 'yearly' },
];

export default function EventModal({ open, mode, event, defaultDate, onClose, onSaved }: EventModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(EVENT_COLORS[0]);
  // 重复事件的修改范围：仅此事件 / 整个系列
  const [scope, setScope] = useState<EventUpdateScope>('single');
  const { message } = App.useApp();

  const allDay = Form.useWatch('all_day', form);
  const recurrence = Form.useWatch('recurrence', form);

  const isSeries = mode === 'edit' && !!event?.recurrence_group;

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && event) {
      form.setFieldsValue({
        title: event.title,
        date: dayjs(event.date),
        time_range: event.time
          ? [dayjs(event.time, 'HH:mm'), event.end_time ? dayjs(event.end_time, 'HH:mm') : null]
          : null,
        all_day: !!event.all_day,
        description: event.description || '',
        recurrence: event.recurrence || '',
        recurrence_end: event.recurrence_end ? dayjs(event.recurrence_end) : null,
      });
      setSelectedColor(event.color);
      setScope('single');
    } else {
      form.resetFields();
      form.setFieldsValue({
        title: '',
        date: dayjs(defaultDate),
        time_range: null,
        all_day: false,
        description: '',
        recurrence: '',
        recurrence_end: null,
      });
      setSelectedColor(EVENT_COLORS[0]);
      setScope('single');
    }
  }, [open, mode, event, defaultDate, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const dateStr = values.date.format('YYYY-MM-DD');
      const isAllDay = !!values.all_day;
      const timeStr = !isAllDay && values.time_range?.[0] ? values.time_range[0].format('HH:mm') : null;
      const endTimeStr = !isAllDay && values.time_range?.[1] ? values.time_range[1].format('HH:mm') : null;

      // Validate and normalize color
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      const finalColor = hexPattern.test(selectedColor) ? selectedColor.toUpperCase() : '#4A90D9';

      if (mode === 'edit' && event) {
        // 重复规则不支持在编辑时变更（如需变更请删除后重建），仅更新共享字段
        await eventsApi.update(event.id, {
          title: values.title,
          date: dateStr,
          time: timeStr,
          end_time: endTimeStr,
          all_day: isAllDay,
          description: values.description || '',
          color: finalColor,
        }, isSeries ? scope : 'single');
        message.success(scope === 'series' && isSeries ? '整个系列已更新' : '事件已更新');
      } else {
        const payload: EventInput = {
          title: values.title,
          date: dateStr,
          time: timeStr,
          end_time: endTimeStr,
          all_day: isAllDay,
          description: values.description || '',
          color: finalColor,
        };
        if (values.recurrence) {
          payload.recurrence = values.recurrence as RecurrenceRule;
          payload.recurrence_end = values.recurrence_end
            ? values.recurrence_end.format('YYYY-MM-DD')
            : dayjs(dateStr).add(90, 'day').format('YYYY-MM-DD');
        }
        const res = await eventsApi.create(payload);
        const count = typeof res.count === 'number' ? res.count : 1;
        message.success(count > 1 ? `已创建 ${count} 个重复事件` : '事件已创建');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // Validation error, ignore
        return;
      }
      // API errors handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const deleteSeries = isSeries && scope === 'series';
    Modal.confirm({
      title: deleteSeries ? '确认删除整个系列' : '确认删除',
      content: deleteSeries
        ? `确定要删除重复事件"${event.title}"的整个系列吗？`
        : `确定要删除事件"${event.title}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          await eventsApi.delete(event.id, deleteSeries ? 'series' : 'single');
          message.success(deleteSeries ? '整个系列已删除' : '事件已删除');
          onSaved();
          onClose();
        } catch {
          // handled by interceptor
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Modal
      title={mode === 'add' ? '添加事件' : '编辑事件'}
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {mode === 'edit' ? (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} disabled={loading}>
              删除
            </Button>
          ) : (
            <span />
          )}
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSave} loading={loading}>
              保存
            </Button>
          </Space>
        </div>
      }
      width={460}
    >
      <Form form={form} layout="vertical">
        {isSeries && (
          <Form.Item label="修改范围" style={{ marginBottom: 16 }}>
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as EventUpdateScope)}
              options={[
                { label: '仅此事件', value: 'single' },
                { label: '整个系列', value: 'series' },
              ]}
            />
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {scope === 'series'
                  ? '将更新该系列全部实例的标题/时间/备注/颜色（各自日期保持不变）'
                  : '仅更新当前这一天的事件'}
              </Text>
            </div>
          </Form.Item>
        )}

        <Form.Item
          name="title"
          label="事件标题"
          rules={[{ required: true, message: '请输入事件内容' }]}
        >
          <Input placeholder="输入事件内容..." autoFocus />
        </Form.Item>

        <Form.Item
          name="date"
          label="日期"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            disabled={isSeries && scope === 'series'}
          />
        </Form.Item>

        <Form.Item name="all_day" label="全天事件" valuePropName="checked" style={{ marginBottom: 12 }}>
          <Switch
            size="small"
            onChange={(checked) => {
              if (checked) form.setFieldValue('time_range', null);
            }}
          />
        </Form.Item>

        <Form.Item name="time_range" label="时间范围（可选）">
          <TimePicker.RangePicker
            style={{ width: '100%' }}
            format="HH:mm"
            minuteStep={5}
            allowEmpty={[true, true]}
            disabled={!!allDay}
            placeholder={['开始时间', '结束时间']}
          />
        </Form.Item>

        <Form.Item name="description" label="备注（可选）">
          <Input.TextArea rows={3} maxLength={2000} showCount placeholder="补充说明、地点、参与人等..." />
        </Form.Item>

        {mode === 'add' && (
          <>
            <Form.Item name="recurrence" label="重复" style={{ marginBottom: 12 }}>
              <Select options={RECURRENCE_OPTIONS} />
            </Form.Item>

            {recurrence ? (
              <Form.Item name="recurrence_end" label="重复结束日期">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            ) : null}

            {recurrence ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16, fontSize: 12 }}
                message={`将按「${RECURRENCE_LABELS[recurrence] || recurrence}」重复生成事件；未选择结束日期时默认重复 90 天（最多 400 个实例）。`}
              />
            ) : null}
          </>
        )}

        {mode === 'edit' && event?.recurrence && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16, fontSize: 12 }}
            message={`重复事件：${RECURRENCE_LABELS[event.recurrence] || event.recurrence}${event.recurrence_end ? `，至 ${event.recurrence_end}` : ''}。如需更改重复规则，请删除后重新创建。`}
          />
        )}

        <Form.Item label="颜色标签">
          {/* Preset color quick-pick */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {EVENT_COLORS.map((color) => (
              <div
                key={color}
                className={`cal-color-dot ${selectedColor.toUpperCase() === color.toUpperCase() ? 'selected' : ''}`}
                style={{ background: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
          {/* Custom color: palette + hex input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ColorPicker
              value={selectedColor}
              onChange={(color) => setSelectedColor(color.toHexString().toUpperCase())}
              size="small"
            />
            <Input
              value={selectedColor}
              onChange={(e) => {
                const val = e.target.value.trim();
                setSelectedColor(val);
              }}
              placeholder="#4A90D9"
              style={{ width: 120, textTransform: 'uppercase' }}
              prefix={<span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: selectedColor, border: '1px solid #d9d9d9' }} />}
            />
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
