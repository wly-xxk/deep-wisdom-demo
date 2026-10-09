import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { Download, Loader2, Radar as RadarIcon, TriangleAlert } from 'lucide-react';
import {
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Panel,
  PanelHeader,
  ScoreMeter,
} from '@/components/interview/ui';
import { generateReport, getErrorDetail } from '@/lib/interview';
import type { InterviewSession } from '@/lib/types';

interface Props {
  session: InterviewSession | null;
  onSession: (session: InterviewSession) => void;
  onBack: () => void;
}

export function ReportStage({ session, onSession, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const res = await generateReport({ session_id: session.id });
      onSession(res.session);
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  };

  const report = session?.report ?? null;
  const answeredCount = (session?.dialogue ?? []).filter((m) => m.type === 'feedback').length;

  if (!session) {
    return (
      <EmptyState
        icon={<RadarIcon className="h-6 w-6" />}
        title="还没有面试记录"
        description="复盘报告基于完整面试对话生成，请先完成一场模拟面试。"
        action={
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            返回模拟面试
          </button>
        }
      />
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Panel>
          <PanelHeader
            eyebrow="Step 04 · Agent: 复盘师"
            title="生成复盘报告"
            description="复盘师会读取完整对话、能力矩阵与差距分析，输出总分、雷达图、逐题回顾与关键缺口。"
          />
          {answeredCount === 0 ? (
            <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--warn)/0.4)] bg-[hsl(var(--warn)/0.08)] px-3.5 py-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warn))]" />
              <p className="text-[13px] text-foreground">
                这场面试还没有已回答的题目，先去模拟面试里回答至少一道题再回来生成报告。
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                已完成 {answeredCount} 道题的作答与反馈，可以生成报告了。
              </p>
              <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadarIcon className="h-4 w-4" />}
                生成复盘报告
              </button>
            </div>
          )}
          {error && <div className="mt-3"><ErrorNote message={error} onRetry={handleGenerate} /></div>}
          {loading && <div className="mt-4"><LoadingBlock label="复盘师正在汇总对话、计算维度得分并生成报告…" /></div>}
        </Panel>
      </div>
    );
  }

  const radarData = report.radar?.length
    ? report.radar
    : Object.entries(report.dimension_scores ?? {}).map(([dimension, score]) => ({ dimension, score }));

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `interview-report-${session.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          eyebrow="Step 04 · 复盘报告"
          title={`${session.company || '目标公司'} · ${session.position || '目标岗位'}`}
          description={report.summary}
          action={
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary h-8" onClick={downloadJson}>
                <Download className="h-3.5 w-3.5" />
                导出报告
              </button>
              <button type="button" className="btn btn-ghost h-8" onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '重新生成'}
              </button>
            </div>
          }
        />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-[10px] border border-border bg-[hsl(var(--surface-raised)/0.5)] p-4">
              <p className="eyebrow">总体评分</p>
              <p className="mt-1 font-mono text-5xl font-semibold text-[hsl(var(--brand))]">
                {report.overall_score}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                覆盖度 × 表达质量 × 回答深度（0-100）
              </p>
            </div>
            {report.highlights?.length > 0 && (
              <div className="mt-3 rounded-md border border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.07)] p-3.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--brand))]">
                  表现亮点
                </p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-foreground/90">
                  {report.highlights.map((item, index) => (
                    <li key={index}>· {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="lg:col-span-8">
            <div className="h-[300px] w-full rounded-[10px] border border-border bg-[hsl(var(--surface-raised)/0.4)] p-2">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="hsl(var(--border-strong))" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 100]}
                      tick={{ fill: 'hsl(var(--text-faint))', fontSize: 10 }}
                      axisLine={false}
                    />
                    <Radar
                      name="维度得分"
                      dataKey="score"
                      stroke="hsl(var(--brand))"
                      fill="hsl(var(--brand))"
                      fillOpacity={0.28}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                  暂无维度数据
                </div>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="逐题回顾"
          title={`共 ${report.question_reviews.length} 题`}
          description="每题得分、好的方面、不足与改进建议。"
        />
        <div className="grid gap-3 md:grid-cols-2">
          {report.question_reviews.map((review, index) => (
            <article key={index} className="rise-in rounded-[10px] border border-border bg-[hsl(var(--surface-raised)/0.4)] p-4">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-foreground">
                  {index + 1}. {review.ability_name}
                </h3>
                <span className="font-mono text-lg text-foreground">{review.score}</span>
              </div>
              <ScoreMeter score={review.score} />
              <dl className="mt-3 space-y-2 text-[12.5px] leading-6">
                {review.good && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--brand))]">
                      好的方面
                    </dt>
                    <dd className="text-foreground/90">{review.good}</dd>
                  </div>
                )}
                {review.weak && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warn))]">
                      不足
                    </dt>
                    <dd className="text-foreground/90">{review.weak}</dd>
                  </div>
                )}
                {review.improvement && (
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--info))]">
                      改进建议
                    </dt>
                    <dd className="text-foreground/90">{review.improvement}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="关键缺口 Top 3"
          title="最需要补强的能力项"
          description="结合简历覆盖度与面试表现给出专项建议。"
        />
        <div className="grid gap-3 md:grid-cols-3">
          {report.top_gaps.map((gap, index) => (
            <article
              key={index}
              className="rounded-[10px] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] p-4"
            >
              <span className="font-mono text-[11px] text-[hsl(var(--destructive))]">Top {index + 1}</span>
              <h3 className="mt-1 text-[14px] font-semibold text-foreground">{gap.ability_name}</h3>
              <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{gap.reason}</p>
              {gap.advice && (
                <p className="mt-2.5 border-t border-[hsl(var(--border))] pt-2.5 text-[12.5px] leading-6 text-foreground/90">
                  建议：{gap.advice}
                </p>
              )}
            </article>
          ))}
        </div>
      </Panel>

      <div className="flex justify-between">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          返回模拟面试
        </button>
        <button type="button" className="btn btn-primary" onClick={downloadJson}>
          <Download className="h-4 w-4" />
          导出报告
        </button>
      </div>
    </div>
  );
}
