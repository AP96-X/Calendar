# -*- coding: utf-8 -*-
"""AI 周报/月报/季报/年报路由"""

from datetime import datetime

from flask import Blueprint, request, jsonify
from ..auth import require_login, get_current_user_id
from ..services.report import (
    generate_report, get_usage_payload, build_period_stats, get_period_range,
    DEFAULT_PROMPT_TEMPLATE, validate_prompt_template,
    get_user_prompt, save_user_prompt, reset_user_prompt,
)

report_bp = Blueprint('report', __name__)

# 用户补充说明最大长度（字符）
NOTE_MAX_LEN = 500
# 支持的报告周期
VALID_PERIODS = ('week', 'month', 'quarter', 'year')
# 手动选择时间范围的最大跨度（天，允许跨整年）
MAX_RANGE_DAYS = 731


def _parse_period(value):
    if value not in VALID_PERIODS:
        return None
    return value


def _parse_date_str(value):
    """校验 YYYY-MM-DD 日期，非法返回 None。"""
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def _parse_start_end(data):
    """从请求中解析手动时间范围，返回 (start, end)；非法时抛 ValueError。"""
    start = _parse_date_str(data.get('start'))
    end = _parse_date_str(data.get('end'))
    if (data.get('start') is not None and start is None) or (data.get('end') is not None and end is None):
        raise ValueError('start/end 格式必须为 YYYY-MM-DD')
    if (data.get('start') is None) != (data.get('end') is None):
        raise ValueError('start 与 end 必须同时提供')
    if start and end:
        if end < start:
            raise ValueError('结束日期不能早于开始日期')
        if (end - start).days > MAX_RANGE_DAYS:
            raise ValueError(f'时间范围不能超过 {MAX_RANGE_DAYS} 天')
    return start, end


@report_bp.route('/api/reports/ai', methods=['POST'])
@require_login
def ai_report():
    data = request.get_json() or {}
    period = _parse_period(data.get('period', 'week'))
    if period is None:
        return jsonify({'error': 'period 仅支持 week/month/quarter/year'}), 400

    # 手动选择时间范围（可选；缺省时按当前周期计算）
    try:
        start, end = _parse_start_end(data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    # 兼容旧参数：date + offset（前端已改为手动选时间，此处仅作回退）
    date_str = data.get('date') or None
    try:
        offset = int(data.get('offset', 0) or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'offset 必须为整数'}), 400
    if offset < 0:
        offset = 0
    if not (start and end) and date_str:
        # 旧调用：以 date 为锚点 + offset 推算出周期范围
        try:
            start, end, _ = get_period_range(period, date_str, offset)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        offset = 0

    # 用户补充说明（生成前人工输入，可选）
    note = data.get('note')
    if note is not None:
        if not isinstance(note, str):
            return jsonify({'error': 'note 必须为字符串'}), 400
        note = note.strip()
        if len(note) > NOTE_MAX_LEN:
            return jsonify({'error': f'补充说明不能超过 {NOTE_MAX_LEN} 字'}), 400

    # 自定义提示词模板（可选；未传时使用用户已保存模板或默认模板）
    prompt_template = data.get('prompt')
    if prompt_template is not None:
        if not isinstance(prompt_template, str):
            return jsonify({'error': 'prompt 必须为字符串'}), 400
        prompt_template = prompt_template.strip()
        try:
            validate_prompt_template(prompt_template)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    uid = get_current_user_id()
    try:
        result, status = generate_report(
            uid, period,
            start=start.strftime('%Y-%m-%d') if start else None,
            end=end.strftime('%Y-%m-%d') if end else None,
            offset=offset if not (start and end) else 0,
            note=note or '',
            prompt_template=prompt_template,
        )
        return jsonify(result), status
    except Exception as e:  # noqa: BLE001
        return jsonify({'error': f'生成报告失败: {str(e)}'}), 500


@report_bp.route('/api/reports/preview', methods=['GET'])
@require_login
def report_preview():
    """聚合预览：按手动选择的时间范围统计事件，返回聚合后的事项清单（不消耗次数）。"""
    period = _parse_period(request.args.get('period', 'week'))
    if period is None:
        return jsonify({'error': 'period 仅支持 week/month/quarter/year'}), 400
    try:
        start, end = _parse_start_end(request.args)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    uid = get_current_user_id()
    try:
        stats = build_period_stats(
            uid, period,
            start=start.strftime('%Y-%m-%d') if start else None,
            end=end.strftime('%Y-%m-%d') if end else None,
        )
        # 前端需要展示「将提交的全部事件」清单，故返回 events（逐条原始事件）；
        # 相同/相似事件的合并由 AI 在生成阶段完成。
        return jsonify(stats)
    except Exception as e:  # noqa: BLE001
        return jsonify({'error': f'统计失败: {str(e)}'}), 500


@report_bp.route('/api/reports/prompt', methods=['GET'])
@require_login
def get_report_prompt():
    """返回默认提示词模板与当前用户已保存的自定义模板（custom_prompt 为 null 表示未自定义）。"""
    uid = get_current_user_id()
    return jsonify({
        'default_prompt': DEFAULT_PROMPT_TEMPLATE,
        'custom_prompt': get_user_prompt(uid),
    })


@report_bp.route('/api/reports/prompt', methods=['PUT'])
@require_login
def put_report_prompt():
    """保存当前用户的自定义提示词模板；传空字符串 = 恢复默认。"""
    data = request.get_json() or {}
    prompt = data.get('prompt')
    if not isinstance(prompt, str):
        return jsonify({'error': 'prompt 必须为字符串'}), 400
    prompt = prompt.strip()
    uid = get_current_user_id()
    if not prompt:
        reset_user_prompt(uid)
        return jsonify({'success': True, 'custom_prompt': None})
    try:
        validate_prompt_template(prompt)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    save_user_prompt(uid, prompt)
    return jsonify({'success': True, 'custom_prompt': prompt})


@report_bp.route('/api/reports/usage', methods=['GET'])
@require_login
def report_usage():
    """查询当前用户本月 AI 报告剩余次数（不消耗次数）。"""
    uid = get_current_user_id()
    return jsonify(get_usage_payload(uid))
