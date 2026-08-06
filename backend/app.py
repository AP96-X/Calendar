# -*- coding: utf-8 -*-
"""日历视图 - Flask 后端入口"""
import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from .config import BASE_DIR, STATIC_FOLDER, CORS_ORIGINS
from .database import close_db

# 不使用 Flask 内置 static_folder，由 spa_fallback 路由统一处理
# 避免 Flask 静态路由拦截 /login 等 SPA 路径后返回 404
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24).hex())
app.config['PERMANENT_SESSION_LIFETIME'] = 604800  # 7 days
# Session Cookie 安全属性
# 本地开发（HTTP）下关闭 Secure，否则浏览器不会发送 Cookie
# 生产环境通过环境变量 CALENDAR_COOKIE_SECURE=true 启用
_is_dev = not os.environ.get('CALENDAR_COOKIE_SECURE', '').lower() in ('true', '1', 'yes')
app.config['SESSION_COOKIE_SECURE'] = not _is_dev   # HTTPS 部署时为 True
app.config['SESSION_COOKIE_HTTPONLY'] = True        # JS 不可读取
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'      # 防 CSRF
app.teardown_appcontext(close_db)

# CORS 配置：允许跨域请求（移动端 APP 跨域访问后端 API）
# origins 从环境变量 CALENDAR_CORS_ORIGINS 读取（逗号分隔），
# 未设置时开发环境回退到允许所有来源 (r".*")。
# 生产环境应在 docker-compose.yml 中指定具体域名列表：
#   CALENDAR_CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
CORS(app, supports_credentials=True, origins=CORS_ORIGINS)

# Register blueprints
from .routes.auth import auth_bp
from .routes.events import events_bp
from .routes.calendar import calendar_bp
from .routes.users import users_bp
from .routes.profile import profile_bp
from .routes.audit import audit_bp
from .routes.site import site_bp

app.register_blueprint(auth_bp)
app.register_blueprint(events_bp)
app.register_blueprint(calendar_bp)
app.register_blueprint(users_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(audit_bp)
app.register_blueprint(site_bp)


@app.route('/')
def index():
    """SPA 入口 — 始终返回 index.html，由 React Router 处理路由"""
    return send_from_directory(STATIC_FOLDER, 'index.html')


@app.route('/<path:path>')
def spa_fallback(path):
    """
    SPA 回退：静态资源（js/css/图片等）直接返回，
    其他路径回退到 index.html 交给 React Router。
    """
    full_path = os.path.join(STATIC_FOLDER, path)
    if os.path.isfile(full_path):
        return send_from_directory(STATIC_FOLDER, path)
    # 非静态文件路径 → 回退到 index.html
    return send_from_directory(STATIC_FOLDER, 'index.html')
