import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, History, LayoutGrid, Loader2, LogOut, Menu, Terminal, X } from 'lucide-react';
import { AgentAvatar, Panel, PanelHeader } from '@/components/interview/ui';
import { client } from '@/lib/api';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';

const NAV_ITEMS = [
  { to: '/', label: '工作台', hint: '四步备战流程', icon: LayoutGrid, end: true },
  { to: '/knowledge', label: '知识点库', hint: '文档与个人标记', icon: BookOpen, end: false },
  { to: '/history', label: '历史记录', hint: '往次面试与报告', icon: History, end: false },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { state, history } = useWorkspace();
  const counts: Record<string, string> = {
    '/history': history.length ? String(history.length) : '',
    '/': state.session ? '进行中' : '',
  };

  return (
    <nav aria-label="主导航" className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors duration-150 ${
                isActive
                  ? 'border-[hsl(var(--brand)/0.5)] bg-[hsl(var(--brand)/0.1)]'
                  : 'border-transparent hover:bg-[hsl(var(--surface-raised))]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[hsl(var(--brand))]' : 'text-muted-foreground'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13px] font-medium ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {item.hint}
                  </span>
                </span>
                {counts[item.to] && (
                  <span className="tag shrink-0 px-2 py-0 text-[10px]">{counts[item.to]}</span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <NavLink
        to="/"
        end
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-[hsl(var(--surface-raised))]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.14)] font-display text-[13px] font-semibold text-[hsl(var(--brand))]">
          面
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[16px] font-semibold leading-tight text-foreground">
            面试助手
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            多智能体协作
          </span>
        </span>
      </NavLink>

      <SidebarNav onNavigate={onNavigate} />

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-start gap-2 font-mono text-[10px] leading-5 text-faint">
          <Terminal className="mt-0.5 h-3 w-3 shrink-0" />
          3 个 Agent：JD 分析师 · 模拟面试官 · 复盘师
        </p>
        <button
          type="button"
          className="btn btn-ghost h-8 w-full justify-start"
          onClick={() => client.auth.logout()}
        >
          <LogOut className="h-3.5 w-3.5" />
          退出登录
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { refreshHistory } = useWorkspace();

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-[hsl(var(--surface)/0.6)] lg:block">
        <SidebarBody />
      </aside>

      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <NavLink to="/" end className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[hsl(var(--brand)/0.4)] bg-[hsl(var(--brand)/0.14)] font-display text-[12px] font-semibold text-[hsl(var(--brand))]">
            面
          </span>
          <span className="font-display text-[15px] font-semibold text-foreground">面试助手</span>
        </NavLink>
        <button
          type="button"
          aria-label={mobileOpen ? '关闭导航' : '打开导航'}
          className="btn btn-secondary h-8 w-8 px-0"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-b border-border bg-[hsl(var(--surface)/0.8)] lg:hidden">
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="lg:pl-60">
        <Outlet />
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');

  useEffect(() => {
    client.auth
      .me()
      .then((res: { data?: unknown }) => setAuthState(res?.data ? 'authenticated' : 'anonymous'))
      .catch(() => setAuthState('anonymous'));
  }, []);

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
              <h1 className="font-display text-xl font-semibold text-foreground">面试助手</h1>
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
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
