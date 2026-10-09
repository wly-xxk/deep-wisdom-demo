# 面试助手 · 多智能体面试备战系统

一个由多个 AI Agent 协作的面试准备 Web 应用。粘贴或上传目标岗位 JD 与个人简历后，系统会依次完成：

**JD 分析 → 差距分析 → 模拟面试 → 复盘报告**

并配套一个全局共享的**知识点库**（含 what / why / how 学习文档、个人掌握度标记）与**历史记录**。

> 完整设计说明见 [`docs/DESIGN_REPORT.md`](docs/DESIGN_REPORT.md)。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| JD 分析 | JD 分析师 Agent 把 JD 拆成能力矩阵（能力项 / 分类 / 考察方式 / 优先级 P0–P2 / JD 原文引用 / 关联知识点），优先级可在线修改 |
| 文件上传 | JD 与简历都可以上传 **PDF 或图片**（PNG / JPG / WebP，≤ 20MB），自动识别为可编辑文本 |
| 差距分析 | 逐条比对能力项与简历证据，结果标为 `gap` / `partial` / `covered`，附覆盖分和补强建议 |
| 模拟面试 | 模拟面试官 Agent 优先考察缺口能力，每轮给出三段式反馈；每次提问调用了哪些工具、做了什么决策都可以展开查看 |
| 复盘报告 | 总分、能力雷达图、逐题回顾、关键缺口 Top 3，支持导出 |
| 知识点库 | 全局共享知识点，可按需生成 what / why / how 学习文档，可标记掌握度、收藏和写笔记 |
| 历史记录 | 查看、恢复、删除过往的面试会话 |
| 导航 | 左侧常驻侧边栏和真实路由（`/`、`/knowledge`、`/history`），浏览器后退、刷新、分享链接都能用；工作台进度保存在本地 |

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + React Router + Recharts
- **后端**：Atoms Cloud（FastAPI 自定义路由 + PostgreSQL + SQLAlchemy + Alembic + 内置登录）
- **AI 模型**
  - JD 分析师、复盘师：`claude-opus-5`
  - 模拟面试官：`gpt-5.4`
  - 图片文字识别：`gemini-3.1-pro-preview`
  - PDF 解析：平台内置 PDF 分析接口

## 目录结构

```
.
├── app/
│   ├── frontend/                 # React + Vite 前端
│   │   └── src/
│   │       ├── App.tsx           # 路由定义
│   │       ├── components/
│   │       │   ├── layout/AppLayout.tsx        # 登录守卫 + 侧边栏外壳
│   │       │   └── interview/                  # StepRail、上传按钮、知识文档视图、通用 UI
│   │       ├── contexts/WorkspaceContext.tsx   # 工作台全局状态（localStorage 持久化）
│   │       ├── lib/interview.ts                # 所有后端 API 调用
│   │       ├── lib/types.ts                    # 前端数据契约
│   │       └── pages/
│   │           ├── WorkspacePage.tsx           # 四阶段工作台
│   │           ├── stages/                     # Jd / Gap / Interview / Report 四个阶段
│   │           ├── KnowledgePage.tsx           # 知识点库
│   │           └── HistoryPage.tsx             # 历史记录
│   └── backend/                  # Atoms Cloud 后端（FastAPI）
│       ├── routers/
│       │   ├── interview.py      # /api/v1/interview/*  主流程
│       │   ├── knowledge.py      # /api/v1/knowledge/*  知识点库与标记
│       │   └── file_extract.py   # /api/v1/interview/extract_text  PDF/图片识别
│       ├── services/
│       │   ├── interview_agents.py   # 三个 Agent 的编排核心
│       │   └── knowledge_tools.py    # 知识点库工具层
│       ├── models/               # SQLAlchemy 模型
│       └── alembic/              # 数据库迁移
├── docs/DESIGN_REPORT.md         # 设计报告
└── 面试备战多智能体协作系统-精简版需求文档.md
```

## 本地运行

> 本项目主要运行在 Atoms 平台上，平台已经托管了后端、数据库、登录和 AI 能力。脱离平台在本地运行时，需要自己提供这些服务的配置。

### 前端

```bash
cd app/frontend
pnpm install
pnpm run dev        # 开发模式
pnpm run lint       # 代码检查
mkdir -p dist && pnpm run build   # 生产构建（sitemap 插件要求 dist 目录已存在）
```

### 后端

```bash
cd app/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

`routers/` 下的路由会被自动发现和注册，不需要手动 `include_router`。

## 主要 API

所有接口都需要登录，数据按用户隔离（知识点本体是全局共享的）。

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/v1/interview/extract_text` | 从 PDF / 图片中识别 JD 或简历文本 |
| POST | `/api/v1/interview/analyze_jd` | JD 分析，生成能力矩阵 |
| POST | `/api/v1/interview/update_abilities` | 修改能力项优先级 |
| POST | `/api/v1/interview/analyze_gap` | 简历差距分析 |
| POST | `/api/v1/interview/start_session` | 开始模拟面试 |
| POST | `/api/v1/interview/answer` | 提交回答，返回反馈和下一题 |
| POST | `/api/v1/interview/generate_report` | 生成复盘报告 |
| GET | `/api/v1/interview/sessions` | 历史会话列表 |
| GET / DELETE | `/api/v1/interview/session/{id}` | 获取 / 删除单个会话 |
| GET | `/api/v1/knowledge/points` | 知识点列表 |
| GET | `/api/v1/knowledge/point/{id}` | 知识点详情 |
| POST | `/api/v1/knowledge/point/{id}/doc` | 生成学习文档（加 `?regenerate=true` 强制重新生成） |
| POST | `/api/v1/knowledge/mark` | 保存个人标记 |
| GET | `/api/v1/knowledge/marks` | 我的标记列表 |

## 使用流程

1. 登录后进入**工作台**，粘贴 JD 或点「上传 JD（PDF/图片）」，然后点「开始分析」。
2. 检查能力矩阵，按需调整优先级；粘贴或上传简历，进入**差距分析**。
3. 开始**模拟面试**，逐题作答，查看每轮反馈和面试官的决策过程。
4. 结束后生成**复盘报告**，对照关键缺口到**知识点库**里查漏补缺。
5. 在**历史记录**里可以回看任意一次面试。
