import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Spin, Alert, Segmented, Space, Button, App, Typography, Input, DatePicker, Tag, Collapse,
} from 'antd';
import {
  CopyOutlined, DownloadOutlined, RobotOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import { reportApi } from '../api/report';
import type { ReportPeriod, ReportItem, ReportResult, ReportPeriodStats, ReportUsage } from '../types';

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface ReportModalProps {
  open: boolean;
  period: ReportPeriod; // 初始周期（由「AI总结」下拉入口选定）
  anchorDate: string; // 锚点日期：用于计算默认时间范围（周期内任意一天）
  onClose: () => void;
}

const PERIOD_OPTIONS: { label: string; value: ReportPeriod }[] = [
  { label: '周总结', value: 'week' },
  { label: '月总结', value: 'month' },
  { label: '季度总结', value: 'quarter' },
  { label: '年度总结', value: 'year' },
];

const NOTE_MAX_LEN = 500;
const DATE_FMT = 'YYYY-MM-DD';

/** 根据周期与锚点日期计算默认时间范围（仅作初始填充，用户可手动修改）。
 *  周总结固定默认当前周（本周=周一至周日，与视图/锚点日期无关）；其余周期以锚点日期定位。 */
function getDefaultRange(period: ReportPeriod, anchor: string): [Dayjs, Dayjs] {
  if (period === 'week') {
    const now = dayjs();
    const start = now.subtract((now.day() + 6) % 7, 'day');
    return [start, start.add(6, 'day')];
  }
  const a = dayjs(anchor);
  if (period === 'month') {
    return [a.startOf('month'), a.endOf('month')];
  }
  if (period === 'quarter') {
    const qStartMonth = Math.floor(a.month() / 3) * 3; // 0-based
    const start = a.month(qStartMonth).startOf('month');
    return [start, start.add(2, 'month').endOf('month')];
  }
  return [a.startOf('year'), a.endOf('year')];
}

function rangeKey(r: [Dayjs, Dayjs] | null): string {
  return r ? `${r[0].format(DATE_FMT)}|${r[1].format(DATE_FMT)}` : '';
}

export default function ReportModal({ open, period, anchorDate, onClose }: ReportModalProps) {
  const { message } = App.useApp();
  const [curPeriod, setCurPeriod] = useState<ReportPeriod>(period);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [stats, setStats] = useState<ReportPeriodStats | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [note, setNote] = useState('');
  // 周报三块区域（本周工作 / 下周工作 / 需要协调和帮助）
  const [workDone, setWorkDone] = useState('');
  const [nextWork, setNextWork] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');
  const [report, setReport] = useState<ReportResult | null>(null);
  const [usage, setUsage] = useState<ReportUsage | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  // 提示词模板：defaultPrompt 为系统默认，promptTemplate 为当前编辑内容（本次生成即用，仅月/季/年模式）
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);

  // 防止快速切换范围时旧请求覆盖新结果
  const previewReq = useRef(0);

  const isWeekly = curPeriod === 'week';

  // 打开弹窗：重置状态 + 按入口周期填充默认时间范围 + 查询剩余次数 + 加载提示词模板
  useEffect(() => {
    if (!open) return;
    setReport(null);
    setNote('');
    setStats(null);
    setItems([]);
    setWorkDone('');
    setNextWork('');
    setHelpNeeded('');
    setCurPeriod(period);
    setRange(getDefaultRange(period, anchorDate));
    reportApi
      .getUsage()
      .then(setUsage)
      .catch(() => {});
    reportApi
      .getPrompt()
      .then((p) => {
        setDefaultPrompt(p.default_prompt);
        setPromptTemplate(p.custom_prompt || p.default_prompt);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rangeStr = useMemo(() => rangeKey(range), [range]);

  // 下周范围 = 所选时间段结束后的 7 天（仅周报模式使用）
  const nextRangeStr = useMemo(() => {
    if (!range) return '';
    const nStart = range[1].add(1, 'day');
    return `${nStart.format(DATE_FMT)}|${nStart.add(6, 'day').format(DATE_FMT)}`;
  }, [range]);

  // 周期或时间范围变化时，拉取聚合预览
  // 周报模式：预填三块区域（本周已完成 / 本周未完成 + 下周已安排）
  // 其他模式：按标题聚合的事项清单
  useEffect(() => {
    if (!open || !range) return;
    const id = ++previewReq.current;
    setLoadingPreview(true);
    const [nextStart, nextEnd] = nextRangeStr.split('|');
    reportApi
      .getPreview(
        curPeriod,
        range[0].format(DATE_FMT),
        range[1].format(DATE_FMT),
        isWeekly ? nextStart : undefined,
        isWeekly ? nextEnd : undefined,
      )
      .then((s) => {
        if (id !== previewReq.current) return;
        setStats(s);
        if (isWeekly) {
          // 本周已完成事件 → 本周工作；本周未完成 + 下周已安排 → 下周工作（按标题去重）
          setWorkDone((s.done_titles || []).join('\n'));
          const merged = [...(s.pending_titles || []), ...(s.next_titles || [])];
          setNextWork([...new Set(merged)].join('\n'));
          setItems([]);
        } else {
          setItems((s.aggregated || []).map((it) => ({ ...it })));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (id === previewReq.current) setLoadingPreview(false);
      });
  }, [open, curPeriod, rangeStr, nextRangeStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换周期：重新按锚点日期填充该周期的默认时间范围
  const handlePeriodChange = (p: ReportPeriod) => {
    setCurPeriod(p);
    setReport(null);
    setRange(getDefaultRange(p, anchorDate));
  };

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setReport(null);
      setRange([dates[0], dates[1]]);
    }
  };

  // ==================== 事项整理（月/季/年模式，生成前修改） ====================
  const updateItem = (idx: number, patch: Partial<ReportItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { title: '', count: 1, completed: 0, color: '#4A90D9' }]);
  };

  // ==================== 生成 ====================
  const runGenerate = async (fn: () => Promise<ReportResult>) => {
    setLoading(true);
    try {
      const res = await fn();
      setReport(res);
      if (res.usage) setUsage(res.usage);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; error?: string } } };
      const data = err.response?.data;
      if (data?.code === 'REPORT_LIMIT_EXCEEDED') {
        message.error(data.error || '本月 AI 报告次数已用完');
        setUsage({ month: '', used: 0, limit: 0, remaining: 0 });
      } else {
        message.error(data?.error || '生成失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (!range) return;
    const cleanItems = items
      .map((it) => ({
        title: it.title.trim(),
        count: Math.max(1, Math.floor(it.count || 1)),
        completed: Math.min(Math.max(0, Math.floor(it.completed || 0)), Math.max(1, Math.floor(it.count || 1))),
        color: it.color,
      }))
      .filter((it) => it.title.length > 0);
    runGenerate(() =>
      reportApi.generateAiReport(
        curPeriod,
        range[0].format(DATE_FMT),
        range[1].format(DATE_FMT),
        note.trim() || undefined,
        // 预览成功后始终提交整理后的清单（含用户修改）；预览失败则交给后端自动聚合
        stats ? cleanItems : undefined,
        // 自定义提示词模板：本次编辑立即生效，未填则交给后端（保存的模板或默认模板）
        promptTemplate.trim() || undefined,
      ),
    );
  };

  // 周报模式：将三块内容发送给 AI 润色
  const handleGenerateWeekly = () => {
    if (!range) return;
    runGenerate(() =>
      reportApi.generateWeeklyReport(
        range[0].format(DATE_FMT),
        range[1].format(DATE_FMT),
        workDone,
        nextWork,
        helpNeeded,
      ),
    );
  };

  // ==================== 提示词模板（月/季/年模式） ====================
  const handleSavePrompt = async () => {
    const tpl = promptTemplate.trim();
    if (!tpl) {
      message.error('提示词不能为空');
      return;
    }
    setSavingPrompt(true);
    try {
      const res = await reportApi.savePrompt(tpl);
      message.success('已保存为我的默认模板，下次打开自动带入');
      setPromptTemplate(res.custom_prompt || tpl);
    } catch {
      // 拦截器已提示错误
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleResetPrompt = async () => {
    setSavingPrompt(true);
    try {
      await reportApi.savePrompt('');
      setPromptTemplate(defaultPrompt);
      message.success('已恢复默认模板');
    } catch {
      // 拦截器已提示错误
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      message.success('报告已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择文本复制');
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${curPeriod}-report-${report.stats?.start || rangeStr.split('|')[0] || ''}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remaining = usage?.remaining ?? null;
  const limitExceeded = remaining === 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      title="AI 总结"
      style={{ top: 40 }}
    >
      {/* 周期 + 手动时间范围 */}
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }} wrap>
        <Segmented
          size="small"
          options={PERIOD_OPTIONS}
          value={curPeriod}
          onChange={(v) => handlePeriodChange(v as ReportPeriod)}
          disabled={loading}
        />
        <RangePicker
          size="small"
          allowClear={false}
          value={range}
          onChange={handleRangeChange}
          disabled={loading || loadingPreview}
        />
      </Space>
      {isWeekly ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          手动选择起止日期（默认本周，下周为该时间段后一周）；本周已完成事件自动填入「本周工作」，本周未完成事件与下周已安排事件自动填入「下周工作」，均可编辑修改。
        </Text>
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          手动选择起止日期（默认已按当前周期填充），统计到的事件将聚合展示，可修改后再生成总结。
        </Text>
      )}

      {/* 月度剩余次数 */}
      {remaining !== null && (
        <Alert
          style={{ marginBottom: 12 }}
          type={limitExceeded ? 'warning' : 'info'}
          showIcon
          message={
            limitExceeded
              ? `本月 AI 报告次数已用完（${usage?.limit ?? 0} 次），下月自动恢复`
              : `本月 AI 生成剩余 ${remaining} 次（共 ${usage?.limit ?? 0} 次；仅 AI 成功调用计数，统计报告不消耗）`
          }
        />
      )}

      {isWeekly ? (
        /* ==================== 周报模式：三块可编辑区域 ==================== */
        <>
          <div style={{ marginBottom: 12 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text strong>本周工作</Text>
              {loadingPreview && <Spin size="small" />}
            </Space>
            <TextArea
              rows={5}
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="本周已完成事项（已自动填充，可编辑修改；每行一条）"
              disabled={loading || loadingPreview}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>下周工作</Text>
            <TextArea
              rows={5}
              value={nextWork}
              onChange={(e) => setNextWork(e.target.value)}
              placeholder="本周未完成事项与下周已安排事项（已自动填充，可编辑修改；每行一条）"
              disabled={loading || loadingPreview}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>需要协调和帮助</Text>
            <TextArea
              rows={3}
              value={helpNeeded}
              onChange={(e) => setHelpNeeded(e.target.value)}
              placeholder="需要协调或求助的事项（选填）"
              disabled={loading}
            />
          </div>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleGenerateWeekly}
            loading={loading}
            disabled={limitExceeded || !range}
            style={{ marginBottom: 12 }}
          >
            AI生成
          </Button>
        </>
      ) : (
        /* ==================== 月/季度/年度模式：聚合事项编辑 + 补充说明 + 提示词 ==================== */
        <>
          {/* 统计到的事件：聚合后展示，供用户修改 */}
          <div style={{ marginBottom: 12, border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
              <Text strong>统计到的事项（已按标题聚合）</Text>
              {stats && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  共 {stats.total} 个事件，已完成 {stats.completed}，完成率 {stats.completion_rate}%
                </Text>
              )}
            </Space>

            {loadingPreview ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <Spin size="small" />
              </div>
            ) : (
              <>
                {items.length > 0 ? (
                  <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}>
                    {items.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Input
                          size="small"
                          value={it.title}
                          onChange={(e) => updateItem(idx, { title: e.target.value })}
                          placeholder="事项标题"
                          style={{ flex: 1 }}
                          disabled={loading}
                        />
                        <span style={{ whiteSpace: 'nowrap', color: '#888', fontSize: 12 }}>{it.count} 次</span>
                        <Tag
                          style={{ marginRight: 0 }}
                          color={it.completed === it.count ? 'green' : it.completed > 0 ? 'orange' : 'default'}
                        >
                          {it.completed === it.count
                            ? `已完成 ${it.completed}/${it.count}`
                            : it.completed > 0
                              ? `部分完成 ${it.completed}/${it.count}`
                              : '未完成'}
                        </Tag>
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeItem(idx)}
                          disabled={loading}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    该时间段内暂无事件，可点击下方「添加事项」补充记录。
                  </Text>
                )}
                <Space style={{ width: '100%' }} direction="vertical" size={4}>
                  <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addItem} block disabled={loading}>
                    添加事项
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    可修改标题、删除或新增事项，AI 将按整理后的清单生成总结。
                  </Text>
                </Space>
              </>
            )}
          </div>

          {/* 生成前人工补充输入 */}
          <div style={{ marginBottom: 12 }}>
            <TextArea
              rows={3}
              maxLength={NOTE_MAX_LEN}
              placeholder={`可选：在此补充说明，例如未完成事项的原因、下期计划、重点事项等，AI 会结合生成（最多 ${NOTE_MAX_LEN} 字）`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
              showCount
            />
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleGenerate}
              loading={loading}
              disabled={limitExceeded || !range}
              style={{ marginTop: 8 }}
            >
              生成总结
            </Button>
          </div>

          {/* 提示词设置（可自定义） */}
          <Collapse
            ghost
            style={{ marginBottom: 12 }}
            items={[
              {
                key: 'prompt',
                label: (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    提示词设置（可自定义，默认已内置）
                  </Text>
                ),
                children: (
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                      支持占位符：{'{周期} {时间范围} {用户} {统计数据} {分类统计} {事项清单} {补充说明} {长度预算}'}
                      ，生成时会自动替换为实际数据（至少保留一个占位符）。修改后本次生成立即生效。
                    </Text>
                    <TextArea
                      rows={6}
                      value={promptTemplate}
                      onChange={(e) => setPromptTemplate(e.target.value)}
                      disabled={loading || savingPrompt}
                      style={{ fontSize: 12, fontFamily: 'inherit' }}
                    />
                    <Space style={{ marginTop: 8 }} wrap>
                      <Button
                        size="small"
                        onClick={handleSavePrompt}
                        loading={savingPrompt}
                        disabled={loading || !promptTemplate.trim()}
                      >
                        保存为我的默认
                      </Button>
                      <Button
                        size="small"
                        onClick={handleResetPrompt}
                        loading={savingPrompt}
                        disabled={loading}
                      >
                        恢复默认
                      </Button>
                    </Space>
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {report?.degraded && !loading && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message="未配置 AI 服务，当前显示统计型报告"
          description={
            report.ai_error
              ? `AI 调用失败：${report.ai_error}。请在 .env / docker-compose 中配置 AI_API_KEY 等参数。`
              : '请在 .env 或 docker-compose.yml 中配置 AI_API_BASE / AI_API_KEY / AI_MODEL 后启用 AI 总结。'
          }
        />
      )}

      {report?.truncated && !loading && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message="AI 输出已截断"
          description="生成内容超过模型生成长度上限被截断（已自动用更大额度重试一次）。可在 .env / docker-compose 中调大 AI_MAX_TOKENS 后重新生成。"
        />
      )}

      <div style={{ minHeight: 200, maxHeight: '60vh', overflowY: 'auto', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
            <Spin size="large" />
            <Text type="secondary">AI 生成中，通常需要 10~30 秒，请稍候…</Text>
          </div>
        ) : report ? (
          <>
            <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-end' }} wrap>
              <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                复制
              </Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载 .md
              </Button>
            </Space>
            <div className="report-markdown">
              <ReactMarkdown>{report.markdown}</ReactMarkdown>
            </div>
          </>
        ) : (
          <Text type="secondary">
            {isWeekly
              ? '编辑「本周工作 / 下周工作 / 需要协调和帮助」后点击「AI生成」由 AI 润色'
              : '整理事项（可选补充说明）后点击「生成总结」生成报告'}
          </Text>
        )}
      </div>
    </Modal>
  );
}
