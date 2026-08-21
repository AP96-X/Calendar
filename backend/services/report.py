# -*- coding: utf-8 -*-
"""AI 周报/月报/季报/年报生成 —— 数据聚合 + OpenAI 兼容 LLM 调用。

- 周期支持：week（周）、month（月）、quarter（季度）、year（年度）；
  时间范围由前端手动选择（start/end），未传时回退到「当前周期」默认范围。
- 生成前用户可查看并整理聚合后的事项清单（改名/删除/新增），
  整理结果随请求（items）提交，AI 按整理后清单生成总结。
- 提示词模板化：默认模板 DEFAULT_PROMPT_TEMPLATE 展示给用户，支持占位符
  （{周期} {时间范围} {用户} {统计数据} {分类统计} {事项清单} {补充说明} {长度预算}），
  用户可自定义并保存到 user_report_prompts 表（每用户一行），生成时按
  「请求 prompt > 用户已存模板 > 默认模板」优先级取用。
- 未配置 AI（AI_API_KEY 为空）或调用失败时，自动降级为统计型报告。
- 使用 urllib（标准库）调用 OpenAI 兼容 /chat/completions 协议，
  可对接 DeepSeek、通义、Moonshot、OpenAI 及本地 Ollama（AI_PROVIDER=ollama）。
- 月度调用次数限制：每个用户每月最多 AI_MONTHLY_LIMIT 次（仅 AI 成功调用计数，
  降级统计报告与聚合预览不消耗次数）。
"""

import json
import urllib.request
import urllib.error
from datetime import date, datetime, timedelta

from ..config import (
    AI_REPORT_ENABLED, AI_PROVIDER, AI_API_BASE, AI_API_KEY,
    AI_MODEL, AI_TIMEOUT, AI_MAX_TOKENS, AI_MONTHLY_LIMIT,
)
from ..database import get_db, db_now

_PERIOD_CN = {'week': '周', 'month': '月', 'quarter': '季度', 'year': '年度'}
_REPORT_TITLES = {'week': '周总结', 'month': '月总结', 'quarter': '季度总结', 'year': '年度总结'}

# ==================== 提示词模板 ====================
# 支持占位符：{周期} {时间范围} {用户} {统计数据} {分类统计} {事项清单} {补充说明} {长度预算}
PROMPT_PLACEHOLDERS = (
    '周期', '时间范围', '用户', '统计数据', '分类统计', '事项清单', '补充说明', '长度预算',
)
# 提示词模板最大长度（字符）
PROMPT_MAX_LEN = 2000

DEFAULT_PROMPT_TEMPLATE = """你是用户的个人日程助手。请根据以下{周期}（{时间范围}）的日程数据生成一份中文 Markdown 报告。
用户：{用户}
周期：{时间范围}
{统计数据}
{分类统计}
{事项清单}
{补充说明}

请输出 Markdown 格式报告，结构如下：
1. **{周期}总结**：1-2 句整体情况（结合完成率与事件量）。
2. **本{周期}做的事**：只列出已开始/已完成的事项（相同事件整合为一条，不要按天罗列），说明次数与完成状态。
3. **下{周期}要做的事**：基于未完成事项与用户补充说明，给出 1-5 条具体计划。
4. **建议**（可选）：1-2 条针对性建议。
要求：语气专业简洁；只使用提供的数据和用户补充说明，不要编造；总长度不超过 {长度预算} 字，完整覆盖上面的事项清单，不要省略。"""


def _parse_date(d):
    if isinstance(d, str):
        return datetime.strptime(d, '%Y-%m-%d').date()
    return d


def get_period_range(period, anchor_date=None, offset=0):
    """返回当前（或往前 offset 个）周期的 (start, end, label)。

    period: 'week' | 'month' | 'quarter' | 'year'
    anchor_date: 周期内任意一天（默认今天）
    offset: 0=当前周期, 1=上一周期
    """
    anchor = _parse_date(anchor_date) if anchor_date else date.today()
    if period == 'week':
        start = anchor - timedelta(days=anchor.weekday())
        start -= timedelta(weeks=offset)
        end = start + timedelta(days=6)
        label = f'{start.strftime("%Y-%m-%d")} ~ {end.strftime("%Y-%m-%d")}'
    elif period == 'month':
        first = anchor.replace(day=1)
        if offset:
            y, m = (first.year, first.month - 1) if first.month > 1 else (first.year - 1, 12)
            first = date(y, m, 1)
        last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        start, end = first, last
        label = f'{start.year}年{start.month}月'
    elif period == 'quarter':
        q = (anchor.month - 1) // 3  # 0-based
        if offset:
            total = anchor.year * 4 + q - offset
            first = date(total // 4, (total % 4) * 3 + 1, 1)
        else:
            first = date(anchor.year, q * 3 + 1, 1)
        last = (date(first.year, first.month + 2, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        start, end = first, last
        label = f'{start.year}年第{(start.month - 1) // 3 + 1}季度'
    elif period == 'year':
        y = anchor.year - offset
        start, end = date(y, 1, 1), date(y, 12, 31)
        label = f'{y}年'
    else:
        raise ValueError(f'未知周期: {period}')
    return start, end, label


def build_period_stats(uid, period, start=None, end=None, offset=0):
    """聚合指定时间范围内某用户的事件统计（不依赖 LLM）。

    事件按标题去重合并（相同标题视为同一事项，记录出现次数与完成数量），
    报告不再按天罗列。start/end 手动指定时以其为准，否则回退默认周期。
    """
    if start and end:
        start_d = _parse_date(start)
        end_d = _parse_date(end)
        if end_d < start_d:
            raise ValueError('结束日期不能早于开始日期')
        label = f'{start_d.strftime("%Y-%m-%d")} ~ {end_d.strftime("%Y-%m-%d")}'
    else:
        start_d, end_d, label = get_period_range(period, None, offset)

    db = get_db()
    rows = db.execute(
        'SELECT * FROM events WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, time',
        (uid, start_d.strftime('%Y-%m-%d'), end_d.strftime('%Y-%m-%d'))
    ).fetchall()

    total = len(rows)
    completed = sum(1 for r in rows if r['completed'])
    by_color = {}
    aggregated = {}  # title -> {title, count, completed, color}
    for r in rows:
        color = r['color'] or '#4A90D9'
        c = by_color.setdefault(color, {'total': 0, 'completed': 0})
        c['total'] += 1
        if r['completed']:
            c['completed'] += 1
        key = r['title']
        agg = aggregated.setdefault(key, {
            'title': key, 'count': 0, 'completed': 0, 'color': color,
        })
        agg['count'] += 1
        if r['completed']:
            agg['completed'] += 1

    events = [{
        'title': r['title'], 'date': r['date'], 'time': r['time'] or '',
        'color': r['color'] or '#4A90D9', 'completed': bool(r['completed']),
    } for r in rows]

    return {
        'period': period,
        'label': label,
        'start': start_d.strftime('%Y-%m-%d'),
        'end': end_d.strftime('%Y-%m-%d'),
        'total': total,
        'completed': completed,
        'pending': total - completed,
        'completion_rate': round(completed / total * 100, 1) if total else 0,
        'by_color': by_color,
        # 相同事件已整合：按标题合并，count 为出现次数
        'aggregated': list(aggregated.values()),
        'events': events,
    }


def validate_items(items):
    """校验用户整理后的事项清单，非法时抛 ValueError。"""
    if not isinstance(items, list):
        raise ValueError('items 必须为数组')
    if len(items) > 200:
        raise ValueError('事项清单最多 200 条')
    for it in items:
        if not isinstance(it, dict):
            raise ValueError('事项条目格式错误')
        title = it.get('title')
        if not isinstance(title, str) or not title.strip():
            raise ValueError('事项标题不能为空')
        try:
            count = int(it.get('count', 1))
            completed = int(it.get('completed', 0))
        except (TypeError, ValueError):
            raise ValueError('事项次数必须为整数')
        if count < 1 or count > 9999:
            raise ValueError('事项次数需在 1~9999 之间')
        if completed < 0 or completed > count:
            raise ValueError('完成数量需在 0~次数 之间')
    return True


# ==================== 周报三块区域（本周工作/下周工作/需要协调和帮助） ====================
# 每个区域的文字内容最大长度（字符）
WEEKLY_SECTION_MAX_LEN = 2000


def build_weekly_sections(uid, start, end, next_start, next_end):
    """周报三块区域预填数据（均按标题去重、按最早日期排序）：
    - done_titles：本周已完成事件标题
    - pending_titles：本周未完成事件标题
    - next_titles：下周已安排事件标题
    """
    db = get_db()

    def _titles(where, params):
        rows = db.execute(
            'SELECT title FROM events WHERE user_id = ? AND ' + where +
            ' GROUP BY title ORDER BY MIN(date), MIN(time)',
            params,
        ).fetchall()
        return [r['title'] for r in rows]

    done_titles = _titles('completed = 1 AND date >= ? AND date <= ?', (uid, start, end))
    pending_titles = _titles('completed = 0 AND date >= ? AND date <= ?', (uid, start, end))
    next_titles = _titles('date >= ? AND date <= ?', (uid, next_start, next_end))
    return {
        'done_titles': done_titles,
        'pending_titles': pending_titles,
        'next_titles': next_titles,
    }


def build_weekly_prompt(work_done, next_work, help_needed):
    """周报润色 prompt：把用户整理的三块内容交给 AI 润色。"""
    lines = ['你是用户的个人日程助手。请将用户整理的周报草稿润色为一份简洁、专业、条理清晰的中文 Markdown 周报。']
    lines.append('要求：')
    lines.append('1. 完整保留用户提供的内容，不要遗漏，也不要编造用户未写的内容；')
    lines.append('2. 润色措辞、合并同类项、补充必要的连接语，使读起来通顺专业；')
    lines.append('3. 固定输出以下结构（Markdown 二级标题）：')
    lines.append('## 本周工作')
    lines.append('（内容）')
    lines.append('## 下周工作')
    lines.append('（内容）')
    lines.append('## 需要协调和帮助')
    lines.append('（内容；若用户未填写则写「暂无」）')
    lines.append('')
    lines.append('以下是用户整理的周报草稿：')
    lines.append('【本周工作】')
    lines.append(work_done or '（空）')
    lines.append('【下周工作】')
    lines.append(next_work or '（空）')
    lines.append('【需要协调和帮助】')
    lines.append(help_needed or '（空）')
    return '\n'.join(lines)


def build_weekly_fallback(work_done, next_work, help_needed):
    """周报降级：不依赖 LLM，按固定结构原样输出三块内容。"""
    lines = ['# 周报', '']
    lines.append('## 本周工作')
    lines.append(work_done or '- 暂无')
    lines.append('')
    lines.append('## 下周工作')
    lines.append(next_work or '- 暂无')
    lines.append('')
    lines.append('## 需要协调和帮助')
    lines.append(help_needed or '- 暂无')
    return '\n'.join(lines)


def generate_weekly_report(uid, work_done='', next_work='', help_needed='', user=None):
    """生成周报：将用户整理的三块内容交由 AI 润色；失败/未配置时降级原样输出。

    返回 (result_dict, http_status)；额度不足时 status=429。
    """
    ok, usage = check_usage_available(uid)
    if not ok:
        return {
            'success': False,
            'error': f'本月 AI 报告次数已用完（{AI_MONTHLY_LIMIT} 次），下月自动恢复',
            'code': 'REPORT_LIMIT_EXCEEDED',
            'usage': usage,
        }, 429

    markdown = None
    model = None
    degraded = True
    ai_error = None
    truncated = False

    if AI_REPORT_ENABLED and AI_API_KEY:
        try:
            if user is None:
                db = get_db()
                user = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
            prompt = build_weekly_prompt(work_done, next_work, help_needed)
            markdown, finish = call_llm(prompt)
            if finish == 'length':
                markdown, finish = call_llm(prompt, max_tokens=min(AI_MAX_TOKENS * 2, 8192))
            truncated = finish == 'length'
            if truncated:
                markdown = markdown.rstrip() + '\n\n> ⚠️ 提示：AI 输出超过生成长度上限被截断，可调大 AI_MAX_TOKENS 后重新生成。'
            model = AI_MODEL
            degraded = False
            # 仅 AI 成功调用计数，降级报告不消耗次数
            consume_usage(uid)
            usage = get_usage_payload(uid)
        except Exception as e:  # noqa: BLE001 —— AI 失败不应阻断报告
            ai_error = str(e)

    if markdown is None:
        markdown = build_weekly_fallback(work_done, next_work, help_needed)

    return {
        'success': True,
        'period': 'week',
        'markdown': markdown,
        'stats': None,
        'events': [],
        'model': model,
        'degraded': degraded,
        'truncated': truncated,
        'ai_error': ai_error,
        'usage': usage,
        'generated_at': db_now(),
    }, 200


def render_prompt(template, stats, user, note='', items=None):
    """将提示词模板中的占位符替换为实际数据，返回完整 prompt。

    占位符：{周期} {时间范围} {用户} {统计数据} {分类统计} {事项清单} {补充说明} {长度预算}
    """
    period_cn = _PERIOD_CN.get(stats['period'], '')
    event_items = items if items is not None else stats['aggregated']
    n_items = len(event_items) if event_items else 0
    # 长度预算随事项数量自适应，避免事项多时被强制压缩导致内容不完整
    char_budget = min(300 + n_items * 20, 1500)

    stats_line = (
        f'事件总数：{stats["total"]}，已完成 {stats["completed"]}，'
        f'未完成 {stats["pending"]}，完成率 {stats["completion_rate"]}%'
    )
    color_block = ''
    if stats['by_color']:
        color_block = '分类统计：' + '，'.join(
            f'颜色{color} {v["total"]} 个（完成 {v["completed"]}）'
            for color, v in stats['by_color'].items()
        )

    if event_items:
        item_lines = ['整合后的事项清单（相同事件已合并，括号内为出现次数；已按用户整理）：']
        for agg in event_items:
            status = f"已完成 {agg['completed']}/{agg['count']}" if agg['completed'] else '未完成'
            item_lines.append(f"- {agg['title']}（{agg['count']} 次，{status}）")
        items_block = '\n'.join(item_lines)
    else:
        items_block = '该时间段内暂无事件'

    note_block = ''
    if note:
        note_block = f'用户补充说明（请结合到报告中，不要忽略）：\n{note}'

    mapping = {
        '周期': period_cn,
        '时间范围': stats['label'],
        '用户': user['display_name'] or user['username'],
        '统计数据': stats_line,
        '分类统计': color_block,
        '事项清单': items_block,
        '补充说明': note_block,
        '长度预算': str(char_budget),
    }
    prompt = template
    for key, value in mapping.items():
        prompt = prompt.replace(f'{{{key}}}', value)
    return prompt


def validate_prompt_template(template):
    """校验自定义提示词模板，非法时抛 ValueError。"""
    if not isinstance(template, str):
        raise ValueError('prompt 必须为字符串')
    template = template.strip()
    if not template:
        raise ValueError('提示词不能为空')
    if len(template) > PROMPT_MAX_LEN:
        raise ValueError(f'提示词不能超过 {PROMPT_MAX_LEN} 字')
    if not any(f'{{{p}}}' in template for p in PROMPT_PLACEHOLDERS):
        raise ValueError(
            f'提示词必须包含至少一个数据占位符（如 {{{PROMPT_PLACEHOLDERS[0]}}}、'
            f'{{{PROMPT_PLACEHOLDERS[-3]}}}），否则 AI 拿不到你的日程数据'
        )
    return True


def get_user_prompt(uid):
    """读取用户保存的自定义提示词模板；未保存返回 None。"""
    db = get_db()
    row = db.execute(
        'SELECT prompt_template FROM user_report_prompts WHERE user_id = ?', (uid,)
    ).fetchone()
    return row['prompt_template'] if row else None


def save_user_prompt(uid, template):
    """保存用户自定义提示词模板（每用户一行，覆盖旧值）。"""
    db = get_db()
    db.execute(
        'INSERT OR REPLACE INTO user_report_prompts (user_id, prompt_template, updated_at) '
        'VALUES (?, ?, ?)',
        (uid, template, db_now()),
    )
    db.commit()


def reset_user_prompt(uid):
    """删除用户自定义提示词，恢复使用默认模板。"""
    db = get_db()
    db.execute('DELETE FROM user_report_prompts WHERE user_id = ?', (uid,))
    db.commit()


def build_prompt(stats, user, note='', items=None, template=None):
    """组装中文 prompt。只注入用户自己的数据。

    报告格式要求：相同事件整合为一条（不按天罗列），
    只输出「本期做的事」与「下期要做的事」。
    传入 items 时按用户整理后的事项清单生成；template 为自定义提示词模板
    （缺省使用 DEFAULT_PROMPT_TEMPLATE）。
    """
    if template is None:
        template = DEFAULT_PROMPT_TEMPLATE
    return render_prompt(template, stats, user, note, items)


def call_llm(prompt, max_tokens=None):
    """调用 OpenAI 兼容 /chat/completions（或 Ollama /api/chat）。

    返回 (text, finish_reason)；失败抛异常。finish_reason='length' 表示输出被截断。
    """
    mt = max_tokens or AI_MAX_TOKENS
    if AI_PROVIDER == 'ollama':
        url = f'{AI_API_BASE}/api/chat'
        payload = {
            'model': AI_MODEL,
            'messages': [
                {'role': 'system', 'content': '你是一个专业的中文日程总结助手。'},
                {'role': 'user', 'content': prompt},
            ],
            'stream': False,
            'options': {'num_predict': mt},
        }
        headers = {'Content-Type': 'application/json'}
    else:
        url = f'{AI_API_BASE}/chat/completions'
        payload = {
            'model': AI_MODEL,
            'messages': [
                {'role': 'system', 'content': '你是一个专业的中文日程总结助手。'},
                {'role': 'user', 'content': prompt},
            ],
            'temperature': 0.7,
            'max_tokens': mt,
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {AI_API_KEY}',
        }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=AI_TIMEOUT) as resp:
            body = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'AI 服务返回 {e.code}: {e.read().decode("utf-8", "ignore")[:200]}') from e
    except urllib.error.URLError as e:
        raise RuntimeError(f'AI 服务连接失败: {e.reason}') from e

    if AI_PROVIDER == 'ollama':
        # Ollama /api/chat 返回 {"message": {"content": ...}, "done_reason": ...}
        try:
            text = body['message']['content'].strip()
            finish = body.get('done_reason') or body.get('finish_reason') or 'stop'
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f'AI 响应格式异常: {str(body)[:200]}') from None
    else:
        try:
            choice = body['choices'][0]
            text = choice['message']['content'].strip()
            finish = choice.get('finish_reason') or 'stop'
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f'AI 响应格式异常: {str(body)[:200]}') from None

    return text, finish


def build_fallback_report(stats, note='', items=None):
    """降级：纯统计型 Markdown 报告（不依赖 LLM）。相同事件整合为一条。"""
    title = _REPORT_TITLES.get(stats['period'], stats['period'])
    period_cn = _PERIOD_CN.get(stats['period'], '')
    lines = [f'# {title}（{stats["label"]}）', '']
    lines.append(f'- 事件总数：**{stats["total"]}** 个')
    lines.append(f'- 已完成：**{stats["completed"]}** 个（完成率 {stats["completion_rate"]}%）')
    lines.append(f'- 未完成：**{stats["pending"]}** 个')
    lines.append('')
    lines.append(f'## 本{period_cn}做的事')
    event_items = items if items is not None else stats['aggregated']
    if event_items:
        for agg in event_items:
            if agg['count'] > 1:
                if agg['completed'] == agg['count']:
                    lines.append(f'- ✅ {agg["title"]}（{agg["count"]} 次，已完成）')
                elif agg['completed'] == 0:
                    lines.append(f'- ⬜ {agg["title"]}（{agg["count"]} 次，未完成）')
                else:
                    lines.append(f'- 🟡 {agg["title"]}（{agg["count"]} 次，完成 {agg["completed"]}/{agg["count"]}）')
            else:
                status = '✅' if agg['completed'] else '⬜'
                lines.append(f'- {status} {agg["title"]}')
    else:
        lines.append('- 该时间段内暂无事件')
    if note:
        lines.append('')
        lines.append('## 用户补充说明')
        lines.append(note)
    return '\n'.join(lines)


# ==================== 月度次数限制 ====================

def get_usage_payload(uid):
    """返回当月使用情况：{month, used, limit, remaining}。"""
    month = date.today().strftime('%Y-%m')
    db = get_db()
    row = db.execute(
        'SELECT count FROM ai_report_usage WHERE user_id = ? AND usage_month = ?',
        (uid, month)
    ).fetchone()
    used = row['count'] if row else 0
    remaining = max(0, AI_MONTHLY_LIMIT - used)
    return {
        'month': month,
        'used': used,
        'limit': AI_MONTHLY_LIMIT,
        'remaining': remaining,
    }


def check_usage_available(uid):
    """AI 调用前检查是否还有额度，返回 (ok, payload)。"""
    payload = get_usage_payload(uid)
    if payload['remaining'] <= 0:
        return False, payload
    return True, payload


def consume_usage(uid):
    """AI 成功调用后计数 +1。"""
    month = date.today().strftime('%Y-%m')
    db = get_db()
    row = db.execute(
        'SELECT count FROM ai_report_usage WHERE user_id = ? AND usage_month = ?',
        (uid, month)
    ).fetchone()
    if row:
        db.execute(
            'UPDATE ai_report_usage SET count = count + 1, updated_at = ? WHERE user_id = ? AND usage_month = ?',
            (db_now(), uid, month)
        )
    else:
        db.execute(
            'INSERT INTO ai_report_usage (user_id, usage_month, count) VALUES (?, ?, 1)',
            (uid, month)
        )
    db.commit()


def generate_report(uid, period, start=None, end=None, note='', items=None, user=None, offset=0, prompt_template=None):
    """生成报告：优先 AI，失败/未配置时降级为统计报告。

    start/end 为手动选择的时间范围（YYYY-MM-DD）；items 为用户整理后的事项清单
    （未传时使用统计自动聚合的清单）；offset 仅在未传 start/end 时生效（兼容旧调用）。
    prompt_template 为自定义提示词模板（未传时使用用户已保存的模板，仍未保存则用默认模板）。
    返回 (result_dict, http_status)；额度不足时 status=429。
    """
    ok, usage = check_usage_available(uid)
    if not ok:
        return {
            'success': False,
            'error': f'本月 AI 报告次数已用完（{AI_MONTHLY_LIMIT} 次），下月自动恢复',
            'code': 'REPORT_LIMIT_EXCEEDED',
            'usage': usage,
        }, 429

    stats = build_period_stats(uid, period, start, end, offset)
    markdown = None
    model = None
    degraded = True
    ai_error = None
    truncated = False

    if AI_REPORT_ENABLED and AI_API_KEY:
        try:
            if user is None:
                db = get_db()
                user = db.execute('SELECT * FROM users WHERE id = ?', (uid,)).fetchone()
            if prompt_template is None:
                prompt_template = get_user_prompt(uid) or DEFAULT_PROMPT_TEMPLATE
            prompt = build_prompt(stats, user, note, items, prompt_template)
            markdown, finish = call_llm(prompt)
            if finish == 'length':
                # 输出被截断：用更大的 max_tokens 重试一次，仍截断则保留并标记
                markdown, finish = call_llm(prompt, max_tokens=min(AI_MAX_TOKENS * 2, 8192))
            truncated = finish == 'length'
            if truncated:
                markdown = markdown.rstrip() + '\n\n> ⚠️ 提示：AI 输出超过生成长度上限被截断，可调大 AI_MAX_TOKENS 后重新生成。'
            model = AI_MODEL
            degraded = False
            # 仅 AI 成功调用计数，降级报告不消耗次数
            consume_usage(uid)
            usage = get_usage_payload(uid)
        except Exception as e:  # noqa: BLE001 —— AI 失败不应阻断报告
            ai_error = str(e)

    if markdown is None:
        markdown = build_fallback_report(stats, note, items)

    return {
        'success': True,
        'period': period,
        'markdown': markdown,
        'stats': {k: v for k, v in stats.items() if k != 'events'},
        'events': stats['events'],
        'model': model,
        'degraded': degraded,
        'truncated': truncated,
        'ai_error': ai_error,
        'usage': usage,
        'generated_at': db_now(),
    }, 200
