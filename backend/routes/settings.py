# -*- coding: utf-8 -*-
"""系统设置路由（管理员专属）—— AI 报告与备案信息"""

from flask import Blueprint, request, jsonify

from ..auth import require_admin, add_audit_log
from ..settings_store import (
    SETTING_DEFS, SettingValidationError,
    get_admin_payload, set_values, reset_values,
)

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/api/admin/settings', methods=['GET'])
@require_admin
def get_settings():
    """返回当前生效的设置值与「是否已自定义」标记（敏感项不回显真实值）。"""
    payload = get_admin_payload()
    payload['labels'] = {key: meta['label'] for key, meta in SETTING_DEFS.items()}
    return jsonify(payload)


@settings_bp.route('/api/admin/settings', methods=['PUT'])
@require_admin
def update_settings():
    """保存设置；仅写入请求中出现的设置项，未提交的项保持不变。"""
    data = request.get_json(silent=True) or {}
    values = data.get('values', data)
    try:
        updated = set_values(values)
    except SettingValidationError as e:
        return jsonify({'error': str(e)}), 400
    if updated:
        add_audit_log('update_settings', None, '更新系统设置: ' + ', '.join(updated))
    return jsonify({'success': True, 'updated': updated})


@settings_bp.route('/api/admin/settings/reset', methods=['POST'])
@require_admin
def reset_settings():
    """恢复默认：删除管理员覆盖值，回落到环境变量 / 内置默认值。"""
    data = request.get_json(silent=True) or {}
    keys = data.get('keys')
    if data.get('all'):
        keys = None
    try:
        reset_keys = reset_values(keys)
    except SettingValidationError as e:
        return jsonify({'error': str(e)}), 400
    detail = '全部' if keys is None else ', '.join(reset_keys)
    add_audit_log('reset_settings', None, f'恢复默认系统设置: {detail}')
    return jsonify({'success': True, 'reset': reset_keys})
