# -*- coding: utf-8 -*-
"""个人信息与密码修改路由"""

import bcrypt
from datetime import datetime
from flask import Blueprint, request, jsonify
from ..database import get_db
from ..auth import require_login, get_current_user

profile_bp = Blueprint('profile', __name__)


@profile_bp.route('/api/profile', methods=['GET'])
@require_login
def get_profile():
    user = get_current_user()
    return jsonify({
        'id': user['id'], 'username': user['username'],
        'display_name': user['display_name'] or user['username'],
        'role': user['role'],
        'created_at': user['created_at'], 'updated_at': user['updated_at'],
    })


@profile_bp.route('/api/profile', methods=['PUT'])
@require_login
def update_profile():
    data = request.get_json() or {}
    user = get_current_user()
    display_name = data.get('display_name', '').strip()
    if not display_name:
        return jsonify({'error': '显示名称不能为空'}), 400

    db = get_db()
    db.execute(
        'UPDATE users SET display_name=?, updated_at=? WHERE id=?',
        (display_name, datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id'])
    )
    db.commit()
    return jsonify({'success': True, 'display_name': display_name})


@profile_bp.route('/api/profile/password', methods=['PUT'])
@require_login
def change_password():
    data = request.get_json() or {}
    user = get_current_user()
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '').strip()

    if not old_password or not new_password:
        return jsonify({'error': '旧密码和新密码不能为空'}), 400
    if len(new_password) < 6:
        return jsonify({'error': '新密码至少6位'}), 400
    if not bcrypt.checkpw(old_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': '旧密码错误'}), 400

    db = get_db()
    pw_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    db.execute(
        'UPDATE users SET password_hash=?, updated_at=? WHERE id=?',
        (pw_hash.decode('utf-8'), datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user['id'])
    )
    db.commit()
    return jsonify({'success': True, 'message': '密码已修改'})
