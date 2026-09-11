import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { consumeRedirect } from "../auth/oauth";
import { useAuth } from "../auth/useAuth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { token, loading, error, login } = useAuth();
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-100">
        <span className="loading loading-spinner loading-lg" />
        <p className="text-sm opacity-60">正在完成 GitHub 登录…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-6">
      <div className="card w-full max-w-md bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          <h2 className="card-title text-error">登录失败</h2>
          <p className="text-sm opacity-70">
            {error ??
              "没有拿到登录凭证。回调地址里的 code 是一次性的、有有效期的，超时或重复使用都会失败，请重新登录。"}
          </p>
          <div className="card-actions justify-end">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => navigate("/", { replace: true })}
            >
              返回首页
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => login("/")}>
              重新登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
