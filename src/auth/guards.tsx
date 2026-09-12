import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function FullScreenLoader({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-200">
      <span className="loading loading-spinner loading-lg text-primary" />
      <p className="text-sm text-base-content/60">{text}</p>
    </div>
  );
}

/** 未登录 → 全屏登录页（记住原地址） */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader text="正在校验登录状态…" />;
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <>{children}</>;
}

/** 需要登录 + 管理员；普通用户访问管理页落到 403 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { token, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader text="正在校验权限…" />;
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  if (!isAdmin) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
