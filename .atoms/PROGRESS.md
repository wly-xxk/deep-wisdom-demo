---
last_updated: 2026-10-09T05:05:00Z
---

# Requirements & Progress

## Requirements Overview

InterviewPrep — 面试备战多智能体协作系统（Demo 落地版）。单页应用，顶部步骤条：JD 分析 → 差距分析 → 模拟面试 → 复盘报告。三个核心 Agent：JD 分析师（结构化能力矩阵 + 联动知识点库）、模拟面试官（有记忆/有工具/自主决策）、复盘师（雷达图 + 逐题回顾 + 关键缺口 Top3）。

已与用户确认的技术调整：使用平台内置登录替代硬编码 user_id；使用 Atoms Cloud（Postgres + 边缘函数）替代本地 FastAPI + SQLite；模型输出结构化决策 JSON + 后端确定性工具编排替代原生 function calling；流式输出降级为前端打字机动画。

## User Stories

1. 作为候选人，我粘贴 JD 后能得到结构化能力矩阵（能力项/分类/考察方式/优先级/JD 原文引用/关联知识点），并可直接编辑优先级。
2. 作为候选人，我粘贴简历后能得到逐条差距分析（gap/partial/covered + 证据 + 覆盖分 + 建议）。
3. 作为候选人，我能进入模拟面试，被优先考察缺口能力项，逐题获得三段式反馈，并看到每次提问调用的工具与决策。
4. 面试结束后，我能看到复盘报告（总分、能力雷达图、逐题回顾、关键缺口 Top3）并导出。
5. 作为候选人，我能浏览全局知识点库，并对技术点做个人标记（掌握度/收藏/笔记）。

## Task Breakdown
| ID | Task | Assignee | Status | Deps |
|----|------|----------|--------|------|
| T1 | 后端数据契约：jd_analyses / gap_analyses / interview_sessions / knowledge_points / knowledge_marks | Alex | done | - |
| T2 | 后端 Agent 服务层（JD 分析师 / 差距分析 / 模拟面试官 / 复盘师 + 知识点库工具） | Alex | done | T1 |
| T3 | 后端自定义 API 路由 /api/v1/interview/* 与 /api/v1/knowledge/* | Alex | done | T2 |
| T4 | 前端设计规范 DESIGN.md + 应用外壳与步骤条 | Alex | done | - |
| T5 | 步骤一：JD 分析页（矩阵表格 + 知识点标签 + 优先级编辑） | Alex | done | T3,T4 |
| T6 | 步骤二：差距分析页（左右对照 + 缺口高亮） | Alex | done | T3,T4 |
| T7 | 步骤三：模拟面试页（左侧进度 + 右侧对话 + tool_calls/decision） | Alex | done | T3,T4 |
| T8 | 步骤四：复盘报告页（雷达图 + 逐题回顾 + 缺口 Top3 + 导出） | Alex | done | T3,T4 |
| T9 | 知识点库页（浏览 + 个人标记）与历史记录 | Alex | done | T3,T4 |
| T10 | 校验：pycheck / lint / build / 渲染检查 | Alex | in_progress | T2-T9 |

## Progress Log
- 2026-10-09 创建 5 张表；abilities/gaps/dialogue 调整为 JSONB，迁移 4e37a7065af4 完成 ARRAY→JSONB 转换。
- 2026-10-09 后端完成：knowledge_tools + interview_agents 服务层、interview/knowledge 自定义路由，4 个文件 pycheck 通过。
- 2026-10-09 前端完成：DESIGN.md 深色控制台规范、四阶段页面、知识点库页、历史记录；lint 与 build 通过。
- 2026-10-09 已知非阻塞项：sitemap 插件在 dist 不存在时写 robots.txt 失败，先 mkdir dist 再 build 即可通过（模板既有行为）。
