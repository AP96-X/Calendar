# 日历视图 (Calendar App)

基于 Flask + React 的全栈日历应用，支持事件管理、农历节气显示、节假日调休标注、多用户权限管理、Excel 导入导出（含富文本颜色与删除线）。

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Flask](https://img.shields.io/badge/Flask-2.0+-green)
![React](https://img.shields.io/badge/React-19-61dafb)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED)

## 功能概览

### 日历核心

- **月/周/日三视图** — 前后翻页、回到今天、键盘快捷键（Ctrl+方向键）
- **农历 + 二十四节气** — 基于 lunardate + ephem 天文计算
- **法定节假日 & 调休** — 基于 chinese-calendar，自动标注假期与补班
- **事件管理** — 创建、编辑、删除、标记完成、颜色标记
- **事件详情弹窗** — 点击事件展示详情，支持编辑/删除/标记完成
- **Excel 导入导出** — 按日历模板导入/导出事件，重复自动跳过
- **富文本导出** — 导出的 Excel 保留事件颜色和完成状态（删除线），导入时自动解析还原

### 用户与权限

- **多用户隔离** — 每个用户独立管理自己的事件
- **管理员面板** — 用户管理、审计日志、登录日志三个独立入口
- **登录安全** — bcrypt 密码哈希、15 分钟内 5 次失败临时锁定
- **审计日志** — 管理员操作（创建/删除/修改用户/重置密码）全程记录
- **登录日志** — 最近 100 条登录记录（时间、用户名、IP、成功/失败）

### 导入导出

- **按月导出** — 选择月份导出 Excel 日历（含事件颜色与删除线）
- **导出全部** — 导出当前用户所有事件数据，按月份分 Sheet
- **导入** — 上传 Excel 文件自动解析，支持颜色与完成状态还原
- **模板下载** — 导入对话框中提供空白模板下载（动态生成当月日历布局）
- **去重机制** — 同一用户下相同日期 + 相同标题的事件自动跳过

### AI 总结（周/月/季度/年度报告）

- **AI 总结入口** — 工具栏「AI总结」下拉选择 周总结 / 月总结 / 季度总结 / 年度总结
- **周总结（三块区域）** — 周报为「本周工作 / 下周工作 / 需要协调和帮助」三块可编辑区域：本周已完成事件自动填入本周工作、本周未完成事件与下周已安排事件自动填入下周工作（按标题去重、不重复计数），修改后点击「AI生成」由 AI 润色
- **手动选择时间** — 月/季度/年度报告周期支持手动选择起止日期（默认按当前周期填充）；周报默认本周、下周为其后一周
- **事项整理** — 月/季度/年度生成前将统计到的事件按标题聚合展示，可修改标题、删除或新增事项，再交由 AI 总结
- **数据聚合** — 完成率、颜色分类统计、按标题合并的事项清单
- **AI 总结** — 接入 OpenAI 兼容协议（DeepSeek / 通义 / OpenAI / 本地 Ollama），输出概览、完成情况、亮点与下期建议；长度预算随事项数量自适应
- **自定义提示词** — 月/季度/年度弹窗内展示默认提示词模板（含 `{周期}`、`{事项清单}` 等占位符），可自由修改：本次生成立即生效，或「保存为我的默认」持久化到个人账号
- **防截断** — 检测到输出被生成长度截断时自动以更大额度重试一次，仍不足则明确提示，不再静默返回不完整内容
- **自动降级** — 未配置 AI 或调用失败时，自动降级为统计型报告（周报按原内容输出），功能不失效
- **复制 / 下载** — 报告支持一键复制或下载 .md 文件

### 安全

- **密码复杂度校验** — 修改密码、管理员建号、重置密码统一要求：至少 8 位，含大小写字母/数字/特殊字符至少 3 类，且不含用户名

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Flask（Blueprint 模块化） |
| 数据库 | SQLite / MySQL / MariaDB（一键切换） |
| 前端框架 | React 19 + TypeScript |
| UI 组件库 | Ant Design 5 |
| 构建工具 | Vite |
| 路由 | React Router 7 |
| 农历 | lunardate |
| 节气 | ephem (PyEphem) |
| 节假日 | chinese-calendar |
| Excel 导入导出 | openpyxl（含 CellRichText 富文本） |
| 密码 | bcrypt |
| AI 报告 | OpenAI 兼容协议（urllib 调用，无额外依赖）+ react-markdown |
| 容器化 | Docker + Docker Compose + Nginx + Gunicorn |

## 项目结构

```
calendar-app/
├── run.py                       # 启动入口
├── requirements.txt             # Python 依赖
├── Dockerfile                   # 多阶段构建（Node.js 构建前端 + Python 后端）
├── docker-compose.yml           # 容器编排（SQLite / MySQL 双模式）
├── docker-entrypoint.sh         # 容器启动入口（自动建表 + schema 版本管理）
├── nginx.conf                   # Nginx 反向代理配置
├── .dockerignore                # Docker 构建忽略规则
├── .gitignore                   # Git 忽略规则
├── LICENSE                      # MIT 许可证
├── README.md                    # 本文件
│
├── backend/                     # 后端 Python 包
│   ├── app.py                  # Flask 应用入口 + SPA 路由回退
│   ├── config.py               # 配置中心（环境变量驱动的 DB 切换）
│   ├── database.py             # 统一数据库适配层（SQLite / MySQL）+ schema 版本管理
│   ├── auth.py                 # 认证（装饰器、登录限制、审计日志）
│   ├── routes/                 # API 路由蓝图
│   │   ├── auth.py            # /api/auth/*         登录/登出/状态
│   │   ├── events.py          # /api/events/*       事件 CRUD + 导入导出 + 模板生成
│   │   ├── calendar.py        # /api/calendar-meta/* 农历/节气/节假日
│   │   ├── users.py           # /api/users/*        用户管理
│   │   ├── profile.py         # /api/profile/*      个人信息/密码
│   │   ├── audit.py           # /api/audit-log + /api/logins  审计+登录日志
│   │   ├── site.py            # /api/site/info      备案信息
│   │   └── report.py          # /api/reports/ai + preview + usage  AI 总结（周/月/季/年度）
│   └── services/               # 纯业务逻辑
│       ├── lunar.py           # 农历换算
│       ├── solar_term.py      # 二十四节气天文计算
│       ├── holiday.py         # 节假日查询
│       ├── calendar_service.py # 日历元数据统一入口
│       └── report.py          # AI 报告（数据聚合 + LLM 调用 + 降级）
│
└── frontend-react/              # React 前端项目
    ├── package.json            # Node.js 依赖
    ├── vite.config.ts          # Vite 配置（开发代理 + 构建输出）
    ├── index.html              # HTML 模板
    ├── public/                 # 静态资源（构建时复制到 dist）
    │   └── favicon.svg
    └── src/
        ├── main.tsx            # React 入口
        ├── App.tsx             # 路由配置（登录/日历/个人/管理）
        ├── types/index.ts      # TypeScript 类型定义
        ├── api/                # API 封装层
        │   ├── client.ts       # axios 实例 + 拦截器
        │   ├── auth.ts         # 认证 API
        │   ├── events.ts       # 事件 API（含导入导出 URL 生成）
        │   ├── calendar.ts     # 日历元数据 API
        │   ├── users.ts        # 用户管理 API
        │   ├── profile.ts      # 个人信息 API
        │   ├── audit.ts        # 审计日志 API
        │   └── report.ts       # AI 总结 API（生成/聚合预览/次数）
        ├── stores/auth.tsx     # 认证状态管理（React Context）
        ├── utils/calendar.ts   # 日历工具函数（农历/节气/徽章/节日映射）
        ├── utils/password.ts   # 密码强度校验（与后端规则一致）
        ├── styles/global.css   # 全局样式
        ├── components/         # 通用组件
        │   ├── AppLayout.tsx   # 应用布局（头部 + 内容区）
        │   ├── MonthView.tsx   # 月视图
        │   ├── WeekView.tsx    # 周视图
        │   ├── DayView.tsx     # 日视图
        │   ├── EventModal.tsx  # 事件新增/编辑弹窗（含色盘自定义颜色）
        │   ├── EventDetailModal.tsx # 事件详情弹窗
        │   ├── ImportModal.tsx # 导入弹窗（含模板下载）
        │   ├── ExportModal.tsx # 导出弹窗（月份选择/导出全部）
        │   └── ReportModal.tsx # AI 总结弹窗（手动选时间/事项整理/Markdown 渲染/复制/下载）
        └── pages/              # 页面组件
            ├── Login.tsx       # 登录页
            ├── CalendarPage.tsx # 日历主页
            ├── ProfilePage.tsx # 个人信息页
            └── AdminPage.tsx   # 管理员面板
```

## 快速开始

### 本地开发

```bash
# 1. 安装后端依赖
pip install -r requirements.txt

# 2. 启动后端
python run.py

# 3. 浏览器打开
http://127.0.0.1:5000

# 4. 默认管理员（首次部署时通过环境变量 ADMIN_DEFAULT_PASSWORD 设置密码）
#    若未设置则自动生成随机密码，查看容器日志获取
账号: admin
密码: 见 .env 中的 ADMIN_DEFAULT_PASSWORD 或容器启动日志
```

### 前端开发模式（热更新）

```bash
# 终端 1：启动后端
python run.py

# 终端 2：启动 Vite 开发服务器（代理 API 到后端）
cd frontend-react
npm install
npm run dev
# 访问 http://localhost:5173
```

### 生产构建

```bash
cd frontend-react
npm install
npm run build
# 构建产物在 frontend-react/dist/，由后端自动服务
```

### Docker 部署

**SQLite 单容器（最简单，适合个人使用）**

```bash
docker compose --profile sqlite up -d
# 访问 http://localhost:5000
```

**MySQL + Nginx（生产级，适合团队使用）**

```bash
docker compose --profile mysql up -d
# 访问 http://localhost:8080
```

首次启动自动建表并创建默认管理员账号。重建容器时通过 schema 版本管理跳过重复初始化。

### 停止 & 清理

```bash
# 停止容器
docker compose --profile sqlite down
docker compose --profile mysql down

# 停止并删除数据卷（慎用！）
docker compose --profile mysql down -v
```

### 仅更新前端和后端服务（不影响数据库）

```bash
# MySQL 模式：仅重建并重启 app 容器，mysql 容器不中断
docker compose --profile mysql build app
docker compose --profile mysql up -d app

# SQLite 模式：仅重建并重启 app 容器（数据文件通过 volume 持久化）
docker compose --profile sqlite build app
docker compose --profile sqlite up -d app
```

## 数据库切换

通过环境变量一键切换，无需改代码：

```bash
# SQLite（默认）
set CALENDAR_DB_TYPE=sqlite

# MySQL
set CALENDAR_DB_TYPE=mysql
set CALENDAR_MYSQL_HOST=127.0.0.1
set CALENDAR_MYSQL_PORT=3306
set CALENDAR_MYSQL_USER=root
set CALENDAR_MYSQL_PASSWORD=your_password
set CALENDAR_MYSQL_DB=calendar
```

在 Docker 中直接修改 `docker-compose.yml` 中 `app.environment` 下的 `CALENDAR_DB_TYPE` 值即可。

## 导入导出

页面顶部提供「导出」和「导入」按钮。

**导出**：
1. 点击「导出」→ 弹出导出对话框
2. 选择「按月导出」（选择月份）或「导出全部」（按月份分 Sheet）
3. 导出的 Excel 保留事件颜色和完成状态（删除线）

**导入**：
1. 点击「导入」→ 弹出对话框 → 可先下载空白模板
2. 按模板格式填写事件（日期格子内：`日期\n• 事件内容`）
3. 上传文件 → 点击「开始导入」
4. 导入时自动解析事件颜色和删除线（完成状态）
5. 已存在的相同事件自动跳过

**模板格式**：
- 表格标题：`2026.8`（年.月）
- 表头：周一～周日
- 每个有事件的日期格：`日\n• 事件1\n• 事件2`

## API 接口

所有 API 返回 JSON（导入导出除外）。需要登录的接口通过 Session Cookie 认证。

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/auth/login` | POST | 否 | 登录 |
| `/api/auth/logout` | POST | 否 | 退出 |
| `/api/auth/status` | GET | 否 | 登录状态 |
| `/api/events` | GET/POST | 是 | 查询/创建事件 |
| `/api/events/<id>` | PUT/DELETE | 是 | 更新/删除事件 |
| `/api/events/<id>/toggle` | POST | 是 | 切换完成状态 |
| `/api/events/day` | GET | 是 | 某天事件 |
| `/api/events/week` | GET | 是 | 某周事件 |
| `/api/events/export` | GET | 是 | 导出 Excel（支持 year/month 参数和 all=1 全部导出） |
| `/api/events/import` | POST | 是 | 从 Excel 导入事件（解析颜色与删除线） |
| `/api/events/template` | GET | 否 | 下载空白模板（动态生成） |
| `/api/calendar-meta` | GET | 否 | 日历元数据（农历/节气/节假日） |
| `/api/calendar-meta/refresh` | POST | 管理员 | 刷新元数据缓存 |
| `/api/calendar-meta/status` | GET | 否 | 元数据更新时间 |
| `/api/profile` | GET/PUT | 是 | 个人信息 |
| `/api/profile/password` | PUT | 是 | 修改密码 |
| `/api/users` | GET/POST | 管理员 | 用户列表/创建 |
| `/api/users/<id>` | PUT/DELETE | 管理员 | 修改/删除用户 |
| `/api/users/<id>/reset-password` | POST | 管理员 | 重置密码 |
| `/api/audit-log` | GET | 管理员 | 审计日志 |
| `/api/logins` | GET | 管理员 | 登录日志 |
| `/api/reports/ai` | POST | 是 | AI 总结（period=week\|month\|quarter\|year，start/end 手动起止日期，note 补充说明，items 整理后事项清单，prompt 自定义提示词模板；周报润色模式传 work_done/next_work/help_needed 三块内容） |
| `/api/reports/preview` | GET | 是 | 聚合预览：按时间范围统计事件并返回按标题聚合的清单（不消耗次数；周报额外返回 done_titles/pending_titles/next_titles 三块区域预填数据） |
| `/api/reports/prompt` | GET/PUT | 是 | 获取/保存个人自定义提示词模板（GET 返回 default_prompt + custom_prompt；PUT 传空字符串恢复默认） |
| `/api/reports/usage` | GET | 是 | 本月 AI 总结剩余次数 |

## AI 报告配置

AI 报告通过环境变量配置（详见 `.env.example`），未配置 `AI_API_KEY` 时自动降级为统计型报告：

```bash
AI_REPORT_ENABLED=1                 # 开关
AI_PROVIDER=openai-compatible       # openai-compatible | ollama
AI_API_BASE=https://api.deepseek.com/v1   # OpenAI 兼容地址（结尾不带 /v1）
AI_API_KEY=sk-xxx                   # API Key（Ollama 可留空）
AI_MODEL=deepseek-chat              # 模型名
AI_TIMEOUT=60                       # 请求超时（秒）
AI_MAX_TOKENS=4096                  # 最大生成长度（输出被截断时调大，后端会自动重试一次）
```


## 浏览器支持

Chrome / Firefox / Safari / Edge 最新版本。

## 许可证

MIT
