import { useState } from 'react';
import { FileText, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AgentAvatar,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Panel,
  PanelHeader,
  PriorityPill,
} from '@/components/interview/ui';
import { analyzeJd, getErrorDetail, updateJdAbilities } from '@/lib/interview';
import type { Ability, JdResult, Priority } from '@/lib/types';

const SAMPLE_JD = `岗位职责：
1. 负责大规模监控体系（百万级指标）的架构设计与演进，保障可观测性覆盖核心业务链路；
2. 基于 Kubernetes 与 Prometheus 构建统一采集、告警与容量治理平台；
3. 主导 MySQL、Redis 等核心中间件的稳定性治理与性能优化；
4. 推动 SRE 工程实践，落地变更发布、故障演练与应急预案；
5. 与业务团队协作，输出架构方案并推动跨团队落地。
任职要求：
1. 5 年以上后端或基础设施经验，精通容器编排与云原生技术栈；
2. 具备大规模分布式系统的故障定位与性能调优能力；
3. 有较强的问题抽象与沟通表达能力。`;

interface Props {
  result: JdResult | null;
  jdText: string;
  resumeText: string;
  onResult: (result: JdResult, jdText: string) => void;
  onJdTextChange: (text: string) => void;
  onResumeTextChange: (text: string) => void;
  onNext: () => void;
}

export function JdStage({
  result,
  jdText,
  resumeText,
  onResult,
  onJdTextChange,
  onResumeTextChange,
  onNext,
}: Props) {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<JdResult | null>(result);
  const [savingPriority, setSavingPriority] = useState<string | null>(null);

  const shown = draft ?? result;

  const handleAnalyze = async () => {
    if (jdText.trim().length < 20) {
      setError('请粘贴完整的 JD 文本（至少 20 个字符）');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await analyzeJd({ jd_text: jdText, company, position });
      setDraft(data);
      onResult(data, jdText);
      toast.success(`已拆解 ${data.abilities.length} 条能力项，关联 ${data.knowledge_tags.length} 个知识点`);
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePriorityChange = async (ability: Ability, priority: Priority) => {
    if (!shown) return;
    const next = shown.abilities.map((item) =>
      item.id === ability.id ? { ...item, priority } : item,
    );
    setDraft({ ...shown, abilities: next });
    setSavingPriority(ability.id);
    try {
      await updateJdAbilities(shown.jd_id, next);
      onResult({ ...shown, abilities: next }, jdText);
      toast.success(`${ability.name} 优先级已更新为 ${priority}`);
    } catch (e) {
      toast.error(getErrorDetail(e));
      setDraft(shown);
    } finally {
      setSavingPriority(null);
    }
  };

  if (!shown) {
    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader
            eyebrow="Step 01 · Agent: JD 分析师"
            title="粘贴目标岗位 JD"
            description="分析师会拆解能力矩阵，并在分析过程中主动调用知识点库工具。"
            action={
              <button type="button" className="btn btn-ghost h-8" onClick={() => onJdTextChange(SAMPLE_JD)}>
                <FileText className="h-3.5 w-3.5" />
                填入示例 JD
              </button>
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">公司（可选）</span>
              <input
                className="field mt-1.5"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="如：某云厂商"
              />
            </label>
            <label className="block">
              <span className="eyebrow">岗位（可选）</span>
              <input
                className="field mt-1.5"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="如：SRE 工程师"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="eyebrow">JD 原文</span>
            <textarea
              className="field mt-1.5 min-h-[280px] resize-y font-mono text-[13px] leading-6"
              value={jdText}
              onChange={(e) => onJdTextChange(e.target.value)}
              placeholder="把招聘网站上的 JD 纯文本粘贴到这里…"
            />
          </label>
          {error && <div className="mt-3">{<ErrorNote message={error} onRetry={handleAnalyze} />}</div>}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              当前阶段只支持纯文本粘贴（PDF / 图片解析为二期能力）。
            </p>
            <button type="button" className="btn btn-primary" onClick={handleAnalyze} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? '分析师拆解中…' : '开始分析'}
            </button>
          </div>
          {loading && (
            <div className="mt-4">
              <LoadingBlock label="JD 分析师正在拆解能力项，并联动知识点库…" />
            </div>
          )}
        </Panel>

        <div className="space-y-4 lg:col-span-5">
          <Panel>
            <PanelHeader eyebrow="Agent 状态" title="协作流水线" />
            <ul className="space-y-3 text-[13px]">
              {[
                { name: 'JD 分析师', state: '待命', tone: 'brand', detail: '拆解能力矩阵 + 调用知识点库' },
                { name: '模拟面试官', state: '等待上游', tone: 'muted', detail: '有记忆、有工具、能自主决策' },
                { name: '复盘师', state: '等待上游', tone: 'muted', detail: '雷达图 + 逐题回顾 + 关键缺口' },
              ].map((agent) => (
                <li key={agent.name} className="flex items-start gap-3">
                  <AgentAvatar agent={agent.name === 'JD 分析师' ? 'analyst' : agent.name === '模拟面试官' ? 'interviewer' : 'reviewer'} size="sm" busy={agent.tone === 'brand'} />
                  <div>
                    <p className="font-medium text-foreground">
                      {agent.name}
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                        {agent.state}
                      </span>
                    </p>
                    <p className="text-[12px] text-muted-foreground">{agent.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="工作方式" title="为什么这是 Agent 而不是提示词" />
            <ul className="space-y-2.5 text-[13px] leading-6 text-muted-foreground">
              <li>· 分析过程中主动调用 <span className="font-mono text-foreground">query_knowledge_base</span>，命中即复用，未命中则生成并写回全局库。</li>
              <li>· 面试官读取能力矩阵与差距分析作为共享上下文，按缺口动态决定考什么。</li>
              <li>· 每次提问与反馈都记录真实的 tool_calls 与 decision，可追溯。</li>
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <Panel>
          <PanelHeader
            eyebrow="Step 01 · 能力矩阵"
            title={`${shown.company || '目标公司'} · ${shown.position || '目标岗位'}`}
            description={shown.summary}
            action={
              <button type="button" className="btn btn-secondary h-8" onClick={handleAnalyze} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                重新分析
              </button>
            }
          />
          {error && <div className="mb-3"><ErrorNote message={error} onRetry={handleAnalyze} /></div>}
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th className="w-[30%]">能力项</th>
                  <th>分类 / 考察方式</th>
                  <th className="w-[86px]">优先级</th>
                  <th className="w-[26%]">关联知识点</th>
                </tr>
              </thead>
              <tbody>
                {shown.abilities.map((ability) => (
                  <tr key={ability.id}>
                    <td>
                      <p className="font-medium text-foreground">{ability.name}</p>
                      {ability.jd_reference && (
                        <p className="mt-1.5 border-l-2 border-[hsl(var(--border-strong))] pl-2 font-mono text-[11px] leading-5 text-faint">
                          {ability.jd_reference}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className="tag">{ability.category}</span>
                      <span className="tag ml-1.5">{ability.exam_method}</span>
                    </td>
                    <td>
                      <select
                        aria-label={`${ability.name} 优先级`}
                        className="w-full rounded-md border border-border bg-[hsl(var(--surface-raised))] px-1.5 py-1 font-mono text-[12px] text-foreground"
                        value={ability.priority}
                        disabled={savingPriority === ability.id}
                        onChange={(e) => handlePriorityChange(ability, e.target.value as Priority)}
                      >
                        <option value="P0">P0</option>
                        <option value="P1">P1</option>
                        <option value="P2">P2</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {ability.technologies.length === 0 && (
                          <span className="text-[12px] text-faint">未识别到通用技术名</span>
                        )}
                        {ability.technologies.map((tech) => {
                          const hit = shown.knowledge_tags.find(
                            (tag) => tag.name.toLowerCase() === tech.toLowerCase(),
                          );
                          return (
                            <span
                              key={tech}
                              className={`tag ${hit ? (hit.is_new ? 'tag-new' : 'tag-agent') : 'tag-hit'}`}
                              title={hit ? `${hit.category}：${hit.definition}` : '未关联知识点'}
                            >
                              {tech}
                              {hit?.is_new && <span className="text-[9px] uppercase">new</span>}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Step 02 准备 · 简历"
            title="粘贴你的简历文本"
            description="用于生成差距分析：逐条比对能力项与简历证据。"
          />
          <textarea
            className="field min-h-[180px] resize-y text-[13px] leading-6"
            value={resumeText}
            onChange={(e) => onResumeTextChange(e.target.value)}
            placeholder="把简历正文粘贴到这里（纯文本）…"
          />
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onNext}>
              下一步：差距分析
            </button>
          </div>
        </Panel>
      </div>

      <div className="space-y-4 lg:col-span-4">
        <Panel>
          <PanelHeader
            eyebrow="工具调用记录"
            title="知识点库联动"
            description={`本次共关联 ${shown.knowledge_tags.length} 个知识点。`}
          />
          {shown.knowledge_tags.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="未识别到通用技术名词"
              description="JD 中若没有出现明确技术名，知识点库不会被联动。"
            />
          ) : (
            <ul className="space-y-3">
              {shown.knowledge_tags.map((tag) => (
                <li key={tag.id} className="rounded-md border border-border bg-[hsl(var(--surface-raised)/0.6)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-medium text-foreground">{tag.name}</span>
                    <span className={`tag ${tag.is_new ? 'tag-new' : 'tag-agent'}`}>
                      {tag.is_new ? '新生成入库' : '命中已有'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{tag.definition}</p>
                  {tag.common_exam_points.length > 0 && (
                    <p className="mt-2 font-mono text-[11px] leading-5 text-faint">
                      考点：{tag.common_exam_points.slice(0, 3).join(' / ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
