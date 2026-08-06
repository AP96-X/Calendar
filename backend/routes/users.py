# -*- coding: utf-8 -*-
"""用户管理路由（管理员专属）"""

import bcrypt
from datetime import datetime
from flask import Blueprint, request, jsonify
from ..database import get_db
from ..auth import require_admin, get_current_user, add_audit_log

users_bp = Blueprint('users', __name__)


@users_bp.route('/api/users', methods=['GET'])
@require_admin
def list_users():
    db = get_db()
    rows = db.execute(
        'SELECT id, username, display_name, role, enabled, created_at, updated_at FROM users ORDER BY id'
    ).fetchall()
    users = []
    for r in rows:
        users.append({
            'id': r['id'], 'username': r['username'],
            'display_name': r['display_name'] or r['username'],
            'role': r['role'], 'enabled': bool(r['enabled']),
            'created_at': r['created_at'], 'updated_at': r['updated_at'],
        })
    return jsonify(users)


@users_bp.route('/api/users', methods=['POST'])
@require_admin
def create_user():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    display_name = data.get('display_name', '').strip()
    role = data.get('role', 'user')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码至少6位'}), 400
    if role == 'admin':
        return jsonify({'error': '系统仅允许一个管理员账号'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        return jsonify({'error': '用户名已存在'}), 409

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    cur = db.execute(
        'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
        (username, pw_hash.decode('utf-8'), display_name or username, role)
    )
    db.commit()
    new_id = cur.lastrowid
    add_audit_log('create_user', new_id, f'创建用户 {username}')
    return jsonify({'success': True, 'id': new_id}), 201


@users_bp.route('/api/users/<int:user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    data = request.get_json() or {}
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404

    if user['role'] == 'admin':
        return jsonify({'error': '管理员账号不可修改属性'}), 403

    display_name = data.get('display_name', '').strip()
    role = data.get('role', user['role'])
    enabled = data.get('enabled')

    if role == 'admin':
        return jsonify({'error': '系统仅允许一个管理员账号'}), 400

    updates = []
    params = []
    if display_name:
        updates.append('display_name=?')
        params.append(display_name)
    if role:
        updates.append('role=?')
        params.append(role)
    if enabled is not None:
        updates.append('enabled=?')
        params.append(1 if enabled else 0)

    if updates:
        updates.append('updated_at=?')
        params.append(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        params.append(user_id)
        db.execute(f'UPDATE users SET {", ".join(updates)} WHERE id=?', params)
        db.commit()
        add_audit_log('update_user', user_id, f'更新用户 {user["username"]}')

    return jsonify({'success': True})


@users_bp.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
@require_admin
def admin_reset_password(user_id):
    data = request.get_json() or {}
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404

    new_password = data.get('new_password', '').strip()
    if not new_password or len(new_password) < 6:
        return jsonify({'error': '新密码至少6位'}), 400

    pw_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    db.execute(
        'UPDATE users SET password_hash=?, updated_at=? WHERE id=?',
        (pw_hash.decode('utf-8'), datetime.now().strftime('%Y-%m-%d %H:%M:%S'), user_id)
    )
    db.commit()
    add_audit_log('reset_password', user_id, f'重置 {user["username"]} 的密码')
    return jsonify({'success': True, 'message': f'已重置 {user["username"]} 的密码'})


@users_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    if user['role'] == 'admin':
        return jsonify({'error': '不能删除管理员账号'}), 403

    db.execute('DELETE FROM events WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    add_audit_log('delete_user', user_id, f'删除用户 {user["username"]}')
    return jsonify({'success': True})
