import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { GithubLoginButton } from "./GithubLoginButton";

export function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** 顶栏登录状态：未登录显示 GitHub 登录，已登录显示头像 + 菜单 */
export function AuthMenu() {
  const navigate = useNavigate();
  const { user, loading, isAdmin, logout } = useAuth();

  if (loading) {
    return <span className="loading loading-spinner loading-xs" />;
  }

  if (!user) {
    return (
      <GithubLoginButton
        className="btn btn-sm btn-outline gap-2 mr-2"
        label="GitHub 登录"
      />
    );
  }

  const displayName =
    user.login ?? user.username ?? user.name ?? `用户 ${user.id ?? ""}`;

  return (
    <div className="dropdown dropdown-end mr-2">
      <button tabIndex={0} className="btn btn-sm btn-ghost gap-2 normal-case">
        {user.avatar_url ? (
          <div className="avatar">
            <div className="w-6 rounded-full">
              <img src={user.avatar_url} alt={displayName} />
            </div>
          </div>
        ) : (
          <span className="text-base">👤</span>
        )}
        <span className="font-mono">{displayName}</span>
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm z-50 mt-2 w-48 rounded-box bg-base-300 p-2 shadow"
      >
        <li className="menu-title flex-row items-center justify-between">
          <span className="truncate">{displayName}</span>
          {isAdmin && <span className="badge badge-warning badge-xs">管理员</span>}
        </li>
        <li>
          <button onClick={() => navigate("/settings/api-keys")}>
            🔑 API 密钥
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            ⏏ 退出登录
          </button>
        </li>
      </ul>
    </div>
  );
}
