import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { etlApi } from "../api/etl";
import { useAuth } from "../auth/useAuth";
import { normalizeEtlRuns } from "../lib/etlRuns";
import { AuthMenu } from "../components/AuthMenu";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  adminOnly?: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "工作台",
    items: [
      { to: "/chat", label: "聊天", icon: "💬" },
      { to: "/memories", label: "我的记忆", icon: "🧠" },
      { to: "/settings/api-keys", label: "API 密钥", icon: "🔑" },
    ],
  },
  {
    title: "管理",
    adminOnly: true,
    items: [
      { to: "/stocks", label: "股票数据", icon: "📈" },
      { to: "/pipeline", label: "Pipeline", icon: "🧩" },
      { to: "/logs", label: "任务日志", icon: "🗂" },
    ],
  },
];

function Brand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-base-300 px-4">
      <span className="text-lg">📈</span>
      <span className="font-semibold tracking-tight">AI 投资助手</span>
    </div>
  );
}

function SidebarNav({
  onNavigate,
  runningCount,
}: {
  onNavigate?: () => void;
  runningCount: number;
}) {
  const { isAdmin } = useAuth();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto p-3">
      {NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group) => (
        <div key={group.title}>
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">
            {group.title}
          </p>
          <ul className="menu menu-sm w-full gap-1 p-0">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    isActive ? "active font-medium" : ""
                  }
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.to === "/pipeline" && runningCount > 0 && (
                    <span className="badge badge-warning badge-xs ml-auto">
                      {runningCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** 内容区是否占满高度且不整体滚动（聊天页用） */
  fill?: boolean;
  contentClassName?: string;
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  fill = false,
  contentClassName,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAdmin } = useAuth();
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      setRunningCount(0);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const data = await etlApi.runs({ status: "running" });
        if (cancelled) return;
        setRunningCount(
          normalizeEtlRuns(data).filter((run) => run.status === "running")
            .length,
        );
      } catch {
        if (!cancelled) setRunningCount(0);
      }
    };

    void load();
    const timer = setInterval(load, 5000);
    const handleChange = () => void load();
    window.addEventListener("etl:running-changed", handleChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("etl:running-changed", handleChange);
    };
  }, [isAdmin]);

  useEffect(() => {
    document.title = runningCount
      ? `(${runningCount}) AI 投资助手`
      : "AI 投资助手";
  }, [runningCount]);

  return (
    <div
      className={
        fill
          ? "flex h-screen flex-col overflow-hidden bg-base-200 lg:flex-row"
          : "flex min-h-screen flex-col bg-base-200 lg:flex-row"
      }
    >
      {/* 桌面侧边栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-base-300 bg-base-100 lg:flex">
        <Brand />
        <SidebarNav runningCount={runningCount} />
      </aside>

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-60 flex-col border-r border-base-300 bg-base-100">
            <Brand />
            <SidebarNav
              runningCount={runningCount}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          fill ? "overflow-hidden" : ""
        }`}
      >
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-base-300 bg-base-100 px-4">
          <button
            type="button"
            className="btn btn-sm btn-ghost lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-base-content/50">
                {subtitle}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <AuthMenu />
          </div>
        </header>

        <main
          className={
            fill
              ? "flex min-h-0 flex-1 flex-col"
              : `flex-1 ${contentClassName ?? "p-6"}`
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
