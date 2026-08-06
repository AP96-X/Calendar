# -*- coding: utf-8 -*-
"""日历视图 - 后端配置"""

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# React 构建产物目录（npm run build 后生成）
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'frontend-react', 'dist')

# ============================================================
# 数据库配置 —— 修改 DB_TYPE 即可切换数据库
# ============================================================

DB_TYPE = os.environ.get('CALENDAR_DB_TYPE', 'sqlite')          # 'sqlite' | 'mysql'

# SQLite 配置
DB_PATH = os.environ.get('CALENDAR_DB_PATH', os.path.join(BASE_DIR, 'calendar.db'))

# MySQL / MariaDB 配置
MYSQL_HOST = os.environ.get('CALENDAR_MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = int(os.environ.get('CALENDAR_MYSQL_PORT', '3306'))
MYSQL_USER = os.environ.get('CALENDAR_MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('CALENDAR_MYSQL_PASSWORD', '')
MYSQL_DB = os.environ.get('CALENDAR_MYSQL_DB', 'calendar')

# ============================================================
# CORS 配置 —— 允许的跨域来源
# ============================================================
# 逗号分隔的域名列表，例如：
#   CALENDAR_CORS_ORIGINS=https://example.com,https://www.example.com
# 留空或不设置时，开发环境回退到允许所有来源（r".*"），
# 生产环境应通过 docker-compose.yml 显式指定具体域名。
_raw_cors = os.environ.get('CALENDAR_CORS_ORIGINS', '').strip()
if _raw_cors:
    CORS_ORIGINS = [o.strip() for o in _raw_cors.split(',') if o.strip()]
else:
    # 开发环境默认：允许所有来源
    CORS_ORIGINS = r".*"

# ============================================================
# 备案信息 —— ICP 备案号 & 公安备案号
# ============================================================
# 通过环境变量注入，未设置时为空（前端不展示备案信息）
ICP_NUMBER = os.environ.get('ICP_NUMBER', '').strip()
PUBLIC_SECURITY_NUMBER = os.environ.get('PUBLIC_SECURITY_NUMBER', '').strip()
