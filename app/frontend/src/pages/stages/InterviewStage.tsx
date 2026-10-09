import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Send, Square } from 'lucide-react';
import { toast } from 'sonner';
import {
  AgentAvatar,
  DecisionTag,
  EmptyState,
  ErrorNote,
  GapStatusPill,
  LoadingBlock,
  Panel,
  PanelHeader,
  ScoreMeter,
  ToolCallList,
  PriorityPill,
} from '@/components/interview/ui';
import { getErrorDetail, startSession, submitAnswer } from '@/lib/interview';
import type { DialogueMessage, GapResult, InterviewSession, JdResult } from '@/lib/types';

interface Props {
  jd: JdResult | null;
  gapResult: GapResult | null;
  session: InterviewSession | null;
  onSession: (session: InterviewSession) => void;
  onFinished: () => void;
  onBack: () => void;
}

function Typewriter({ text }: { text: string }) {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    let index = 0;
    setShown('');
    const step = Math.max(1, Math.round(text.length / 140));
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [text]);

  return <>{shown}</>;
}

export function InterviewStage({ jd, gapResult, session, onSession, onFinished, onBack }: Props) {
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef<string>('');

  const dialogue = session?.dialogue ?? [];
  const finished = session?.status === 'finished';

  const abilityById = useMemo(
    () => new Map((session?.abilities ?? jd?.abilities ?? []).map((a) => [a.id, a])),
    [session, jd],
  );
  const gapById = useMemo(
    () => new Map((gapResult?.gaps ?? session?.gaps ?? []).map((g) => [g.ability_id, g])),
    [gapResult, session],
  );

  const lastQuestion = useMemo(
    () => [...dialogue].reverse().find((m) => m.type === 'question'),
    [dialogue],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dialogue.length, loading]);

  useEffect(() => {
    if (lastQuestion?.content && lastQuestion.content !== lastQuestionRef.current) {
      lastQuestionRef.current = lastQuestion.content;
    }
  }, [lastQuestion]);

  const handleStart = async () => {
    if (!jd) return;
    setStarting(true);
    setError('');
    try {
      const res = await startSession({ jd_id: jd.jd_id, gap_id: gapResult?.gap_id });
      onSession(res.session);
      toast.success('模拟面试已开始，面试官优先考察你的缺口项');
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setStarting(false);
    }
  };

  const handleSubmit = async (userEnded = false) => {
    if (!session) return;
    if (!userEnded && answer.trim().length === 0) {
      toast.error('请先写下你的回答');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await submitAnswer({
        session_id: session.id,
        answer: userEnded ? '' : answer,
        user_ended: userEnded,
      });
      onSession(res.session);
      setAnswer('');
      if (res.session.status === 'finished') {
        toast.success('面试已结束，正在准备复盘报告');
        onFinished();
      }
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  };

  if (!jd || !session) {
    return (
      <div className="grid gap-4">
        {error && <ErrorNote message={error} onRetry={handleStart} />}
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={jd ? '准备开始模拟面试' : '还没有能力矩阵'}
          description={
            jd
              ? `面试官将读取你的能力矩阵${gapResult ? '与差距分析' : ''}，优先考察缺口项，并根据你的回答动态追问。`
              : '模拟面试需要先完成 JD 分析（建议同时完成差距分析）。'
          }
          action={
            jd ? (
              <button type="button" className="btn btn-primary" onClick={handleStart} disabled={starting}>
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {starting ? '面试官准备中…' : '开始模拟面试'}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onBack}>
                返回 JD 分析
              </button>
            )
          }
        />
        {starting && <LoadingBlock label="模拟面试官正在读取能力矩阵与差距分析…" />}
      </div>
    );
  }

  const examined = session.abilities_examined ?? [];
  const remaining = session.abilities_remaining ?? [];
  const total = examined.length + remaining.length;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Panel className="lg:sticky lg:top-24">
          <PanelHeader
            eyebrow="Step 03 · Agent: 模拟面试官"
            title="考察进度"
            description={`已完成 ${examined.length}/${total} 个能力项 · 第 ${session.round_count} 轮`}
          />
          <div className="mb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-raised))]">
              <div
                className="h-full rounded-full bg-[hsl(var(--brand))] transition-all duration-300"
                style={{ width: `${total ? (examined.length / total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <ul className="space-y-2">
            {session.abilities.map((ability) => {
              const done = examined.includes(ability.id);
              const current = session.current_ability_id === ability.id;
              const gap = gapById.get(ability.id);
              return (
                <li
                  key={ability.id}
                  className={`rounded-md border px-3 py-2 ${
                    current
                      ? 'border-[hsl(var(--brand)/0.55)] bg-[hsl(var(--brand)/0.08)]'
                      : 'border-border bg-[hsl(var(--surface-raised)/0.5)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] text-foreground">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          done ? 'bg-[hsl(var(--brand))]' : current ? 'bg-[hsl(var(--warn))]' : 'bg-[hsl(var(--border-strong))]'
                        }`}
                      />
                      {ability.name}
                    </span>
                    <PriorityPill priority={ability.priority} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {gap && <GapStatusPill status={gap.status} />}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                      {done ? '已考察' : current ? '考察中' : '未考察'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="lg:col-span-8">
        <Panel className="flex h-[calc(100vh-190px)] min-h-[520px] flex-col p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <AgentAvatar
              agent="interviewer"
              label={finished ? '模拟面试官 · 已结束' : '模拟面试官 · 进行中'}
              busy={loading}
            />
            <div className="flex items-center gap-2">
              <span className="tag">{session.round_count} 轮</span>
              {!finished && (
                <button
                  type="button"
                  className="btn btn-secondary h-8"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  <Square className="h-3.5 w-3.5" />
                  结束面试
                </button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {dialogue.map((message, index) => (
              <DialogueBubble
                key={index}
                message={message}
                abilityName={
                  message.ability_id ? abilityById.get(message.ability_id)?.name ?? '' : ''
                }
                typewriter={message.type === 'question' && message.content === lastQuestion?.content}
              />
            ))}
            {loading && <LoadingBlock label="面试官正在评估你的回答并决定追问问法…" />}
          </div>

          <div className="border-t border-border px-5 py-3.5">
            {error && (
              <div className="mb-2.5">
                <ErrorNote message={error} onRetry={() => handleSubmit(false)} />
              </div>
            )}
            {finished ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">
                  面试已结束，可以生成复盘报告了。
                </p>
                <button type="button" className="btn btn-primary" onClick={onFinished}>
                  查看复盘报告
                </button>
              </div>
            ) : (
              <>
                <textarea
                  className="field min-h-[92px] resize-none text-[13px] leading-6"
                  placeholder="写下你的回答…（答得好会追深一层，答不好会给出改进框架并换题）"
                  value={answer}
                  disabled={loading}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(false);
                  }}
                />
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-faint">Ctrl / ⌘ + Enter 提交</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    提交回答
                  </button>
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function DialogueBubble({
  message,
  abilityName,
  typewriter,
}: {
  message: DialogueMessage;
  abilityName: string;
  typewriter: boolean;
}) {
  if (message.type === 'answer' || message.role === 'user') {
    return (
      <div className="rise-in flex justify-end">
        <div className="max-w-[85%] rounded-[10px] border border-border bg-[hsl(var(--surface-raised))] px-3.5 py-2.5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">你的回答</p>
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'system') {
    return (
      <div className="rise-in flex justify-center">
        <p className="rounded-full border border-border-strong bg-[hsl(var(--surface-raised))] px-3.5 py-1.5 text-[12px] text-muted-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  if (message.type === 'feedback') {
    return (
      <div className="rise-in flex gap-3">
        <AgentAvatar agent="interviewer" size="sm" />
        <div className="min-w-0 max-w-[88%]">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              三段式反馈 {abilityName && `· ${abilityName}`}
            </span>
            <DecisionTag decision={message.decision} />
          </div>
          <div className="space-y-2 rounded-[10px] border border-border bg-card p-3.5">
            {message.feedback?.good && (
              <FeedbackRow tone="brand" label="好的地方" text={message.feedback.good} />
            )}
            {message.feedback?.weak && (
              <FeedbackRow tone="warn" label="不足" text={message.feedback.weak} />
            )}
            {message.feedback?.improvement && (
              <FeedbackRow tone="info" label="改进版骨架" text={message.feedback.improvement} />
            )}
            {typeof message.score === 'number' && (
              <div className="pt-1">
                <ScoreMeter score={message.score} label="本题得分" />
              </div>
            )}
          </div>
          <ToolCallList calls={message.tool_calls} />
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in flex gap-3">
      <AgentAvatar agent="interviewer" size="sm" />
      <div className="min-w-0 max-w-[88%]">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
            面试官提问 {abilityName && `· ${abilityName}`}
          </span>
          <DecisionTag decision={message.decision} />
        </div>
        <div className="rounded-[10px] border border-border bg-[hsl(var(--surface-raised))] px-3.5 py-3">
          <p className="whitespace-pre-wrap text-[14px] leading-6 text-foreground">
            {typewriter && message.content ? <Typewriter text={message.content} /> : message.content}
          </p>
          {message.focus && (
            <p className="mt-2 font-mono text-[11px] text-faint">考察焦点：{message.focus}</p>
          )}
        </div>
        <ToolCallList calls={message.tool_calls} />
      </div>
    </div>
  );
}

function FeedbackRow({ tone, label, text }: { tone: string; label: string; text: string }) {
  const toneClass: Record<string, string> = {
    brand: 'border-[hsl(var(--brand)/0.35)] bg-[hsl(var(--brand)/0.07)] text-[hsl(var(--brand))]',
    warn: 'border-[hsl(var(--warn)/0.35)] bg-[hsl(var(--warn)/0.07)] text-[hsl(var(--warn))]',
    info: 'border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.07)] text-[hsl(var(--info))]',
  };
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass[tone] ?? toneClass.info}`}>
      <p className="font-mono text-[10px] uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-[13px] leading-6 text-foreground/90">{text}</p>
    </div>
  );
}
