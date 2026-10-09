---
last_updated: 2026-10-09T04:20:00Z
status: active
---

# Project Context

## Project Overview

InterviewPrep — 基于多智能体协作的面试备战应用。输入 JD 与简历，Agent 团队拆解能力矩阵、联动知识点库、模拟面试并生成复盘报告。核心卖点是 Agent 有记忆、有工具、能自主决策。当前交付目标：跑通"JD 分析 → 差距分析 → 模拟面试 → 复盘报告"完整主链的 Demo。

## Key Decisions

| Date | Decision | By | Rationale |
|------|----------|-----|-----------|
| 2026-10-09 | 用 Atoms 内置登录替代硬编码 `user_id="demo_user"` | Alex | 平台规范禁止自建/无鉴权多用户隔离；登录后按用户隔离，效果等价 |
| 2026-10-09 | 用 Atoms Cloud（Postgres + 边缘函数）替代本地 FastAPI + SQLite | Alex | 平台不承载自建常驻后端进程；行为等价 |
| 2026-10-09 | 结构化决策 JSON + 后端确定性工具编排替代原生 function calling | Alex | 保证各模型都能可靠产出工具调用与决策记录 |
| 2026-10-09 | 流式输出降级为分段返回 + 前端打字机动画 | Alex | 边缘函数不保证 SSE |
| 2026-10-09 | `abilities`/`gaps`/`dialogue` 改为 JSONB | Alex | 需要承载嵌套对象；迁移 4e37a7065af4 做 ARRAY→JSONB 转换 |
| 2026-10-09 | 保留知识库精确匹配，不做向量检索 | Alex | 与需求文档 Demo 简化一致 |

## Constraints

- 不可修改 `app/backend/core/**`、`models/**`、`main.py`、`lambda_handler.py`。
- 所有自定义路由前缀必须为 `/api/v1/`；前端必须用 `@metagptx/web-sdk` 调用，不得用 fetch/axios 直连。
- 模型调用为运行时能力，必须经后端；前端不做内置多模态调用。
- 单页四阶段为 Demo 主链，优先保证闭环而非功能广度。
