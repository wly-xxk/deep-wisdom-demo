import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, History, Loader2, LogOut, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { StepRail, type StageKey } from '@/components/interview/StepRail';
import { AgentAvatar, EmptyState, ErrorNote, Panel, PanelHeader } from '@/components/interview/ui';
import { client } from '@/lib/api';
import { deleteSession, getErrorDetail, listSessions } from '@/lib/interview';
import type { GapResult, InterviewSession, JdResult, SessionSummary } from '@/lib/types';
import { JdStage } from '@/pages/stages/JdStage';
import { GapStage } from '@/pages/stages/GapStage';
import { InterviewStage } from '@/pages/stages/InterviewStage';
import { ReportStage } from '@/pages/stages/ReportStage';
import { KnowledgePage } from '@/pages/KnowledgePage';

interface SavedState {
  stage: StageKey;
  jdText: string;
  resumeText: string;
  jd: JdResult | null;
  gap: GapResult | null;
  session: InterviewSession | null;
}

const STORAGE_KEY = 'interviewprep:state:v1';

const EMPTY_STATE: SavedState = {
  stage: 'jd',
  jdText: '',
  resumeText: '',
  jd: null,
  gap: null,
  session: null,
};

function loadSavedState(): SavedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

export default function Index() {
  const [state, setState] = useState<SavedState>(() => loadSavedState());
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    client.auth
      .me()
      .then((res: { data?: unknown }) => {
        setAuthState(res?.data ? 'authenticated' : 'anonymous');
      })
      .catch(() => setAuthState('anonymous'));
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await listSessions();
      setHistory(res.items);
    } catch (e) {
      setHistoryError(getErrorDetail(e));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === 'authenticated') refreshHistory();
  }, [authState, refreshHistory]);

  const reachable = useMemo(
    () => ({
      jd: true,
      gap: Boolean(state.jd),
      interview: Boolean(state.jd),
      report: Boolean(state.session),
    }),
    [state.jd, state.session],
  );

  const patch = (next: Partial<SavedState>) => setState((prev) => ({ ...prev, ...next }));

  const openHistorySession = async (id: number) => {
    try {
      const res = await client.apiCall.invoke({
        url: `/api/v1/interview/session/${id}`,
        method: 'GET',
        data: {},
      });
      const session = res.data.session as InterviewSession;
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
      setState({
        stage: session.report ? 'report' : 'interview',
        jdText: '',
        resumeText: '',
        jd,
        gap,
        session,
      });
      setShowHistory(false);
      toast.success('已载入历史面试记录');
    } catch (e) {
      toast.error(getErrorDetail(e));
    }
  };

  const removeHistorySession = async (id: number) => {
    try {
      await deleteSession(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success('已删除记录');
    } catch (e) {
      toast.error(getErrorDetail(e));
    }
  };

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在确认登录状态…
        </div>
      </div>
    );
  }

  if (authState === 'anonymous') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center gap-3">
            <AgentAvatar agent="analyst" />
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">InterviewPrep</h1>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                多智能体面试备战工作台
              </p>
            </div>
          </div>
          <Panel>
            <PanelHeader
              eyebrow="Start"
              title="登录后开始备战"
              description="JD、简历与面试记录按账号隔离，仅自己可见；知识点库为全局共享。"
            />
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => client.auth.toLogin()}
            >
              使用 Atoms 账号登录
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.14)] font-mono text-[11px] font-medium text-[hsl(var(--brand))]">
              IP
            </div>
            <div>
              <h1 className="font-display text-[17px] font-semibold leading-tight text-foreground">
                InterviewPrep
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                多智能体协作 · 面试备战
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn h-8 ${showKnowledge ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => {
                setShowKnowledge(true);
                setShowHistory(false);
              }}
            >
              <BookOpen className="h-3.5 w-3.5" />
              知识点库
            </button>
            <button
              type="button"
              className={`btn h-8 ${showHistory ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => {
                setShowHistory((prev) => !prev);
                setShowKnowledge(false);
              }}
            >
              <History className="h-3.5 w-3.5" />
              历史记录
            </button>
            <button
              type="button"
              aria-label="退出登录"
              className="btn btn-ghost h-8 w-8 px-0"
              onClick={() => client.auth.logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {!showHistory && !showKnowledge && (
        <StepRail
          current={state.stage}
          reachable={reachable}
          onSelect={(stage) => patch({ stage })}
        />
      )}

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {showKnowledge ? (
          <KnowledgePage onBack={() => setShowKnowledge(false)} />
        ) : showHistory ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <Panel className="lg:col-span-8">
              <PanelHeader
                eyebrow="历史记录"
                title="我的模拟面试"
                description="重新打开可继续查看对话与复盘报告。"
                action={
                  <button type="button" className="btn btn-ghost h-8" onClick={() => setShowHistory(false)}>
                    返回工作台
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
                    <button type="button" className="btn btn-primary" onClick={() => setShowHistory(false)}>
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
                        onClick={() => openHistorySession(item.id)}
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
                          onClick={() => openHistorySession(item.id)}
                        >
                          打开
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost h-8"
                          onClick={() => removeHistorySession(item.id)}
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
        ) : state.stage === 'jd' ? (
          <JdStage
            result={state.jd}
            jdText={state.jdText}
            resumeText={state.resumeText}
            onResult={(jd, jdText) => patch({ jd, jdText, gap: null, session: null })}
            onJdTextChange={(jdText) => patch({ jdText })}
            onResumeTextChange={(resumeText) => patch({ resumeText })}
            onNext={() => patch({ stage: 'gap' })}
          />
        ) : state.stage === 'gap' ? (
          <GapStage
            jd={state.jd}
            resumeText={state.resumeText}
            gapResult={state.gap}
            onGapResult={(gap) => patch({ gap, session: null })}
            onNext={() => patch({ stage: 'interview' })}
            onBack={() => patch({ stage: 'jd' })}
          />
        ) : state.stage === 'interview' ? (
          <InterviewStage
            jd={state.jd}
            gapResult={state.gap}
            session={state.session}
            onSession={(session) => patch({ session })}
            onFinished={() => {
              refreshHistory();
              patch({ stage: 'report' });
            }}
            onBack={() => patch({ stage: 'gap' })}
          />
        ) : (
          <ReportStage
            session={state.session}
            onSession={(session) => {
              patch({ session });
              refreshHistory();
            }}
            onBack={() => patch({ stage: 'interview' })}
          />
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-4 py-4 sm:px-6">
          <Terminal className="h-3.5 w-3.5 text-faint" />
          <p className="font-mono text-[11px] text-faint">
            3 个 Agent：JD 分析师 · 模拟面试官 · 复盘师 —— 有记忆、有工具、能自主决策
          </p>
        </div>
      </footer>
    </div>
  );
}
