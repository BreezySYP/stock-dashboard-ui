import { useNavigate } from "react-router-dom";
import { AppShell } from "../layout/AppShell";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <AppShell title="无访问权限">
      <div className="mx-auto mt-16 max-w-md">
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body items-center gap-4 text-center">
            <span className="text-4xl">🔒</span>
            <h2 className="text-base font-semibold">这个页面仅管理员可见</h2>
            <p className="text-sm text-base-content/60">
              你的账号没有访问该功能的权限，可以继续使用聊天、记忆和 API 密钥。
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/chat")}
            >
              返回聊天
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
