import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, Button, Space, ColorPicker, App } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { eventsApi } from '../api/events';
import { EVENT_COLORS } from '../utils/calendar';
import type { CalendarEvent } from '../types';

interface EventModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  event?: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventModal({ open, mode, event, defaultDate, onClose, onSaved }: EventModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(EVENT_COLORS[0]);
  const { message } = App.useApp();

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && event) {
        form.setFieldsValue({
          title: event.title,
          date: dayjs(event.date),
          time: event.time ? dayjs(event.time, 'HH:mm') : null,
        });
        setSelectedColor(event.color);
      } else {
        form.setFieldsValue({
          title: '',
          date: dayjs(defaultDate),
          time: null,
        });
        setSelectedColor(EVENT_COLORS[0]);
      }
    }
  }, [open, mode, event, defaultDate, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const dateStr = values.date.format('YYYY-MM-DD');
      const timeStr = values.time ? values.time.format('HH:mm') : null;

      // Validate and normalize color
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      const finalColor = hexPattern.test(selectedColor) ? selectedColor.toUpperCase() : '#4A90D9';

      if (mode === 'edit' && event) {
        await eventsApi.update(event.id, {
          title: values.title,
          date: dateStr,
          time: timeStr,
          color: finalColor,
        });
        message.success('事件已更新');
      } else {
        await eventsApi.create({
          title: values.title,
          date: dateStr,
          time: timeStr,
          color: finalColor,
        });
        message.success('事件已创建');
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
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除事件"${event.title}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          await eventsApi.delete(event.id);
          message.success('事件已删除');
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
      width={420}
    >
      <Form form={form} layout="vertical">
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
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item name="time" label="时间（可选）">
          <TimePicker style={{ width: '100%' }} format="HH:mm" allowClear />
        </Form.Item>

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
