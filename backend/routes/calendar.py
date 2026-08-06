# -*- coding: utf-8 -*-
"""日历元数据路由（性能优化版 — 内存缓存 + HTTP 缓存头 + 消除冗余查询）"""

from datetime import date, datetime
from flask import Blueprint, request, jsonify
from ..database import get_db
from ..auth import require_admin
from ..services.calendar_service import compute_calendar_meta_for_month, get_calendar_meta_from_db

calendar_bp = Blueprint('calendar', __name__)


@calendar_bp.route('/api/calendar-meta')
def calendar_meta():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    force = request.args.get('force', '0')
    if not year or not month:
        today = date.today()
        year, month = today.year, today.month

    result, is_complete, max_updated = get_calendar_meta_from_db(year, month)
    if not is_complete or force == '1':
        # compute 现在直接返回结果，无需再查 DB
        _, result = compute_calendar_meta_for_month(year, month)
        # 重新获取 updated_at（compute 内部用的是统一 now_str）
        max_updated = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # HTTP 缓存头：日历元数据在刷新前不变，允许浏览器/CDN 缓存 2 小时
    resp = jsonify(result)
    resp.headers['Cache-Control'] = 'public, max-age=7200'
    if max_updated:
        resp.headers['Last-Modified'] = max_updated
    return resp


@calendar_bp.route('/api/calendar-meta/refresh', methods=['POST'])
@require_admin
def calendar_meta_refresh():
    data = request.get_json() or {}
    year = data.get('year')
    month = data.get('month')
    if not year or not month:
        today = date.today()
        year, month = today.year, today.month

    total, _ = compute_calendar_meta_for_month(year, month)
    return jsonify({
        'success': True, 'year': year, 'month': month,
        'total_days': total, 'message': f'{year}年{month}月数据已刷新（{total}天）'
    })


@calendar_bp.route('/api/calendar-meta/status')
def calendar_meta_status():
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    if not year or not month:
        today = date.today()
        year, month = today.year, today.month

    # get_calendar_meta_from_db 现在返回 max_updated，无需额外 DB 查询
    result, is_complete, updated_at = get_calendar_meta_from_db(year, month)

    return jsonify({
        'year': year, 'month': month, 'cached': is_complete,
        'days_cached': len(result), 'updated_at': updated_at
    })
