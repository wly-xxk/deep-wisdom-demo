# DESIGN.md — InterviewPrep

## Direction & Layout

**Product**: InterviewPrep，一个多智能体协作的面试备战工作台。用户粘贴 JD 与简历，三个 Agent（JD 分析师 / 模拟面试官 / 复盘师）在同一条链路上接力工作，产出能力矩阵、差距分析、带工具调用记录的模拟面试、以及复盘报告。

**Mood**: 冷静、专业、有工程质感的"作战室"。像开发者的工具，不像招聘网站。信息密度偏高但秩序清晰，Agent 的工作过程要"可见"——每条提问旁边能看见它调用了什么工具、做了什么决策。

**First visual signal**: 首屏是一条横向的四段步骤轨道（JD 分析 → 差距分析 → 模拟面试 → 复盘报告），当前阶段用薄荷绿信号色点亮，轨道上带一条流动的进度线；左侧是较大的 JD 输入卡，右侧是 Agent 状态面板，显示"JD 分析师 · 待命"。

**Should feel / should NOT feel**: 应该像一个可信任的工程控制台，克制、有确定感。不要做成营销落地页、不要渐变霓虹、不要圆角气泡堆砌的聊天玩具。

**Focal point**: 每个阶段只有一个主视觉区域（输入区 / 对照区 / 对话区 / 报告区），其余为辅助信息。

**Hero composition**: 非居中堆叠。桌面端左侧 62% 为主操作区，右侧 38% 为 Agent 状态与上下文卡片。移动端改为上下堆叠，主操作区在上。

**Grid & density**: 最大内容宽度 1280px，桌面 12 列栅格（主区 7 列 / 侧区 5 列），卡片间距 16px，区块间距 32px。信息密度偏紧凑，行高紧凑但正文不小于 14px。

**Breakpoints**: `sm < 768`（单列，步骤条横向可滚动，侧栏下沉）、`md 768–1279`（主区 1 列 + 侧区下沉）、`lg >= 1280`（主区 7 / 侧区 5 双列）。

**Do / Don't**:
- Do：状态一律用文字 + 颜色双重编码（"缺口 / 部分覆盖 / 已覆盖"），不只用颜色。
- Do：Agent 的工具调用与决策必须显式展示成标签（`query_knowledge_base`、`follow_up`）。
- Don't：不使用蓝紫渐变、发光边框、玻璃拟态卡片。
- Don't：不使用纯图标按钮承载主操作，主 CTA 必须是带文字的按钮。
- Don't：不把关键流程藏进弹窗；四个阶段始终在主区域内联呈现。

## Tokens

**Colors**（深色主题，单一信号色系）
- `--bg`: `#0A0B0D` — 页面底色
- `--surface`: `#131519` — 卡片/面板
- `--surface-raised`: `#1A1D23` — 悬浮层、输入框、表格头
- `--border`: `#262A31` — 1px 分隔与描边
- `--border-strong`: `#343A43` — 聚焦/激活态描边
- `--text`: `#EDEFF2` — 主文本
- `--text-muted`: `#A2A9B4` — 次要文本
- `--text-faint`: `#6E7681` — 标签、元信息
- `--accent`: `#5BE9B0` — 薄荷绿，主 CTA、当前步骤、已覆盖
- `--accent-ink`: `#06231A` — 薄荷绿按钮上的文字色（深墨绿，保证对比）
- `--agent`: `#8B93FF` — 淡紫蓝，Agent 身份与工具调用标签
- `--warn`: `#F5B451` — 琥珀，P1 / 部分覆盖
- `--danger`: `#F2707A` — 玫红，P0 缺口 / 错误
- `--info`: `#58C8F5` — 天蓝，中性提示
- 强调色稀缺使用：仅用于当前步骤、主按钮、状态点。大面积留给 `--bg` 与 `--surface`。

**Typography**（Google Fonts 免费字体）
- Display/标题：`Space Grotesk`（`'Space Grotesk', system-ui, sans-serif`）— 略带几何感的窄字面，用于页面标题、步骤名、卡片标题。
- 正文：`IBM Plex Sans`（`'IBM Plex Sans', system-ui, sans-serif`）— 中性、工程感，用于正文、按钮、表格。
- 技术/数据：`JetBrains Mono`（`'JetBrains Mono', ui-monospace, monospace`）— 技术标签、工具名、分数、JD 引用。
- 字号：H1 28px/700/1.2；H2 20px/600/1.3；H3 16px/600/1.35；正文 14px/400/1.6；表格正文 13px/400/1.5；说明与元信息 12px/400/1.5；技术标签 12px/500/1.4（monospace）。

**Spacing & shapes**
- 间距刻度：4 / 8 / 12 / 16 / 24 / 32 / 48。
- 圆角：输入框与按钮 6px；卡片与面板 10px；徽章/标签/优先级药丸 999px。
- 图标按钮：方形 32px、6px 圆角（非圆形，保持工具感）。
- 表格：无竖线，仅 1px 水平分隔（`--border`），表头使用 `--surface-raised`。

**Elevation & depth**
- 层次靠"表面色阶 + 1px 描边"，不靠阴影。
- 悬浮层（下拉、弹层）：`--surface-raised` + `1px --border-strong` + `0 8px 24px rgba(0,0,0,.45)`。
- 粘性顶栏：`--bg` 加 88% 不透明度 + `backdrop-blur(8px)` + 底部 1px `--border`。

## Shared Patterns & States

**StepRail（步骤轨道）**: 四段等宽步骤，含序号、名称、状态点。已完成 = `--accent` 文字 + 实心点；当前 = `--accent` 描边底 + 加粗；未开始 = `--text-faint`。连接线用 2px，已完成段为 `--accent`，其余 `--border`。高度 56px，粘性置顶。

**Panel（面板卡）**: `--surface` + 1px `--border` + 10px 圆角 + 20px 内边距。标题区左对齐，右侧放操作。

**Button**: `primary` = `--accent` 底 + `--accent-ink` 文字；`secondary` = `--surface-raised` 底 + `--border-strong` 描边 + `--text`；`ghost` = 透明底 + `--text-muted`，hover 变 `--text` + `--surface-raised` 底。高度 36px（默认）/ 32px（小），内边距 14px。禁用 = 40% 不透明度 + 不可点。加载 = 文字前 14px 旋转指示器，宽度不塌陷。

**AbilityRow（能力项行）**: 表格行内包含能力名、分类标签、考察方式、优先级药丸（P0 玫红 / P1 琥珀 / P2 灰）、JD 引用（monospace、`--text-faint`、可截断）、关联知识点标签。优先级为可编辑下拉。

**KnowledgeTag**: 药丸标签，monospace 12px，`--surface-raised` 底 + `--border-strong` 描边；命中已有知识点为淡紫蓝描边，新生成入库为薄荷绿描边并附 `new` 小标记。

**DialogueMessage**: 面试官消息左侧带 Agent 头像块（`--agent` 底、深色字母）+ 工具调用标签行（monospace、`--agent` 描边）与决策标签（`follow_up` / `switch_topic` / `end`）；用户消息右对齐、`--surface-raised` 底。三段式反馈用三个带标签的小块：好的地方（薄荷绿）、不足（琥珀）、改进版（天蓝）。

**RadarPanel**: recharts RadarChart，网格线 `--border`，雷达面 `--accent` 20% 填充 + `--accent` 描边，轴标签 `--text-muted` 12px。

**States**: 
- loading：骨架块 + `--surface-raised`；Agent 工作中显示头像 + 脉冲点 + 动态文案（"JD 分析师正在拆解能力项…"）。
- empty：居中图标 + 一句说明 + 主 CTA（例如"粘贴一份 JD 开始"）。
- error：`--danger` 左边框块 + 说明 + "重试"按钮，不覆盖已有内容。
- success：薄荷绿描边提示条，2s 后自动淡出。

**Motion**: 强度克制。hover/active 140ms `ease-out`；步骤切换与面板入场 220ms `ease-out`（仅 opacity + 4px 位移）；Agent 工作脉冲 1.6s 循环；流式文本打字机每 18ms 一个字符。主内容首屏立即渲染，不依赖滚动触发动画。

**Accessibility**: 点击目标最小 32×32px；正文对比度 ≥ 4.5:1（`--text` on `--bg` 约 15:1，`--text-muted` 约 7:1）；焦点环 `2px --accent` + 2px offset；所有图标按钮带 `aria-label`；步骤轨道可键盘 Tab 切换；表单错误在字段下方以 `--danger` 文本给出。

## Media

本项目是操作型控制台界面，**不需要摄影类图像**：用户注意力应集中在结构化数据（能力矩阵、对话、雷达图）上，装饰性大图会削弱信息密度。

- Agent 身份用**字母头像块**（纯 CSS：`--agent` / `--accent` 底色 + 首字），不使用外部图片资源。
- 雷达图与进度以 **recharts / SVG / CSS** 直接绘制，不使用位图。
- 明确不接受：抽象渐变背景图、AI 生成的装饰插画、占位式图库照片。
- 唯一允许的"图形资产"是数据可视化本身（雷达图、进度条、状态点），它们由数据驱动而非静态图片。
