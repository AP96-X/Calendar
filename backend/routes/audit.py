# -*- coding: utf-8 -*-
"""审计日志 & 登录日志路由"""

from flask import Blueprint, jsonify
from ..database import get_db
from ..auth import require_admin

audit_bp = Blueprint('audit', __name__)


@audit_bp.route('/api/audit-log', methods=['GET'])
@require_admin
def get_audit_log():
    db = get_db()
    rows = db.execute('''
        SELECT a.*, u1.username as admin_username, u2.username as target_username
        FROM audit_log a
        LEFT JOIN users u1 ON a.admin_user_id = u1.id
        LEFT JOIN users u2 ON a.target_user_id = u2.id
        ORDER BY a.created_at DESC LIMIT 50
    ''').fetchall()
    logs = []
    for r in rows:
        logs.append({
            'id': r['id'], 'admin': r['admin_username'],
            'action': r['action'], 'target': r['target_username'] or '',
            'details': r['details'], 'created_at': r['created_at'],
        })
    return jsonify(logs)


@audit_bp.route('/api/logins', methods=['GET'])
@require_admin
def get_login_log():
    """获取登录日志（最近100条）"""
    db = get_db()
    rows = db.execute('''
        SELECT * FROM login_attempts ORDER BY attempted_at DESC LIMIT 100
    ''').fetchall()
    logs = []
    for r in rows:
        logs.append({
            'id': r['id'],
            'ip_address': r['ip_address'],
            'username': r['username'],
            'attempted_at': r['attempted_at'],
            'success': bool(r['success']),
        })
    return jsonify(logs)
