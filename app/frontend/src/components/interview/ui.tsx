import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ToolCall } from '@/lib/types';

/** Letter-based agent identity block — no external image assets. */
export function AgentAvatar({
  agent,
  label,
  size = 'md',
  busy = false,
}: {
  agent: 'analyst' | 'interviewer' | 'reviewer' | 'user';
  label?: string;
  size?: 'sm' | 'md';
  busy?: boolean;
}) {
  const tone: Record<string, string> = {
    analyst: 'bg-[hsl(var(--agent)/0.16)] text-[hsl(var(--agent))] border-[hsl(var(--agent)/0.4)]',
    interviewer: 'bg-[hsl(var(--brand)/0.16)] text-[hsl(var(--brand))] border-[hsl(var(--brand)/0.4)]',
    reviewer: 'bg-[hsl(var(--info)/0.16)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.4)]',
    user: 'bg-[hsl(var(--surface-raised))] text-muted-foreground border-border-strong',
  };
  const letters: Record<string, string> = {
    analyst: 'JD',
    interviewer: 'AI',
    reviewer: 'RV',
    user: 'YOU',
  };
  const box = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-[11px]';

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`relative flex ${box} shrink-0 items-center justify-center rounded-md border font-mono font-medium ${tone[agent]}`}
        aria-hidden="true"
      >
        {letters[agent]}
        {busy && (
          <span className="agent-pulse absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[hsl(var(--brand))]" />
        )}
      </div>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
    </div>
  );
}

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={`panel panel-pad ${className}`}>{children}</Tag>;
}

export function PanelHeader({
  title,
  eyebrow,
  action,
  description,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

const priorityTone: Record<string, string> = {
  P0: 'border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.14)] text-[hsl(var(--destructive))]',
  P1: 'border-[hsl(var(--warn)/0.5)] bg-[hsl(var(--warn)/0.14)] text-[hsl(var(--warn))]',
  P2: 'border-border-strong bg-[hsl(var(--surface-raised))] text-muted-foreground',
};

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <span className={`tag ${priorityTone[priority] ?? priorityTone.P2}`}>
      {priority}
      <span className="text-[10px] opacity-70">
        {priority === 'P0' ? '必问' : priority === 'P1' ? '高概率' : '加分'}
      </span>
    </span>
  );
}

const gapTone: Record<string, string> = {
  gap: 'border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.14)] text-[hsl(var(--destructive))]',
  partial: 'border-[hsl(var(--warn)/0.5)] bg-[hsl(var(--warn)/0.14)] text-[hsl(var(--warn))]',
  covered: 'border-[hsl(var(--brand)/0.5)] bg-[hsl(var(--brand)/0.14)] text-[hsl(var(--brand))]',
};

const gapLabel: Record<string, string> = {
  gap: '缺口',
  partial: '部分覆盖',
  covered: '已覆盖',
};

export function GapStatusPill({ status }: { status: string }) {
  return (
    <span className={`tag ${gapTone[status] ?? gapTone.partial}`}>{gapLabel[status] ?? status}</span>
  );
}

const decisionTone: Record<string, string> = {
  follow_up: 'border-[hsl(var(--info)/0.5)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]',
  switch_topic: 'border-[hsl(var(--warn)/0.5)] bg-[hsl(var(--warn)/0.12)] text-[hsl(var(--warn))]',
  end: 'border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]',
};

export function DecisionTag({ decision }: { decision?: string }) {
  if (!decision) return null;
  return (
    <span className={`tag ${decisionTone[decision] ?? decisionTone.switch_topic}`}>
      decision: {decision}
    </span>
  );
}

export function ToolCallList({ calls, compact = false }: { calls?: ToolCall[]; compact?: boolean }) {
  if (!calls?.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-2'}`}>
      {calls.map((call, index) => (
        <li
          key={`${call.name}-${index}`}
          className="tag tag-agent"
          title={
            call.result
              ? `参数 ${JSON.stringify(call.args ?? {})}\n结果 ${call.result}`
              : `参数 ${JSON.stringify(call.args ?? {})}`
          }
        >
          <span className="text-[10px] opacity-70">tool</span>
          {call.name}
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border-strong bg-[hsl(var(--surface)/0.5)] px-6 py-12 text-center">
      <div className="mb-3 text-muted-foreground">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-5">
      <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--brand))]" />
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <div className="mt-2 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="agent-pulse h-1.5 w-8 rounded-full bg-[hsl(var(--brand)/0.5)]"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[hsl(var(--destructive)/0.45)] bg-[hsl(var(--destructive)/0.08)] px-3.5 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
        <p className="text-[13px] text-foreground">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary h-8" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}

export function ScoreMeter({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 70
      ? 'bg-[hsl(var(--brand))]'
      : score >= 40
        ? 'bg-[hsl(var(--warn))]'
        : 'bg-[hsl(var(--destructive))]';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        {label && <span className="eyebrow">{label}</span>}
        <span className="font-mono text-sm text-foreground">{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-raised))]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}
