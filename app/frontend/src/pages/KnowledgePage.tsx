import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Panel,
  PanelHeader,
} from '@/components/interview/ui';
import { KnowledgeDocView } from '@/components/interview/KnowledgeDocView';
import { getErrorDetail, listKnowledgePoints, upsertKnowledgeMark } from '@/lib/interview';
import type { KnowledgePointView } from '@/lib/types';

const MASTERY = [
  { value: 'learning', label: '学习中' },
  { value: 'familiar', label: '较熟悉' },
  { value: 'mastered', label: '已掌握' },
];

export function KnowledgePage({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<KnowledgePointView[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<KnowledgePointView | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await listKnowledgePoints(search);
      setItems(data.items);
    } catch (e) {
      setError(getErrorDetail(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const openDetail = (point: KnowledgePointView) => {
    setActive(point);
    setNotes(point.mark?.personal_notes ?? '');
  };

  const saveMark = async (patch: Partial<{ mastery: string; favorited: boolean }>) => {
    if (!active) return;
    setSaving(true);
    try {
      const current = active.mark;
      const res = await upsertKnowledgeMark({
        tech_id: active.id,
        tech_name: active.name,
        mastery: patch.mastery ?? current?.mastery ?? 'learning',
        favorited: patch.favorited ?? current?.favorited ?? false,
        personal_notes: notes,
      });
      const updated = { ...active, mark: res.mark };
      setActive(updated);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('个人标记已保存');
    } catch (e) {
      toast.error(getErrorDetail(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Panel>
          <PanelHeader
            eyebrow="全局共享 · 系统维护"
            title="技术知识点库"
            description="JD 分析师与模拟面试官在运行时会查询这里；未命中的技术会被自动生成并写回。个人标记仅自己可见。"
            action={
              <button type="button" className="btn btn-ghost h-8" onClick={onBack}>
                返回工作台
              </button>
            }
          />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load(keyword);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                className="field pl-8"
                placeholder="按技术名搜索，如 Kubernetes / Redis"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
            </button>
          </form>
          {error && <div className="mt-3"><ErrorNote message={error} onRetry={() => load(keyword)} /></div>}
        </Panel>

        <div className="mt-4">
          {loading && <LoadingBlock label="正在读取全局知识点库…" />}
          {!loading && items.length === 0 && (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={keyword ? '没有匹配的知识点' : '知识点库还是空的'}
              description={
                keyword
                  ? '换个关键词试试，或者先回去做一次 JD 分析来自动生成知识点。'
                  : '完成一次 JD 分析后，识别到的通用技术会被自动写入这里。'
              }
              action={
                <button type="button" className="btn btn-primary" onClick={onBack}>
                  去做 JD 分析
                </button>
              }
            />
          )}
          {!loading && items.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((point) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => openDetail(point)}
                  className={`panel p-3.5 text-left transition-colors hover:border-[hsl(var(--border-strong))] ${
                    active?.id === point.id ? 'border-[hsl(var(--brand)/0.5)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12.5px] font-medium text-foreground">{point.name}</span>
                    {point.mark?.favorited && (
                      <Star className="h-3.5 w-3.5 fill-[hsl(var(--warn))] text-[hsl(var(--warn))]" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-faint">{point.category}</p>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                    {point.definition}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="tag">引用 {point.feedback_count ?? 0} 次</span>
                    {point.mark && <span className="tag tag-agent">{point.mark.mastery}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-5">
        {!active ? (
          <Panel className="lg:sticky lg:top-24">
            <PanelHeader eyebrow="详情与标记" title="选择一个知识点" />
            <p className="text-[13px] leading-6 text-muted-foreground">
              左侧选择技术点后，可以查看它的核心要点与常见考点，并记录你个人的掌握度、收藏与笔记。
            </p>
          </Panel>
        ) : (
          <Panel className="lg:sticky lg:top-24">
            <PanelHeader
              eyebrow={active.category}
              title={active.name}
              description={active.definition}
              action={
                <button
                  type="button"
                  aria-label="收藏该知识点"
                  className="btn btn-secondary h-8"
                  disabled={saving}
                  onClick={() => saveMark({ favorited: !(active.mark?.favorited ?? false) })}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      active.mark?.favorited ? 'fill-[hsl(var(--warn))] text-[hsl(var(--warn))]' : ''
                    }`}
                  />
                  {active.mark?.favorited ? '已收藏' : '收藏'}
                </button>
              }
            />
            <div className="space-y-4">
              <div>
                <p className="eyebrow mb-2">备战文档 · 是什么 / 解决什么问题 / 怎么用</p>
                <KnowledgeDocView
                  key={active.id}
                  techId={active.id}
                  techName={active.name}
                  doc={active.doc}
                  onDoc={(doc) => {
                    const updated = { ...active, doc };
                    setActive(updated);
                    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                  }}
                />
              </div>
              <div className="border-t border-border pt-4">
                <p className="eyebrow">核心要点</p>
                <ul className="mt-1.5 space-y-1.5 text-[13px] leading-6 text-foreground/90">
                  {active.key_points.length > 0 ? (
                    active.key_points.map((item, index) => <li key={index}>· {item}</li>)
                  ) : (
                    <li className="text-muted-foreground">暂无要点</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="eyebrow">常见考点</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {active.common_exam_points.length > 0 ? (
                    active.common_exam_points.map((item) => (
                      <span key={item} className="tag tag-agent">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-muted-foreground">暂无考点</span>
                  )}
                </div>
              </div>
              <div>
                <p className="eyebrow">关联技术</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {active.related_technologies.length > 0 ? (
                    active.related_technologies.map((item) => (
                      <span key={item} className="tag">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-muted-foreground">暂无关联</span>
                  )}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="eyebrow">我的掌握度</p>
                <div className="mt-2 flex gap-2">
                  {MASTERY.map((level) => {
                    const selected = (active.mark?.mastery ?? 'learning') === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        disabled={saving}
                        onClick={() => saveMark({ mastery: level.value })}
                        className={`btn h-8 ${
                          selected
                            ? 'bg-[hsl(var(--brand))] text-[hsl(var(--brand-ink))]'
                            : 'btn-secondary'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 block">
                  <span className="eyebrow">个人笔记（私有）</span>
                  <textarea
                    className="field mt-1.5 min-h-[92px] resize-y text-[13px] leading-6"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="记录你的踩坑点、理解偏差、复习要点…"
                  />
                </label>
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => saveMark({})}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    保存笔记
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
