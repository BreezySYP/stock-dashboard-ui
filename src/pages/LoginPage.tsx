import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FullScreenLoader } from "../auth/guards";
import { useAuth } from "../auth/useAuth";
import { GithubLoginButton } from "../components/GithubLoginButton";

export function LoginPage() {
  const { token, loading, loginPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from;
  const target = from && from !== "/login" ? from : "/chat";

  // 已登录时直接回目标页，不要停在登录页
  useEffect(() => {
    if (!loading && token) navigate(target, { replace: true });
  }, [loading, token, target, navigate]);

  if (loading) return <FullScreenLoader text="正在校验登录状态…" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body items-center gap-4 text-center">
          <span className="text-4xl">📈</span>
          <div>
            <h1 className="text-lg font-semibold">AI 投资助手</h1>
            <p className="mt-1 text-sm text-base-content/60">
              使用 GitHub 账号登录后即可使用
            </p>
          </div>
          <GithubLoginButton className="btn btn-primary w-full gap-2" next={target} />
          <p className="text-xs text-base-content/40">
            {loginPending
              ? "正在跳转到 GitHub 授权页… 若浏览器没反应，请检查是否拦截了跳转"
              : "登录即表示同意使用你的 GitHub 公开资料"}
          </p>
        </div>
      </div>
    </div>
  );
}
