import { useNavigate } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorNote, Panel, PanelHeader } from '@/components/interview/ui';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { deleteSession, getErrorDetail, getSession } from '@/lib/interview';
import type { GapResult, JdResult } from '@/lib/types';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, historyLoading, historyError, refreshHistory, setHistory, replace } =
    useWorkspace();

  const openSession = async (id: number) => {
    try {
      const { session } = await getSession(id);
      const jd: JdResult = {
        jd_id: session.jd_id,
        company: session.company,
        position: session.position,
        summary: '',
        abilities: session.abilities,
        knowledge_tags: [],
      };
      const gap: GapResult | null = session.gaps?.length
        ? { gap_id: session.gap_id ?? 0, jd_id: session.jd_id, gaps: session.gaps, summary: '' }
        : null;
      replace({
        stage: session.report ? 'report' : 'interview',
        jdText: '',
        resumeText: '',
        jd,
        gap,
        session,
      });
      toast.success('已载入历史面试记录');
      navigate('/');
    } catch (e) {
      toast.error(getErrorDetail(e));
    }
  };

  const removeSession = async (id: number) => {
    try {
      await deleteSession(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success('已删除记录');
    } catch (e) {
      toast.error(getErrorDetail(e));
    }
  };

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-8">
          <PanelHeader
            eyebrow="历史记录"
            title="我的模拟面试"
            description="重新打开可继续查看对话与复盘报告。"
            action={
              <button type="button" className="btn btn-ghost h-8" onClick={refreshHistory}>
                刷新
              </button>
            }
          />
          {historyError && (
            <div className="mb-3">
              <ErrorNote message={historyError} onRetry={refreshHistory} />
            </div>
          )}
          {historyLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取…
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="还没有面试记录"
              description="完成一次模拟面试后，记录会出现在这里。"
              action={
                <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
                  开始一场面试
                </button>
              }
            />
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {history.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => openSession(item.id)}
                  >
                    <p className="text-[14px] font-medium text-foreground">
                      {item.company || '未知公司'} · {item.position || '未知岗位'}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {item.round_count} 轮 · {item.status === 'finished' ? '已结束' : '进行中'}
                      {item.overall_score != null && ` · 总分 ${item.overall_score}`}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary h-8"
                      onClick={() => openSession(item.id)}
                    >
                      打开
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost h-8"
                      onClick={() => removeSession(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-4">
          <PanelHeader eyebrow="说明" title="数据隔离" />
          <ul className="space-y-2 text-[13px] leading-6 text-muted-foreground">
            <li>· JD、简历与面试记录按登录账号隔离，仅自己可见。</li>
            <li>· 知识点库为全局共享，个人标记（掌握度 / 收藏 / 笔记）私有。</li>
            <li>· 面试过程会持久化每轮的 tool_calls 与 decision，可随时回看。</li>
          </ul>
        </Panel>
      </div>
    </main>
  );
}
