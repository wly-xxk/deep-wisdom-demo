import { useState } from 'react';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorNote, LoadingBlock } from '@/components/interview/ui';
import { generateKnowledgeDoc, getErrorDetail } from '@/lib/interview';
import type { KnowledgeDoc } from '@/lib/types';

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-[hsl(var(--surface-raised)/0.45)] p-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-foreground">
        <span className="font-mono text-[11px] text-[hsl(var(--brand))]">{index}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`font-mono text-[10px] uppercase tracking-wider ${tone}`}>{label}</p>
      <ul className="mt-1 space-y-1 text-[13px] leading-6 text-foreground/90">
        {items.map((item, i) => (
          <li key={i}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function KnowledgeDocView({
  techId,
  techName,
  doc,
  onDoc,
}: {
  techId: number;
  techName: string;
  doc?: KnowledgeDoc | null;
  onDoc: (doc: KnowledgeDoc) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (regenerate: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await generateKnowledgeDoc(techId, regenerate);
      onDoc(res.doc);
      toast.success(`${techName} 文档已生成`);
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  };

  if (!doc) {
    return (
      <div className="space-y-3">
        <div className="rounded-[10px] border border-dashed border-border-strong p-4 text-center">
          <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            按「是什么 → 解决什么问题 → 怎么用」生成这项技术的备战文档。
          </p>
          <button type="button" className="btn btn-primary mt-3" disabled={loading} onClick={() => run(false)}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            生成文档
          </button>
        </div>
        {loading && <LoadingBlock label={`正在为 ${techName} 撰写文档…`} />}
        {error && <ErrorNote message={error} onRetry={() => run(false)} />}
      </div>
    );
  }

  const how = doc.how_to_use;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="btn btn-ghost h-8" disabled={loading} onClick={() => run(true)}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          重新生成
        </button>
      </div>
      {error && <ErrorNote message={error} onRetry={() => run(true)} />}

      <Section index="01" title="是什么">
        <p className="text-[13px] leading-6 text-foreground/90">{doc.what_is}</p>
        {doc.core_concepts.length > 0 && (
          <ul className="mt-2.5 space-y-1 text-[12.5px] leading-6 text-muted-foreground">
            {doc.core_concepts.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section index="02" title="解决什么问题">
        <ul className="space-y-2">
          {doc.problems.map((p, i) => (
            <li key={i} className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-[13px] font-medium text-foreground">{p.problem}</p>
              {p.solution && <p className="mt-0.5 text-[12.5px] leading-6 text-muted-foreground">→ {p.solution}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section index="03" title="怎么用">
        <div className="space-y-3">
          {how.scenarios.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {how.scenarios.map((s) => (
                <span key={s} className="tag tag-agent">{s}</span>
              ))}
            </div>
          )}
          <ol className="space-y-2">
            {how.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border-strong font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{step.title}</p>
                  {step.detail && <p className="text-[12.5px] leading-6 text-muted-foreground">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
          {how.example && (
            <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-[12px] leading-5 text-foreground/90">
              {how.example}
            </pre>
          )}
          <BulletList label="最佳实践" items={how.best_practices} tone="text-[hsl(var(--brand))]" />
          <BulletList label="常见坑" items={how.pitfalls} tone="text-[hsl(var(--warn))]" />
        </div>
      </Section>

      {doc.interview_tips.length > 0 && (
        <Section index="+" title="面试怎么答">
          <BulletList label="回答要点" items={doc.interview_tips} tone="text-[hsl(var(--info))]" />
        </Section>
      )}
    </div>
  );
}
