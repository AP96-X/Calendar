# -*- coding: utf-8 -*-
"""认证辅助与装饰器"""

import re
from flask import session
from .database import get_db, db_now, now_cn

# 常见弱密码黑名单（兜底，规则校验之外再排除明显弱口令）
_WEAK_PASSWORDS = {
    'password', 'password1', 'password123', '12345678', '123456789',
    '1234567890', 'qwerty123', 'abc12345', 'admin123', 'admin888',
    'iloveyou', 'letmein', 'welcome1', 'monkey123', 'dragon123',
    'a12345678', 'abcd1234', '00000000',
}


def validate_password_strength(password, username=None):
    """密码复杂度校验，返回 (ok, message)。

    规则：长度 ≥ 8；大写/小写/数字/特殊字符至少 3 类；不得包含用户名；
    不得是常见弱密码。
    """
    if not password or len(password) < 8:
        return False, '密码至少 8 位'
    if username and username.lower() in password.lower():
        return False, '密码不能包含用户名'
    categories = 0
    if re.search(r'[a-z]', password):
        categories += 1
    if re.search(r'[A-Z]', password):
        categories += 1
    if re.search(r'\d', password):
        categories += 1
    if re.search(r'[^A-Za-z0-9]', password):
        categories += 1
    if categories < 3:
        return False, '密码需包含大写字母、小写字母、数字、特殊字符中的至少 3 类'
    if password.lower() in _WEAK_PASSWORDS:
        return False, '密码过于常见，请更换更复杂的密码'
    return True, ''


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
        'INSERT INTO audit_log (admin_user_id, action, target_user_id, details, created_at) '
        'VALUES (?, ?, ?, ?, ?)',
        (admin_id, action, target_user_id, details, db_now())
    )
    db.commit()


def check_login_attempts(ip, username):
    from datetime import timedelta
    db = get_db()
    cutoff = (now_cn() - timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
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
        'INSERT INTO login_attempts (ip_address, username, success, attempted_at) VALUES (?, ?, ?, ?)',
        (ip, username, 1 if success else 0, db_now())
    )
    db.commit()
