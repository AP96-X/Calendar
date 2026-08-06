import { useState, useEffect } from 'react';
import { Modal, Radio, DatePicker, Button, Space, Typography, App, Select } from 'antd';
import dayjs from 'dayjs';
import { eventsApi } from '../api/events';

const { Text } = Typography;

interface ExportModalProps {
  open: boolean;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
}

export default function ExportModal({ open, defaultYear, defaultMonth, onClose }: ExportModalProps) {
  const [mode, setMode] = useState<'month' | 'year' | 'all'>('month');
  const [selectedDate, setSelectedDate] = useState(dayjs(`${defaultYear}-${String(defaultMonth).padStart(2, '0')}-01`));
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [availableYears, setAvailableYears] = useState<number[]>([defaultYear]);
  const { message } = App.useApp();

  // 打开弹窗时获取可用年份列表
  useEffect(() => {
    if (open) {
      eventsApi.getAvailableYears()
        .then((res) => {
          setAvailableYears(res.years);
          if (res.years.length > 0 && !res.years.includes(selectedYear)) {
            setSelectedYear(res.years[res.years.length - 1]);
          }
        })
        .catch(() => {
          // 获取失败时使用当前年份
          setAvailableYears([defaultYear]);
        });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    if (mode === 'all') {
      const url = eventsApi.exportAllUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = 'calendar-all.xlsx';
      a.click();
      message.success('正在导出全部数据...');
    } else if (mode === 'year') {
      const url = eventsApi.exportYearUrl(selectedYear);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calendar-${selectedYear}.xlsx`;
      a.click();
      message.success(`正在导出 ${selectedYear}年 数据...`);
    } else {
      const year = selectedDate.year();
      const month = selectedDate.month() + 1;
      const url = eventsApi.exportExcel(year, month);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calendar-${year}${String(month).padStart(2, '0')}.xlsx`;
      a.click();
      message.success(`正在导出 ${year}年${month}月 数据...`);
    }
    onClose();
  };

  return (
    <Modal
      title="导出日历数据"
      open={open}
      onCancel={onClose}
      width={420}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" onClick={handleExport}>
            开始导出
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          选择要导出的数据范围。导出的 Excel 文件将保留事件的颜色和完成状态（删除线）。
        </Text>
      </div>

      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Radio value="month">
            <span style={{ fontWeight: 500 }}>按月导出</span>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>导出指定月份的数据</Text>
          </Radio>
          {mode === 'month' && (
            <div style={{ marginLeft: 24, marginBottom: 8 }}>
              <DatePicker
                picker="month"
                value={selectedDate}
                onChange={(d) => d && setSelectedDate(d)}
                format="YYYY年MM月"
                style={{ width: '100%' }}
                allowClear={false}
              />
            </div>
          )}
          <Radio value="year">
            <span style={{ fontWeight: 500 }}>按年导出</span>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>导出指定年份的 12 个月数据（分 Sheet）</Text>
          </Radio>
          {mode === 'year' && (
            <div style={{ marginLeft: 24, marginBottom: 8 }}>
              <Select
                value={selectedYear}
                onChange={(v) => setSelectedYear(v)}
                style={{ width: '100%' }}
              >
                {availableYears.map((y) => (
                  <Select.Option key={y} value={y}>{y} 年</Select.Option>
                ))}
              </Select>
            </div>
          )}
          <Radio value="all">
            <span style={{ fontWeight: 500 }}>导出全部数据</span>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>导出当前用户的所有事件（按月份分 Sheet）</Text>
          </Radio>
        </Space>
      </Radio.Group>
    </Modal>
  );
}
