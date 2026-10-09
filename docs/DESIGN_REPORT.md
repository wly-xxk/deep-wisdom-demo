# 面试助手 · 设计报告

> 版本：v1.0 · 日期：2026-10-09
> 依据：《面试备战多智能体协作系统-精简版需求文档》及后续迭代需求

---

## 1. 项目背景与目标

候选人准备面试时一般会遇到三个问题：

1. **看不懂 JD 的真实要求**：JD 措辞宽泛，很难判断哪些能力是重点。
2. **不清楚自己差在哪**：简历和岗位要求之间缺少逐条对照。
3. **缺少有针对性的练习**：常见题库和具体岗位、个人短板对不上。

本系统用**多个分工明确的 AI Agent 协作**来解决这三个问题，形成一个闭环：

```
JD 分析 ──▶ 差距分析 ──▶ 模拟面试 ──▶ 复盘报告
   │                         │              │
   └─────────── 知识点库（全局共享、持续沉淀）◀──┘
```

设计目标：

- **结构化**：每一步都输出结构化、可编辑、可追溯的数据，而不是一段自由文本。
- **真正的 Agent 行为**：面试官有记忆、会调用工具，能根据缺口自主决定下一题考什么；每次决策都记录下来，用户可以展开查看。
- **知识可复用**：知识点只生成一次，写入全局库，后续所有用户直接命中复用。
- **低门槛输入**：JD 和简历都支持粘贴文本，也支持上传 PDF 或截图。

## 2. 总体架构

### 2.1 架构图

```
┌───────────────────────────── 浏览器 ─────────────────────────────┐
│  AppLayout（登录守卫 + 侧边栏）                                   │
│   ├─ /           WorkspacePage  ── StepRail ── 4 个 Stage 组件     │
│   ├─ /knowledge  KnowledgePage                                    │
│   └─ /history    HistoryPage                                      │
│  WorkspaceContext（全局状态，localStorage 持久化）                 │
│  lib/interview.ts（统一 API 层，client.apiCall.invoke）            │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS + 登录态
┌───────────────────────────────▼──────── Atoms Cloud ─────────────┐
│ routers/                                                          │
│   interview.py    主流程 API                                       │
│   knowledge.py    知识点库 API                                     │
│   file_extract.py PDF / 图片 → 文本                                │
│ services/                                                         │
│   interview_agents.py  JD 分析师 / 差距分析 / 面试官 / 复盘师       │
│   knowledge_tools.py   query_knowledge_base 等工具                 │
│   aihub.py             平台 AI 能力（文本 / 多模态 / PDF）          │
│ PostgreSQL：jd_analyses / gap_analyses / interview_sessions /     │
│             knowledge_points / knowledge_marks                    │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 18 + TypeScript + Vite | 类型安全，构建快 |
| UI | Tailwind + shadcn/ui，自定义深色控制台主题 | 信息密度高，适合以表格和对话为主的工具型界面 |
| 路由 | React Router（嵌套路由） | 真实 URL，浏览器后退、刷新、分享都能用 |
| 图表 | Recharts | 复盘报告里的能力雷达图 |
| 后端 | Atoms Cloud（FastAPI + PostgreSQL） | 托管登录、数据库和 AI 能力，不用自己运维 |
| 认证 | 平台内置登录 | 数据按用户隔离，不另建一套账号体系 |

## 3. 多智能体设计

### 3.1 Agent 分工

| Agent | 模型 | 输入 | 输出 | 使用的工具 |
|-------|------|------|------|------------|
| JD 分析师 | claude-opus-5 | JD 文本 | 能力矩阵 + 知识点标签 | `query_knowledge_base` |
| 差距分析 | claude-opus-5 | 能力矩阵 + 简历 | 逐条 gap / partial / covered + 证据 + 建议 | — |
| 模拟面试官 | gpt-5.4 | 能力矩阵 + 差距 + 对话历史 | 提问 / 三段式反馈 / 决策 | `get_next_ability`、`query_knowledge_base`、`record_answer` |
| 复盘师 | claude-opus-5 | 完整会话 | 总分、雷达数据、逐题回顾、缺口 Top 3 | — |

### 3.2 共享上下文（黑板模式，存在数据库里）

边缘函数是无状态的，进程内存不能跨请求保留。所以 Agent 之间共享的"黑板"放在 `interview_sessions` 表里：

- `abilities` / `gaps`：上游 Agent 的产出，面试官只读取。
- `dialogue[]`：每一轮的问题、回答、反馈，以及本轮的 `tool_calls` 和 `decision`。
- `abilities_examined` / `abilities_remaining` / `current_ability_id`：面试进度。
- `report`：复盘师的最终产出。

每个请求开始时从数据库加载状态，结束时写回，这样每一步都可以断点续接。

### 3.3 工具调用机制

没有使用模型原生的 function calling，而是采用**"模型输出结构化决策 JSON + 后端确定性执行工具"**：

1. 模型按约定的 JSON Schema 输出决策，例如 `{"action": "follow_up" | "next_ability", "reason": ..., "question": ...}`。
2. 后端校验之后，按决策执行对应工具（选下一个能力项、查询知识库、记录回答）。
3. 工具调用的名称、参数、结果都写进 `dialogue[].tool_calls`，前端可以展开查看。

这样做的好处：不依赖某个模型是否支持 function calling；工具执行结果是确定的；整个过程完全可追溯。

### 3.4 面试官的提问策略

- 按优先级排序：先考 `gap` 的 P0 能力项，再考 `partial`，最后用 `covered` 做验证。
- 回答不充分时，面试官可以决定**追问**，追问轮数有上限，到了就换下一个能力项。
- 每轮反馈固定为三段式：**亮点 / 不足 / 参考答案要点**。

### 3.5 结构化输出的可靠性

所有关键的 AI 输出都走同一套流程：

```
Schema 约束提示词 → 非流式完整输出 → 提取 JSON 代码块 → 校验必填字段
       → 失败时修复重试一次 → 仍失败则返回可重试的错误
```

慢的 AI 调用不放在打开的数据库事务里：先读完数据库，再调用 AI，最后单独写回。

## 4. 知识点库设计

### 4.1 全局共享 + 个人标记

- `knowledge_points`：**全局**表，所有用户共享，`name` 唯一。
- `knowledge_marks`：**用户私有**表，记录掌握度、是否收藏和个人笔记。

### 4.2 查询与写回（`query_knowledge_base`）

```
按技术名精确匹配（不区分大小写）
  ├─ 命中 → 直接复用，引用计数 +1，标记为 hit
  └─ 未命中 → 调用 LLM 生成定义 / 要点 / 常见考点 / 相关技术
            → 写入全局库，标记为 new
```

前端用不同颜色的标签区分"命中复用"和"新生成"，用户可以直观看到知识库在不断积累。

### 4.3 学习文档（what / why / how）

- 用户点开知识点时按需生成，结果存在 `doc`（JSONB）字段里，以后直接读取缓存。
- 支持 `?regenerate=true` 强制重新生成。

## 5. 文件上传与识别

| 类型 | 处理方式 |
|------|----------|
| PDF | 平台内置 PDF 分析接口，`extract` 模式 |
| 图片（PNG / JPG / WebP） | `gemini-3.1-pro-preview` 多模态识别 |

- 前端把文件读成 base64 data URI，用 JSON 发送到 `/api/v1/interview/extract_text`，请求超时设为 10 分钟。
- 根据 `kind`（`jd` / `resume`）使用不同的提取指令，要求忠实保留原有条目结构，不做总结。
- 识别结果填进文本框，用户可以先修改再提交分析。
- 前后端都有校验：文件大小不超过 20MB、只接受指定类型、识别出的有效文字不能太少，否则给出明确的错误提示。

## 6. 数据模型

| 表 | 关键字段 | 隔离方式 |
|----|----------|----------|
| `jd_analyses` | company, position, jd_text, abilities (JSONB), summary, status | 按用户 |
| `gap_analyses` | jd_id, resume_text, gaps (JSONB), summary | 按用户 |
| `interview_sessions` | jd_id, gap_id, abilities / gaps / dialogue (JSONB), abilities_examined / abilities_remaining (JSONB), current_ability_id, round_count, status, report (JSONB) | 按用户 |
| `knowledge_points` | name（唯一）, category, definition, key_points, common_exam_points, related_technologies, doc (JSONB), version, feedback_count | 全局共享 |
| `knowledge_marks` | tech_id, tech_name, mastery, favorited, personal_notes | 按用户 |

嵌套结构统一用 JSONB 存储，并通过迁移 `4e37a7065af4` 完成了 `ARRAY → JSONB` 的转换。`created_at` / `updated_at` 由 ORM 自动维护。

### 能力项（Ability）结构示例

```json
{
  "id": "a1",
  "name": "大规模监控体系设计",
  "category": "架构设计",
  "exam_method": "系统设计题",
  "priority": "P0",
  "jd_reference": "负责大规模监控体系（百万级指标）的架构设计与演进",
  "technologies": ["Prometheus", "Kubernetes"]
}
```

## 7. 前端设计

### 7.1 信息架构

- **左侧常驻侧边栏**：工作台 / 知识点库 / 历史记录。移动端折叠成顶部菜单。
- **工作台内部**：用 StepRail 展示四个阶段，没完成的阶段不能跳过（由 `reachable` 控制）。
- **真实路由**：`/`、`/knowledge`、`/history`，支持浏览器后退、刷新和分享链接。

### 7.2 状态管理

`WorkspaceContext` 统一管理 JD、简历、各阶段结果和当前会话，持久化到 `localStorage`（key：`interviewprep:state:v1`）：

- 面试进行到一半切到知识点库查资料，再切回来，进度还在。
- 刷新页面后可以接着做。
- 在历史记录里点「打开」，会把那次会话整体载入工作台。

### 7.3 视觉规范

深色控制台风格，追求高信息密度和清晰的层级：

- 通用样式类：`panel`、`btn btn-primary / secondary / ghost`、`tag`、`eyebrow`、`field`、`table-shell`。
- 颜色统一用 CSS 变量（如 `hsl(var(--brand))`）。
- 状态色：缺口（gap）、部分覆盖（partial）、已覆盖（covered）、新生成知识点（new）、命中知识点（hit）各有固定颜色。
- 所有 AI 操作都有加载状态、错误提示和重试入口，不会出现"转一圈什么都没发生"的情况。

## 8. 安全与隐私

- 所有业务接口都要求登录，查询时强制按 `user_id` 过滤。
- 知识点本体全局共享，但不包含任何用户数据；个人标记单独存放。
- 上传的文件只在识别时使用，不会存储原文件。
- 密钥和环境变量不进入代码仓库（已在 `.gitignore` 中排除 `.env`）。

## 9. 与需求文档的差异说明

| 需求原文 | 实际实现 | 原因 |
|----------|----------|------|
| 硬编码 `user_id` | 平台内置登录 | 真正支持多用户，数据互相隔离 |
| 本地 FastAPI + SQLite | Atoms Cloud（FastAPI + PostgreSQL） | 托管部署，支持并发 |
| 模型原生 function calling | 结构化决策 JSON + 后端执行工具 | 不依赖特定模型，结果确定、可追溯 |
| SSE 流式输出 | 完整返回 + 前端打字机动画 | 结构化结果需要拿到完整内容才能校验 |
| PDF / 图片解析（原计划二期） | 已实现 | 根据用户反馈提前上线 |

## 10. 已知限制与后续规划

**已知限制**

- 图片识别的效果取决于图片清晰度；扫描版 PDF 如果页数很多，识别会比较慢。
- 知识点按名称精确匹配，同义词（如 "K8s" 和 "Kubernetes"）目前算作两个知识点。
- 前端打包后体积较大（主包约 900KB），还没有做按路由拆包。

**后续规划**

1. 知识点同义词归并和向量检索。
2. 语音作答（语音转文字）。
3. 多次面试的趋势对比报告。
4. 按路由拆分代码，加快首屏加载。
