import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consumeRedirect } from "../auth/oauth";
import { useAuth } from "../auth/useAuth";
import { GithubLoginButton } from "../components/GithubLoginButton";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { token, loading, error, phase } = useAuth();
  const [waited, setWaited] = useState(false);

  // 等 AuthProvider 用一次性 code 换到 token 并完成 /me
  useEffect(() => {
    if (loading) return;
    setWaited(true);
    if (token && !error) {
      const next = consumeRedirect("/");
      navigate(next, { replace: true });
    }
  }, [loading, token, error, navigate]);

  if (!waited || loading) {
    const stepText =
      phase === "exchanging"
        ? "正在用一次性 code 换取登录凭证…"
        : phase === "loading-user"
          ? "正在加载你的账号信息…"
          : "正在完成 GitHub 登录…";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base-200">
        <span className="loading loading-spinner loading-lg" />
        <p className="text-sm opacity-60">{stepText}</p>
        <p className="text-xs opacity-40">
          正在与 auth 服务通信，请勿关闭页面
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-md border border-base-300 bg-base-100">
        <div className="card-body gap-4">
          <h2 className="card-title text-error">登录失败</h2>
          <p className="text-sm opacity-70">
            {error ??
              "没有拿到登录凭证。回调地址里的 code 是一次性的、有有效期的，超时或重复使用都会失败，请重新登录。"}
          </p>
          <div className="card-actions justify-end">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => navigate("/", { replace: true })}
            >
              返回首页
            </button>
            <GithubLoginButton
              className="btn btn-sm btn-primary gap-2"
              next="/chat"
              label="重新登录"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
