import { Check, FileText, MessageSquare, Target, Radar } from 'lucide-react';

export type StageKey = 'jd' | 'gap' | 'interview' | 'report';

const STAGES: { key: StageKey; label: string; hint: string; icon: typeof FileText }[] = [
  { key: 'jd', label: 'JD 分析', hint: '能力矩阵', icon: FileText },
  { key: 'gap', label: '差距分析', hint: '简历对照', icon: Target },
  { key: 'interview', label: '模拟面试', hint: '追问与反馈', icon: MessageSquare },
  { key: 'report', label: '复盘报告', hint: '雷达与缺口', icon: Radar },
];

export function StepRail({
  current,
  reachable,
  onSelect,
}: {
  current: StageKey;
  reachable: Record<StageKey, boolean>;
  onSelect: (stage: StageKey) => void;
}) {
  const currentIndex = STAGES.findIndex((stage) => stage.key === current);

  return (
    <nav
      aria-label="面试备战流程"
      className="sticky top-0 z-20 border-b border-border bg-[hsl(var(--background)/0.88)] backdrop-blur-md"
    >
      <ol className="mx-auto flex max-w-[1280px] items-stretch gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const enabled = reachable[stage.key];
          const Icon = stage.icon;
          return (
            <li key={stage.key} className="flex min-w-fit flex-1 items-center">
              <button
                type="button"
                onClick={() => enabled && onSelect(stage.key)}
                disabled={!enabled}
                aria-current={active ? 'step' : undefined}
                className={`group flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors duration-150 ${
                  active
                    ? 'border-[hsl(var(--brand)/0.55)] bg-[hsl(var(--brand)/0.1)]'
                    : 'border-transparent hover:bg-[hsl(var(--surface-raised)/0.7)]'
                } ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] ${
                    done
                      ? 'border-[hsl(var(--brand)/0.5)] bg-[hsl(var(--brand)/0.16)] text-[hsl(var(--brand))]'
                      : active
                        ? 'border-[hsl(var(--brand)/0.6)] text-[hsl(var(--brand))]'
                        : 'border-border-strong text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`flex items-center gap-1.5 text-[13px] font-medium ${
                      active || done ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    {stage.label}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                    {stage.hint}
                  </span>
                </span>
              </button>
              {index < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-1 h-0.5 w-4 shrink-0 rounded-full ${
                    index < currentIndex ? 'bg-[hsl(var(--brand))]' : 'bg-[hsl(var(--border))]'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { STAGES };
