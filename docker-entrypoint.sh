#!/bin/sh
set -e

echo "===================================="
echo "  日历视图 Docker 启动"
echo "  DB 类型: ${CALENDAR_DB_TYPE:-sqlite}"
echo "===================================="

# 建表（带 MySQL 重试，最多等 30s）
# init_db() 内部基于 SCHEMA_VERSION 做了幂等处理：
#   - 首次启动：执行完整建表 + 创建管理员，写入版本标记
#   - 后续启动（含重建镜像）：版本匹配 → 跳过，快速启动
#   - 升级版本号：版本不匹配 → 重新建表（IF NOT EXISTS 安全）→ 更新标记
python -c "
from backend.database import init_db
init_db()
print('[OK] 数据库初始化完成')
"

echo "  启动应用服务..."
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 backend.app:app
