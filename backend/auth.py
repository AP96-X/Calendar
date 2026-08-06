# -*- coding: utf-8 -*-
"""认证辅助与装饰器"""

from flask import session
from .database import get_db


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    db = get_db()
    return db.execute('SELECT * FROM users WHERE id = ? AND enabled = 1', (user_id,)).fetchone()


def get_current_user_id():
    return session.get('user_id')


def require_login(f):
    from functools import wraps
    from flask import jsonify
    @wraps(f)
    def decorated(*args, **kwargs):
        if not get_current_user_id():
            return jsonify({'error': '未登录', 'code': 'UNAUTHORIZED'}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    from functools import wraps
    from flask import jsonify
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未登录', 'code': 'UNAUTHORIZED'}), 401
        if user['role'] != 'admin':
            return jsonify({'error': '仅管理员可操作', 'code': 'FORBIDDEN'}), 403
        return f(*args, **kwargs)
    return decorated


def add_audit_log(action, target_user_id=None, details=''):
    admin_id = get_current_user_id()
    if not admin_id:
        return
    db = get_db()
    db.execute(
        'INSERT INTO audit_log (admin_user_id, action, target_user_id, details) VALUES (?, ?, ?, ?)',
        (admin_id, action, target_user_id, details)
    )
    db.commit()


def check_login_attempts(ip, username):
    from datetime import datetime, timedelta
    db = get_db()
    cutoff = (datetime.now() - timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
    recent_fails = db.execute(
        '''SELECT COUNT(*) AS cnt FROM login_attempts
           WHERE ip_address = ? AND username = ? AND success = 0
           AND attempted_at > ?''',
        (ip, username, cutoff)
    ).fetchone()
    return (recent_fails['cnt'] if recent_fails else 0) >= 5


def record_login_attempt(ip, username, success):
    db = get_db()
    db.execute(
        'INSERT INTO login_attempts (ip_address, username, success) VALUES (?, ?, ?)',
        (ip, username, 1 if success else 0)
    )
    db.commit()
