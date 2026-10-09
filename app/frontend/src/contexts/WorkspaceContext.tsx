import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { StageKey } from '@/components/interview/StepRail';
import { getErrorDetail, listSessions } from '@/lib/interview';
import type { GapResult, InterviewSession, JdResult, SessionSummary } from '@/lib/types';

export interface WorkspaceState {
  stage: StageKey;
  jdText: string;
  resumeText: string;
  jd: JdResult | null;
  gap: GapResult | null;
  session: InterviewSession | null;
}

const STORAGE_KEY = 'interviewprep:state:v1';

const EMPTY_STATE: WorkspaceState = {
  stage: 'jd',
  jdText: '',
  resumeText: '',
  jd: null,
  gap: null,
  session: null,
};

function loadSavedState(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<WorkspaceState>) };
  } catch {
    return EMPTY_STATE;
  }
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  patch: (next: Partial<WorkspaceState>) => void;
  replace: (next: WorkspaceState) => void;
  reachable: Record<StageKey, boolean>;
  history: SessionSummary[];
  historyLoading: boolean;
  historyError: string;
  refreshHistory: () => Promise<void>;
  setHistory: (updater: (prev: SessionSummary[]) => SessionSummary[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => loadSavedState());
  const [history, setHistoryState] = useState<SessionSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await listSessions();
      setHistoryState(res.items);
    } catch (e) {
      setHistoryError(getErrorDetail(e));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      patch: (next) => setState((prev) => ({ ...prev, ...next })),
      replace: (next) => setState(next),
      reachable: {
        jd: true,
        gap: Boolean(state.jd),
        interview: Boolean(state.jd),
        report: Boolean(state.session),
      },
      history,
      historyLoading,
      historyError,
      refreshHistory,
      setHistory: (updater) => setHistoryState((prev) => updater(prev)),
    }),
    [state, history, historyLoading, historyError, refreshHistory],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
