# -*- coding: utf-8 -*-
"""数据库连接与初始化 —— 统一 SQLite / MySQL 适配层（性能优化版）"""

import os
import secrets
import bcrypt
from flask import g
from .config import DB_TYPE, DB_PATH, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

# 数据库 Schema 版本号
# - 首次启动：无标记 → 执行完整建表 + 创建管理员 → 写入版本标记
# - 后续启动（含重建镜像）：版本匹配 → 跳过初始化，快速启动
# - 升级版本号：版本不匹配 → 重新执行建表（IF NOT EXISTS 安全）→ 更新版本标记
SCHEMA_VERSION = '1.0'

# MySQL 连接池（使用 DBUtils，线程安全）
_mysql_pool = None


def _get_mysql_pool():
    global _mysql_pool
    if _mysql_pool is None:
        try:
            from dbutils.pooled_db import PooledDB
            import pymysql
            _mysql_pool = PooledDB(
                creator=pymysql,
                maxconnections=10,
                mincached=2,
                maxcached=5,
                blocking=True,
                host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER,
                password=MYSQL_PASSWORD, database=MYSQL_DB,
                charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
        except ImportError:
            _mysql_pool = False  # fallback: 无 DBUtils 时直接连接
    return _mysql_pool


def get_db():
    if 'db' not in g:
        if DB_TYPE == 'mysql':
            pool = _get_mysql_pool()
            if pool and pool is not False:
                conn = pool.connection()
            else:
                import pymysql
                conn = pymysql.connect(
                    host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER,
                    password=MYSQL_PASSWORD, database=MYSQL_DB,
                    charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
            g.db = _MySQLConnection(conn)
        else:
            import sqlite3
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            g.db = _SQLiteConnection(conn)
    return g.db


def db_now():
    """返回当前时间字符串，兼容 SQLite / MySQL"""
    from datetime import datetime
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


# ==================== SQLite 连接包装 ====================

class _SQLiteConnection:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=None):
        """执行 SQL，自动提交 DDL"""
        if params:
            cur = self._conn.execute(sql, params)
        else:
            cur = self._conn.execute(sql)
        # SQLite DDL statements need explicit commit
        stripped = sql.strip().upper()
        if any(stripped.startswith(w) for w in ('CREATE', 'ALTER', 'DROP', 'INSERT OR')):
            self._conn.commit()
        return _SQLiteCursor(cur)

    def commit(self):
        self._conn.commit()

    def executemany(self, sql, seq_of_params):
        """批量执行（SQLite 使用 executemany）"""
        sql_raw = sql.replace('INSERT OR REPLACE INTO', 'INSERT OR REPLACE INTO')
        self._conn.executemany(sql_raw, seq_of_params)
        self._conn.commit()

    def close(self):
        self._conn.close()


class _SQLiteCursor:
    def __init__(self, cur):
        self._cur = cur

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        return {k: row[k] for k in row.keys()}

    def fetchall(self):
        rows = self._cur.fetchall()
        return [{k: r[k] for k in r.keys()} for r in rows]

    def __getattr__(self, name):
        return getattr(self._cur, name)


# ==================== MySQL 连接包装 ====================

class _MySQLConnection:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=None):
        """执行 SQL，MySQL 方言转换"""
        sql = sql.replace('?', '%s')
        sql = sql.replace('INSERT OR REPLACE INTO', 'REPLACE INTO')
        cur = self._conn.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def executemany(self, sql, seq_of_params):
        """批量执行（MySQL 方言转换）"""
        sql = sql.replace('?', '%s')
        sql = sql.replace('INSERT OR REPLACE INTO', 'REPLACE INTO')
        cur = self._conn.cursor()
        cur.executemany(sql, seq_of_params)
        self._conn.commit()
        cur.close()

    def close(self):
        self._conn.close()


# ==================== 关闭连接 ====================

def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


# ==================== 表结构初始化 ====================

def init_db():
    from .config import DB_TYPE as _DB_TYPE, DB_PATH as _DP

    if _DB_TYPE == 'mysql':
        _init_mysql()
    else:
        _init_sqlite()


def _get_sqlite_marker_path():
    """获取 SQLite 版本标记文件路径（与数据库文件同目录，在 Docker volume 中持久化）"""
    db_dir = os.path.dirname(DB_PATH) or '.'
    return os.path.join(db_dir, '.db_schema_version')


def _init_sqlite():
    # 检查是否已用当前版本初始化过 → 跳过，避免重建镜像后重复执行
    marker_path = _get_sqlite_marker_path()
    if os.path.exists(marker_path):
        with open(marker_path, 'r') as f:
            stored_version = f.read().strip()
        if stored_version == SCHEMA_VERSION:
            print(f'[INFO] 数据库已初始化 (schema v{SCHEMA_VERSION})，跳过建表')
            return

    import sqlite3
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")

    db.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, display_name TEXT DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user', enabled INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    db.execute('''CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        title TEXT NOT NULL, date TEXT NOT NULL, time TEXT DEFAULT '',
        color TEXT DEFAULT '#4A90D9', completed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id))''')
    try:
        db.execute("ALTER TABLE events ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")
    except:
        pass
    db.execute('CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)')
    db.execute('CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date)')

    db.execute('''CREATE TABLE IF NOT EXISTS calendar_meta (
        date TEXT PRIMARY KEY, lunar TEXT DEFAULT '', holiday TEXT DEFAULT '',
        is_holiday INTEGER DEFAULT 0, is_workday INTEGER DEFAULT 1,
        is_weekend INTEGER DEFAULT 0, is_adjust_work INTEGER DEFAULT 0,
        adjust_for TEXT DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    try:
        db.execute("ALTER TABLE calendar_meta ADD COLUMN solar_term TEXT DEFAULT ''")
    except:
        pass

    db.execute('''CREATE TABLE IF NOT EXISTS solar_terms (
        year INTEGER NOT NULL, term_name TEXT NOT NULL, date TEXT NOT NULL,
        PRIMARY KEY (year, term_name))''')
    db.execute('''CREATE INDEX IF NOT EXISTS idx_calendar_meta_yearmonth
        ON calendar_meta(substr(date,1,7))''')

    db.execute('''CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, admin_user_id INTEGER NOT NULL,
        action TEXT NOT NULL, target_user_id INTEGER, details TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    db.execute('''CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ip_address TEXT NOT NULL,
        username TEXT NOT NULL, attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success INTEGER NOT NULL DEFAULT 0)''')
    db.execute('CREATE INDEX IF NOT EXISTS idx_login_check ON login_attempts(ip_address, username, success, attempted_at)')

    _ensure_admin(db)
    db.commit()
    db.close()

    # 写入版本标记文件（位于 Docker volume 中，重建镜像后仍存在）
    with open(marker_path, 'w') as f:
        f.write(SCHEMA_VERSION)
    print(f'[INFO] 数据库初始化完成 (schema v{SCHEMA_VERSION})')


def _mysql_index_exists(cur, table_name, index_name):
    """检查 MySQL 索引是否已存在（CREATE INDEX 不支持 IF NOT EXISTS）"""
    cur.execute("""
        SELECT COUNT(*) as cnt FROM information_schema.STATISTICS
        WHERE table_schema = %s AND table_name = %s AND index_name = %s
    """, (MYSQL_DB, table_name, index_name))
    return cur.fetchone()['cnt'] > 0


def _init_mysql():
    import pymysql, time
    retries = 10
    while retries > 0:
        try:
            db = pymysql.connect(
                host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER,
                password=MYSQL_PASSWORD, database=MYSQL_DB,
                charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
            break
        except pymysql.err.OperationalError as e:
            retries -= 1
            if retries == 0:
                print(f'[ERROR] MySQL 连接失败 (已重试耗尽): {e}')
                raise
            print(f'[WARN] MySQL 未就绪, {retries} 次重试机会, 等待 3s... ({e})')
            time.sleep(3)

    # 检查是否已用当前版本初始化过 → 跳过，避免重建镜像后重复执行
    cur = db.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS _init_meta (
        `key` VARCHAR(64) PRIMARY KEY,
        `value` VARCHAR(256) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
    db.commit()
    cur.execute("SELECT `value` FROM _init_meta WHERE `key` = 'schema_version'")
    row = cur.fetchone()
    if row and row['value'] == SCHEMA_VERSION:
        print(f'[INFO] 数据库已初始化 (schema v{SCHEMA_VERSION})，跳过建表')
        cur.close()
        db.close()
        return

    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(256) NOT NULL, display_name VARCHAR(64) DEFAULT '',
        role VARCHAR(16) NOT NULL DEFAULT 'user', enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    cur.execute('''CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
        title VARCHAR(256) NOT NULL, date VARCHAR(10) NOT NULL, time VARCHAR(10) DEFAULT '',
        color VARCHAR(7) DEFAULT '#4A90D9', completed TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP, INDEX idx_events_date (date), INDEX idx_events_user (user_id),
        INDEX idx_events_user_date (user_id, date),
        FOREIGN KEY (user_id) REFERENCES users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    cur.execute('''CREATE TABLE IF NOT EXISTS calendar_meta (
        date VARCHAR(10) PRIMARY KEY, lunar VARCHAR(32) DEFAULT '',
        holiday VARCHAR(32) DEFAULT '', solar_term VARCHAR(16) DEFAULT '',
        is_holiday TINYINT(1) DEFAULT 0, is_workday TINYINT(1) DEFAULT 1,
        is_weekend TINYINT(1) DEFAULT 0, is_adjust_work TINYINT(1) DEFAULT 0,
        adjust_for VARCHAR(32) DEFAULT '', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    cur.execute('''CREATE TABLE IF NOT EXISTS solar_terms (
        year INT NOT NULL, term_name VARCHAR(8) NOT NULL, date VARCHAR(10) NOT NULL,
        PRIMARY KEY (year, term_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    if not _mysql_index_exists(cur, 'calendar_meta', 'idx_cal_meta_ym'):
        cur.execute('''CREATE INDEX idx_cal_meta_ym ON calendar_meta((SUBSTR(date, 1, 7)))''')

    cur.execute('''CREATE TABLE IF NOT EXISTS audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY, admin_user_id INT NOT NULL,
        action VARCHAR(32) NOT NULL, target_user_id INT, details VARCHAR(256) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')

    cur.execute('''CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY, ip_address VARCHAR(64) NOT NULL,
        username VARCHAR(64) NOT NULL, attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success TINYINT(1) NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
    if not _mysql_index_exists(cur, 'login_attempts', 'idx_login_check'):
        cur.execute('''CREATE INDEX idx_login_check ON login_attempts(ip_address, username, success, attempted_at)''')

    db.commit()

    # Ensure admin user
    cur.execute("SELECT COUNT(*) as cnt FROM users")
    count = cur.fetchone()['cnt']
    if count == 0:
        default_password = os.environ.get('ADMIN_DEFAULT_PASSWORD', secrets.token_urlsafe(12))
        pw_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(
            "INSERT INTO users (username, password_hash, display_name, role) VALUES (%s, %s, %s, %s)",
            ('admin', pw_hash, '管理员', 'admin'))
        db.commit()
        # 仅在通过环境变量显式设置密码时打印，随机密码不打印
        if os.environ.get('ADMIN_DEFAULT_PASSWORD'):
            print(f'[INFO] 默认管理员账号已创建: admin / {default_password}')
        else:
            print('[INFO] 默认管理员账号已创建（密码为随机生成，请通过环境变量 ADMIN_DEFAULT_PASSWORD 设置）')
    else:
        cur.execute("UPDATE users SET enabled = 1 WHERE role = 'admin'")
        db.commit()

    # 写入版本标记到 _init_meta 表（MySQL 数据独立持久化，重建 app 镜像后仍存在）
    cur.execute("REPLACE INTO _init_meta (`key`, `value`) VALUES ('schema_version', %s)",
                (SCHEMA_VERSION,))
    db.commit()
    cur.close()
    db.close()
    print(f'[INFO] 数据库初始化完成 (schema v{SCHEMA_VERSION})')


def _ensure_admin(db):
    """SQLite: ensure admin exists and is enabled"""
    cur = db.execute("SELECT COUNT(*) as cnt FROM users")
    count = cur.fetchone()['cnt']
    if count == 0:
        default_password = os.environ.get('ADMIN_DEFAULT_PASSWORD', secrets.token_urlsafe(12))
        pw_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        db.execute('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
                   ('admin', pw_hash, '管理员', 'admin'))
        if os.environ.get('ADMIN_DEFAULT_PASSWORD'):
            print(f'[INFO] 默认管理员账号已创建: admin / {default_password}')
        else:
            print('[INFO] 默认管理员账号已创建（密码为随机生成，请通过环境变量 ADMIN_DEFAULT_PASSWORD 设置）')
    else:
        db.execute("UPDATE users SET enabled = 1 WHERE role = 'admin'")
