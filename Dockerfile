# ============================================================
# 多阶段构建：先构建 React 前端，再打包 Python 后端
# ============================================================

# ---- Stage 1: 构建 React 前端 ----
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# 复制 package 文件并安装依赖（利用分层缓存）
COPY frontend-react/package.json frontend-react/package-lock.json* ./
RUN npm ci || npm install

# 复制源码并构建
COPY frontend-react/ ./
RUN npm run build

# ---- Stage 2: Python 后端 ----
FROM python:3.11-slim

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# 安装依赖（分层缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# 复制后端代码
COPY backend/ ./backend/
COPY run.py .
COPY docker-entrypoint.sh .

# 从 Stage 1 复制 React 构建产物（含 dist/template/ 导入模板）
COPY --from=frontend-builder /frontend/dist ./frontend-react/dist

# 创建数据目录 + 入口脚本权限
RUN mkdir -p /app/data && chmod +x /app/docker-entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
