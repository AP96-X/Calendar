# -*- coding: utf-8 -*-
"""认证路由"""

import bcrypt
from flask import Blueprint, request, jsonify, session
from ..database import get_db
from ..auth import check_login_attempts, record_login_attempt

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/status')
def auth_status():
    from ..auth import get_current_user
    user = get_current_user()
    if user:
        return jsonify({
            'logged_in': True,
            'user_id': user['id'],
            'username': user['username'],
            'display_name': user['display_name'] or user['username'],
            'role': user['role'],
            'created_at': user['created_at'],
        })
    return jsonify({'logged_in': False})


@auth_bp.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    remember = data.get('remember', False)
    ip = request.remote_addr or 'unknown'

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    if check_login_attempts(ip, username):
        record_login_attempt(ip, username, False)
        return jsonify({'error': '登录失败次数过多，请15分钟后重试'}), 429

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

    if not user:
        record_login_attempt(ip, username, False)
        return jsonify({'error': '用户名或密码错误'}), 401

    if not user['enabled']:
        return jsonify({'error': '账号已被禁用，请联系管理员'}), 403

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        record_login_attempt(ip, username, False)
        return jsonify({'error': '用户名或密码错误'}), 401

    record_login_attempt(ip, username, True)
    session.clear()
    session['user_id'] = user['id']
    session['_fresh'] = True
    session.permanent = bool(remember)

    return jsonify({
        'success': True,
        'user_id': user['id'],
        'username': user['username'],
        'display_name': user['display_name'] or user['username'],
        'role': user['role'],
    })


@auth_bp.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'success': True})
