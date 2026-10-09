import { useState } from 'react';
import { Loader2, Target } from 'lucide-react';
import {
  EmptyState,
  ErrorNote,
  GapStatusPill,
  LoadingBlock,
  Panel,
  PanelHeader,
  PriorityPill,
  ScoreMeter,
} from '@/components/interview/ui';
import { analyzeGap, getErrorDetail } from '@/lib/interview';
import type { GapResult, JdResult } from '@/lib/types';

interface Props {
  jd: JdResult | null;
  resumeText: string;
  gapResult: GapResult | null;
  onGapResult: (result: GapResult) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GapStage({ jd, resumeText, gapResult, onGapResult, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!jd) {
      setError('请先完成 JD 分析');
      return;
    }
    if (resumeText.trim().length < 20) {
      setError('请粘贴完整的简历文本（至少 20 个字符）');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await analyzeGap({ jd_id: jd.jd_id, resume_text: resumeText });
      onGapResult(result);
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  };

  if (!jd) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="还没有能力矩阵"
        description="差距分析需要以 JD 能力矩阵为基准，请先回到上一步完成 JD 分析。"
        action={
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            返回 JD 分析
          </button>
        }
      />
    );
  }

  const abilityById = new Map(jd.abilities.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          eyebrow="Step 02 · Pipeline 步骤（非 Agent）"
          title="差距分析：JD 要求 vs 简历证据"
          description="按文档口径判定：完全未提及 → 缺口（<30）；证据不充分 → 部分覆盖（30-70）；证据充分 → 已覆盖（≥70）。"
          action={
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost h-8" onClick={onBack}>
                上一步
              </button>
              <button type="button" className="btn btn-secondary h-8" onClick={handleAnalyze} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                {gapResult ? '重新分析' : '生成差距分析'}
              </button>
            </div>
          }
        />
        {!gapResult && !loading && (
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="等待生成差距分析"
            description={
              resumeText.trim().length < 20
                ? '请先回到上一步粘贴简历文本，然后再生成差距分析。'
                : '简历已就绪，点击「生成差距分析」开始逐条比对。'
            }
            action={
              resumeText.trim().length >= 20 ? (
                <button type="button" className="btn btn-primary" onClick={handleAnalyze}>
                  生成差距分析
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={onBack}>
                  去粘贴简历
                </button>
              )
            }
          />
        )}
        {loading && <LoadingBlock label="正在逐条比对能力项与简历证据…" />}
        {error && <ErrorNote message={error} onRetry={handleAnalyze} />}
      </Panel>

      {gapResult && !loading && (
        <>
          <Panel>
            <PanelHeader eyebrow="整体判断" title="差距概览" description={gapResult.summary} />
            <div className="grid gap-3 sm:grid-cols-3">
              {(['gap', 'partial', 'covered'] as const).map((status) => {
                const count = gapResult.gaps.filter((g) => g.status === status).length;
                return (
                  <div key={status} className="rounded-md border border-border bg-[hsl(var(--surface-raised)/0.6)] p-3">
                    <GapStatusPill status={status} />
                    <p className="mt-2 font-mono text-2xl text-foreground">{count}</p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="grid gap-3">
            {gapResult.gaps.map((gap) => {
              const ability = abilityById.get(gap.ability_id);
              const highlight = gap.status === 'gap';
              return (
                <article
                  key={gap.ability_id}
                  className={`panel rise-in overflow-hidden ${
                    highlight ? 'border-[hsl(var(--destructive)/0.45)]' : ''
                  }`}
                >
                  <div className="grid gap-0 md:grid-cols-2">
                    <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{gap.ability_id}</span>
                        <GapStatusPill status={gap.status} />
                        {ability && <PriorityPill priority={ability.priority} />}
                      </div>
                      <h3 className="text-[15px] font-semibold text-foreground">
                        {gap.ability_name || ability?.name || '未命名能力项'}
                      </h3>
                      {ability?.jd_reference && (
                        <p className="mt-2 border-l-2 border-[hsl(var(--border-strong))] pl-2 font-mono text-[11px] leading-5 text-faint">
                          JD：{ability.jd_reference}
                        </p>
                      )}
                      {ability && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {ability.technologies.map((tech) => (
                            <span key={tech} className="tag">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="eyebrow">简历证据</p>
                      <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                        {gap.resume_evidence || '简历中未找到相关证据'}
                      </p>
                      <div className="mt-3">
                        <ScoreMeter score={gap.coverage_score} label="覆盖度" />
                      </div>
                      {gap.suggestion && (
                        <p className="mt-3 rounded-md border border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.08)] px-3 py-2 text-[12px] leading-5 text-foreground">
                          建议：{gap.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              上一步
            </button>
            <button type="button" className="btn btn-primary" onClick={onNext}>
              下一步：开始模拟面试
            </button>
          </div>
        </>
      )}
    </div>
  );
}
