import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button, Segmented, Space, Tooltip, Card, App, Spin, Popover, Dropdown, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  LeftOutlined, RightOutlined, ReloadOutlined,
  ImportOutlined, ExportOutlined, PlusOutlined, InfoCircleOutlined, RobotOutlined, DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import MonthView from '../components/MonthView';
import WeekView from '../components/WeekView';
import DayView from '../components/DayView';
import EventModal from '../components/EventModal';
import EventDetailModal from '../components/EventDetailModal';
import ImportModal from '../components/ImportModal';
import ExportModal from '../components/ExportModal';
import ReportModal from '../components/ReportModal';
import { useAuth } from '../stores/auth';
import { eventsApi } from '../api/events';
import { calendarApi } from '../api/calendar';
import { getTodayStr, getMonthLabel, getWeekLabel, getDayLabel, getWeekDates } from '../utils/calendar';
import type { EventsByDate, CalendarMeta, CalendarEvent, ReportPeriod } from '../types';

const { Text } = Typography;

type ViewMode = 'month' | 'week' | 'day';

// AI 总结入口：周/月/季度/年度下拉选项
const REPORT_MENU_ITEMS: MenuProps['items'] = [
  { key: 'week', label: '周总结' },
  { key: 'month', label: '月总结' },
  { key: 'quarter', label: '季度总结' },
  { key: 'year', label: '年度总结' },
];

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const { message } = App.useApp();

  const now = dayjs();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState(now.year());
  const [currentMonth, setCurrentMonth] = useState(now.month() + 1);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  const [eventsData, setEventsData] = useState<EventsByDate>({});
  const [calendarMeta, setCalendarMeta] = useState<CalendarMeta>({});
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaUpdatedAt, setMetaUpdatedAt] = useState<string>('');

  // Event modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState<'add' | 'edit'>('add');
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState(getTodayStr());

  // Event detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // AI report modal state
  const [reportModal, setReportModal] = useState<{ period: ReportPeriod } | null>(null);

  // AI report anchor date: 月视图锚定当前显示月，周/日视图锚定选中日期
  const reportAnchorDate =
    viewMode === 'month'
      ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
      : selectedDate;

  // Refs for keyboard shortcut access to latest state
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const eventModalOpenRef = useRef(eventModalOpen);
  eventModalOpenRef.current = eventModalOpen;
  const detailModalOpenRef = useRef(detailModalOpen);
  detailModalOpenRef.current = detailModalOpen;
  const importModalOpenRef = useRef(importModalOpen);
  importModalOpenRef.current = importModalOpen;

  // Calculate which months we need to fetch meta for
  const neededMonths = useMemo(() => {
    const months = new Set<string>();
    if (viewMode === 'month') {
      // 42 格网格（周一开头）会覆盖上月末/下月初的补位日期，需拉取这些月份的元数据
      const first = dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
      const firstWeekday = (first.day() + 6) % 7; // 0=Mon
      const gridStart = first.subtract(firstWeekday, 'day');
      const gridEnd = gridStart.add(41, 'day');
      let d = gridStart;
      while (d.isBefore(gridEnd) || d.isSame(gridEnd, 'day')) {
        months.add(`${d.year()}-${String(d.month() + 1).padStart(2, '0')}`);
        d = d.add(1, 'month');
      }
    } else if (viewMode === 'week') {
      const dates = getWeekDates(selectedDate);
      dates.forEach((d) => {
        const dj = dayjs(d);
        months.add(`${dj.year()}-${String(dj.month() + 1).padStart(2, '0')}`);
      });
    } else {
      const dj = dayjs(selectedDate);
      months.add(`${dj.year()}-${String(dj.month() + 1).padStart(2, '0')}`);
    }
    return months;
  }, [viewMode, currentYear, currentMonth, selectedDate]);

  // Fetch calendar meta
  const fetchMeta = useCallback(async () => {
    setMetaLoading(true);
    const newMeta: CalendarMeta = {};
    for (const ym of neededMonths) {
      const [y, m] = ym.split('-').map(Number);
      try {
        const res = await calendarApi.getMeta(y, m);
        Object.assign(newMeta, res);
      } catch {
        // handled by interceptor
      }
    }
    setCalendarMeta(prev => ({ ...prev, ...newMeta }));
    setMetaLoading(false);

    // Fetch meta status for the first month
    const firstYm = Array.from(neededMonths)[0];
    if (firstYm) {
      const [y, m] = firstYm.split('-').map(Number);
      try {
        const status = await calendarApi.getStatus(y, m);
        setMetaUpdatedAt(status.updated_at || '');
      } catch {
        // ignore
      }
    }
  }, [neededMonths]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let data: EventsByDate;
      if (viewMode === 'month') {
        data = await eventsApi.getMonthEvents(currentYear, currentMonth);
      } else if (viewMode === 'week') {
        data = await eventsApi.getWeekEvents(selectedDate);
      } else {
        const dayEvents = await eventsApi.getDayEvents(selectedDate);
        data = dayEvents.length > 0 ? { [selectedDate]: dayEvents } : {};
      }
      setEventsData(data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentYear, currentMonth, selectedDate]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Navigation
  const navigate = useCallback((delta: number) => {
    const vm = viewModeRef.current;
    if (vm === 'month') {
      // Use refs to get latest values, avoid stale closure
      const d = dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`).add(delta, 'month');
      setCurrentYear(d.year());
      setCurrentMonth(d.month() + 1);
    } else if (vm === 'week') {
      setSelectedDate(prev => dayjs(prev).add(delta * 7, 'day').format('YYYY-MM-DD'));
    } else {
      setSelectedDate(prev => dayjs(prev).add(delta, 'day').format('YYYY-MM-DD'));
    }
  }, [currentYear, currentMonth]);

  const goToday = useCallback(() => {
    const today = dayjs();
    setCurrentYear(today.year());
    setCurrentMonth(today.month() + 1);
    setSelectedDate(today.format('YYYY-MM-DD'));
  }, []);

  // Switch to week view from a specific date
  const switchToWeekView = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('week');
  }, []);

  // Switch to day view from a specific date
  const switchToDayView = useCallback((date: string) => {
    setSelectedDate(date);
    setViewMode('day');
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd + Arrow for navigation, Esc to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes any open modal
      if (e.key === 'Escape') {
        if (eventModalOpenRef.current) {
          setEventModalOpen(false);
          return;
        }
        if (detailModalOpenRef.current) {
          setDetailModalOpen(false);
          return;
        }
        if (importModalOpenRef.current) {
          setImportModalOpen(false);
          return;
        }
      }
      // Ctrl/Cmd + Arrow Left/Right for navigation (only when no modal is open)
      if ((e.ctrlKey || e.metaKey) && !eventModalOpenRef.current && !detailModalOpenRef.current && !importModalOpenRef.current) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigate(-1);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigate(1);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Event handlers
  const handleDayClick = (date: string) => {
    setEventModalMode('add');
    setEditingEvent(null);
    setModalDefaultDate(date);
    setEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setDetailEvent(event);
    setDetailModalOpen(true);
  };

  const handleEditFromDetail = (event: CalendarEvent) => {
    setEventModalMode('edit');
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  const handleEventToggle = async (eventId: number) => {
    try {
      const res = await eventsApi.toggle(eventId);
      // Show feedback based on completion state
      if (res.completed) {
        message.success('已完成');
      } else {
        message.info('已取消完成');
      }
      await fetchEvents();
    } catch {
      // handled by interceptor
    }
  };

  const handleEventDelete = async (eventId: number) => {
    try {
      await eventsApi.delete(eventId);
      message.success('事件已删除');
      await fetchEvents();
    } catch {
      // handled by interceptor
    }
  };

  const handleExport = () => {
    setExportModalOpen(true);
  };

  const handleRefreshMeta = async () => {
    if (!isAdmin) return;
    const realYear = new Date().getFullYear();
    const years = [realYear - 1, realYear];
    let successCount = 0;
    let totalMonths = 0;
    for (const yr of years) {
      for (let m = 1; m <= 12; m++) {
        totalMonths++;
        try {
          await calendarApi.refresh(yr, m);
          successCount++;
        } catch {
          // continue on error
        }
      }
    }
    await fetchMeta();
    message.success(`已刷新 ${realYear - 1}~${realYear} 年数据 (${successCount}/${totalMonths} 个月)`);
  };

  // Date label
  const dateLabel = useMemo(() => {
    if (viewMode === 'month') return getMonthLabel(currentYear, currentMonth);
    if (viewMode === 'week') return getWeekLabel(selectedDate);
    return getDayLabel(selectedDate);
  }, [viewMode, currentYear, currentMonth, selectedDate]);

  // Day view events
  const dayViewEvents = useMemo(() => {
    return eventsData[selectedDate] || [];
  }, [eventsData, selectedDate]);

  // Meta tooltip content
  const metaTooltipContent = (
    <div style={{ maxWidth: 280 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>日历数据来源</div>
      <div style={{ marginBottom: 4 }}>
        <Text code style={{ fontSize: 12 }}>lunardate</Text>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>农历日期换算</span>
      </div>
      <div style={{ marginBottom: 4 }}>
        <Text code style={{ fontSize: 12 }}>chinese_calendar</Text>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>中国法定节假日 / 调休</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Text code style={{ fontSize: 12 }}>ephem</Text>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>天文计算二十四节气</span>
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 6, fontSize: 12, color: '#999' }}>
        {metaUpdatedAt ? `最近更新：${metaUpdatedAt}` : '尚未更新'}
      </div>
    </div>
  );

  return (
    <AppLayout
      headerLeft={
        <Space>
          <Button shape="circle" icon={<LeftOutlined />} onClick={() => navigate(-1)} />
          <span className="app-date-label" style={{ fontSize: 18, fontWeight: 600, minWidth: 200, textAlign: 'center', display: 'inline-block' }}>
            {dateLabel}
          </span>
          <Button shape="circle" icon={<RightOutlined />} onClick={() => navigate(1)} />
          <Button onClick={goToday}>今天</Button>
        </Space>
      }
      headerExtra={
        <Space wrap className="app-header-actions">
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: '月视图', value: 'month' },
              { label: '周视图', value: 'week' },
              { label: '日视图', value: 'day' },
            ]}
          />
          <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>导入</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          <Dropdown
            menu={{
              items: REPORT_MENU_ITEMS,
              onClick: ({ key }) => setReportModal({ period: key as ReportPeriod }),
            }}
            placement="bottomRight"
          >
            <Button icon={<RobotOutlined />}>
              AI总结 <DownOutlined />
            </Button>
          </Dropdown>
          {isAdmin && (
            <>
              <Tooltip title="刷新日历元数据（农历/节气/节假日）">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshMeta}
                  loading={metaLoading}
                >
                  刷新数据
                </Button>
              </Tooltip>
              <Popover content={metaTooltipContent} trigger="hover" placement="bottomRight">
                <Button type="text" icon={<InfoCircleOutlined />} />
              </Popover>
            </>
          )}
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Card variant="borderless" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {viewMode === 'month' && (
            <MonthView
              year={currentYear}
              month={currentMonth}
              eventsData={eventsData}
              calendarMeta={calendarMeta}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
              onEventToggle={handleEventToggle}
              onWeekNumClick={(date) => switchToWeekView(date)}
              onDayNumClick={(date) => switchToDayView(date)}
            />
          )}
          {viewMode === 'week' && (
            <WeekView
              selectedDate={selectedDate}
              eventsData={eventsData}
              calendarMeta={calendarMeta}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
              onEventToggle={handleEventToggle}
              onDayHeaderClick={(date) => switchToDayView(date)}
            />
          )}
          {viewMode === 'day' && (
            <DayView
              selectedDate={selectedDate}
              events={dayViewEvents}
              meta={calendarMeta[selectedDate]}
              onEventClick={handleEventClick}
              onEventToggle={handleEventToggle}
              onAddEvent={handleDayClick}
              onDeleteEvent={handleEventDelete}
            />
          )}
        </Card>
      </Spin>

      {/* Floating add button */}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<PlusOutlined />}
        className="app-fab"
        onClick={() => handleDayClick(viewMode === 'month' ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayjs().date()).padStart(2, '0')}` : selectedDate)}
        style={{
          position: 'fixed',
          right: 32,
          bottom: 32,
          width: 56,
          height: 56,
          boxShadow: '0 4px 12px rgba(74, 144, 217, 0.4)',
          zIndex: 200,
        }}
      />

      <EventModal
        open={eventModalOpen}
        mode={eventModalMode}
        event={editingEvent}
        defaultDate={modalDefaultDate}
        onClose={() => setEventModalOpen(false)}
        onSaved={fetchEvents}
      />

      <EventDetailModal
        open={detailModalOpen}
        event={detailEvent}
        onClose={() => setDetailModalOpen(false)}
        onEdit={handleEditFromDetail}
        onDelete={handleEventDelete}
        onToggleComplete={handleEventToggle}
      />

      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={fetchEvents}
      />

      <ExportModal
        open={exportModalOpen}
        defaultYear={currentYear}
        defaultMonth={currentMonth}
        onClose={() => setExportModalOpen(false)}
      />

      <ReportModal
        open={!!reportModal}
        period={reportModal?.period || 'week'}
        anchorDate={reportAnchorDate}
        onClose={() => setReportModal(null)}
      />
    </AppLayout>
  );
}
