---
last_updated: 2026-10-09T04:20:00Z
---

# Architecture

## Overview

InterviewPrep 采用前后端分离：前端 React + Vite + shadcn/ui（深色 Linear 风格控制台），后端为 Atoms Cloud（PostgreSQL + FastAPI 边缘函数 + 内置登录）。三个 Agent 编排在单个后端服务层内完成。

## Pages / Routes

单页应用 `/`，顶部 StepRail 四阶段内联切换：JD 分析 → 差距分析 → 模拟面试 → 复盘报告；另有 `/knowledge` 知识点库页与 `/auth/callback`。

## Modules

- `backend/services/interview_agents.py` — Agent 编排核心：JD 分析师（能力矩阵 + 知识点库联动）、差距分析 pipeline、模拟面试官（记忆 + 工具 + 决策循环）、复盘师（报告 + 雷达数据）。
- `backend/services/knowledge_tools.py` — 知识点库工具层：精确匹配查询、LLM 生成后写入、引用计数递增。
- `backend/routers/interview.py` — 自定义 API `/api/v1/interview/*`。
- `backend/routers/knowledge.py` — 知识点库查询与个人标记 API。
- 自动生成的实体 CRUD：`jd_analyses` / `gap_analyses` / `interview_sessions` / `knowledge_points` / `knowledge_marks`。

## Data Model

| Table | Key fields | Notes |
|-------|-----------|-------|
| jd_analyses | company, position, jd_text, abilities(JSONB), summary, status | 用户级隔离，能力矩阵存 JSONB |
| gap_analyses | jd_id, resume_text, gaps(JSONB), summary | 用户级隔离 |
| interview_sessions | jd_id, gap_id, abilities/gaps/dialogue(JSONB), abilities_examined/remaining(JSONB), current_ability_id, round_count, status, report(JSONB) | Agent 共享上下文持久化 |
| knowledge_points | name(唯一), category, definition, key_points[], common_exam_points[], related_technologies[], version, feedback_count | 全局共享，`create_only=false` |
| knowledge_marks | tech_id, tech_name, mastery, favorited, personal_notes | 用户私有 |

## Key Decisions

| Decision | Detail |
|----------|--------|
| 认证 | 复用 Atoms 内置登录（`client.auth.me/toLogin/login`），数据按登录用户隔离；不做硬编码 `demo_user`。 |
| 后端形态 | 平台云后端替代自建 FastAPI + SQLite；会话状态显式落库（函数无常驻内存，黑板模式改为 DB-backed session_state）。 |
| 工具调用 | 模型输出结构化决策 JSON + 后端确定性工具编排（`query_knowledge_base` / `get_next_ability` / `record_answer`），真实记录到 `dialogue[].tool_calls`，不依赖模型原生 function calling。 |
| 流式输出 | 边缘函数按段返回；前端以打字机动画呈现，不假设 SSE。 |
| 嵌套结构 | `abilities` / `gaps` / `dialogue` 使用 JSONB 承载嵌套对象，配套迁移 `4e37a7065af4` 做 `ARRAY → JSONB` 转换。 |
| 模型选型 | JD 分析师与复盘师用 `claude-opus-5`（结构化质量优先）；模拟面试官用 `gpt-5.4`（多轮对话稳定）。 |
