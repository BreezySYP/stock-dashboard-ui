import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { authApi, extractSecret, normalizeTokens } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import { GithubIcon } from "../components/AuthMenu";
import type { AuthToken, CreateTokenResponse } from "../types";

const EXPIRY_OPTIONS = [
  { label: "30 天", value: 30 },
  { label: "90 天", value: 90 },
  { label: "180 天", value: 180 },
  { label: "365 天", value: 365 },
  { label: "永不过期", value: null as number | null },
];

function fmt(value?: string | null): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : value;
}

function expiryText(value?: string | null): string {
  if (!value) return "永不过期";
  const d = dayjs(value);
  if (!d.isValid()) return value;
  const days = d.diff(dayjs(), "day");
  if (days < 0) return `已过期（${d.format("YYYY-MM-DD")}）`;
  if (days === 0) return "今天到期";
  return `${days} 天后过期`;
}

const tokenName = (t: AuthToken) =>
  (t.name as string) || "(未命名)";

const tokenPrefix = (t: AuthToken) =>
  t.prefix ?? t.token_prefix ?? t.last4 ?? String(t.id ?? "").slice(0, 8);

const tokenIsAdmin = (t: AuthToken) =>
  Boolean(t.is_admin ?? t.admin);

const tokenIsRevoked = (t: AuthToken) => Boolean(t.revoked);

const tokenIdOf = (t: AuthToken): string | null =>
  t.id != null ? String(t.id) : null;

export function ApiKeysPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, login, logout } = useAuth();

  const [tokens, setTokens] = useState<AuthToken[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [expiresDays, setExpiresDays] = useState<number | null>(90);
  const [wantAdmin, setWantAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTokenResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const createdSecret = useMemo(() => extractSecret(created), [created]);

  const loadTokens = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await authApi.listTokens();
      setTokens(normalizeTokens(data));
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      setListError(typeof detail === "string" ? detail : "加载 API 密钥失败");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadTokens();
  }, [user, loadTokens]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    setCopied(false);
    try {
      const res = await authApi.createToken({
        name: name.trim(),
        expires_days: expiresDays,
        admin: isAdmin ? wantAdmin : false,
      });
      setCreated(res);
      setName("");
      setWantAdmin(false);
      await loadTokens();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      setCreateError(
        typeof detail === "string" ? detail : "生成失败，请稍后重试",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: AuthToken) => {
    const id = tokenIdOf(token);
    if (!id) return;
    if (!window.confirm(`确认撤销「${tokenName(token)}」？该密钥将立即失效。`)) {
      return;
    }
    setRevoking(id);
    try {
      await authApi.revokeToken(id);
      await loadTokens();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      window.alert(typeof detail === "string" ? detail : "撤销失败");
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopied(true);
    } catch {
      setCopied(false);
      window.prompt("复制失败，请手动复制：", createdSecret);
    }
  };

  const activeCount = tokens.filter((t) => !tokenIsRevoked(t)).length;

  return (
    <div className="min-h-screen bg-base-100">
      <nav className="navbar bg-base-200 border-b border-base-300 px-6">
        <div className="flex-1 gap-2">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate("/")}
          >
            ← 返回
          </button>
          <span className="text-lg font-bold font-mono">🔑 API 密钥</span>
        </div>
        <div className="flex-none">
          {user && (
            <button className="btn btn-sm btn-ghost" onClick={logout}>
              退出登录
            </button>
          )}
        </div>
      </nav>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {authLoading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : !user ? (
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body items-center text-center gap-4">
              <h2 className="card-title">需要先登录</h2>
              <p className="text-sm opacity-70 max-w-md">
                使用 GitHub 登录后才能生成和管理属于你自己的 API 密钥。
              </p>
              <button
                className="btn btn-primary"
                onClick={() => login("/settings/api-keys")}
              >
                <GithubIcon /> 使用 GitHub 登录
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── 生成新密钥 ── */}
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body gap-4">
                <h2 className="card-title text-base font-mono">
                  生成新的 API 密钥
                </h2>
                <p className="text-xs opacity-60 -mt-2">
                  明文只在生成时返回一次，请立即保存到安全的地方。
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">备注名</span>
                    </div>
                    <input
                      className="input input-bordered input-sm font-mono"
                      placeholder="例如：我的脚本"
                      value={name}
                      maxLength={255}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">有效期</span>
                    </div>
                    <select
                      className="select select-bordered select-sm font-mono"
                      value={expiresDays === null ? "never" : String(expiresDays)}
                      onChange={(e) =>
                        setExpiresDays(
                          e.target.value === "never"
                            ? null
                            : Number(e.target.value),
                        )
                      }
                    >
                      {EXPIRY_OPTIONS.map((opt) => (
                        <option
                          key={opt.label}
                          value={opt.value === null ? "never" : String(opt.value)}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {isAdmin && (
                  <label className="label cursor-pointer justify-start gap-3 py-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-warning"
                      checked={wantAdmin}
                      onChange={(e) => setWantAdmin(e.target.checked)}
                    />
                    <span className="label-text">
                      管理员权限{" "}
                      <span className="text-xs opacity-50">
                        （仅管理员可签发，普通用户会被自动降级）
                      </span>
                    </span>
                  </label>
                )}

                {createError && (
                  <div className="alert alert-error py-2 text-sm">
                    {createError}
                  </div>
                )}

                <div className="card-actions justify-end">
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={creating}
                    onClick={handleCreate}
                  >
                    {creating && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    生成密钥
                  </button>
                </div>
              </div>
            </div>

            {/* ── 明文（仅一次） ── */}
            {created && (
              <div className="card bg-warning/10 border border-warning">
                <div className="card-body gap-3">
                  <h2 className="card-title text-base text-warning font-mono">
                    ⚠️ 请立即复制，关闭后无法再次查看
                  </h2>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 overflow-x-auto rounded bg-base-300 px-3 py-2 text-xs font-mono break-all">
                      {createdSecret ??
                        `（响应里没有找到明文字段，原始返回：${JSON.stringify(created)}）`}
                    </code>
                    <button
                      className="btn btn-sm"
                      disabled={!createdSecret}
                      onClick={handleCopy}
                    >
                      {copied ? "✓ 已复制" : "复制"}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setCreated(null)}
                    >
                      我已保存
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 密钥列表 ── */}
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="card-title text-base font-mono">
                   我的密钥
                  </h2>
                  <span className="text-xs opacity-50">
                    {activeCount} 个有效 / 共 {tokens.length} 个
                  </span>
                  <button
                    className={`btn btn-sm btn-ghost ml-auto ${
                      listLoading ? "loading loading-spinner" : ""
                    }`}
                    onClick={loadTokens}
                    disabled={listLoading}
                  >
                    {listLoading ? "" : "↺ 刷新"}
                  </button>
                </div>

                {listError && (
                  <div className="alert alert-error py-2 text-sm">{listError}</div>
                )}

                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="bg-base-300">
                        <th>备注名</th>
                        <th className="font-mono">前缀</th>
                        <th>创建时间</th>
                        <th>有效期</th>
                        <th>最近使用</th>
                        <th className="text-center">权限</th>
                        <th className="text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listLoading && tokens.length === 0 && (
                        <tr>
                          <td colSpan={99} className="text-center py-10">
                            <span className="loading loading-spinner loading-md" />
                          </td>
                        </tr>
                      )}
                      {!listLoading && tokens.length === 0 && (
                        <tr>
                          <td
                            colSpan={99}
                            className="text-center py-10 opacity-40"
                          >
                            还没有 API 密钥，生成一个吧
                          </td>
                        </tr>
                      )}
                      {tokens.map((t) => {
                        const id = String(t.id ?? "");
                        const revoked = tokenIsRevoked(t);
                        return (
                          <tr
                            key={id || tokenPrefix(t)}
                            className={revoked ? "opacity-40" : ""}
                          >
                            <td className="font-mono">{tokenName(t)}</td>
                            <td className="font-mono text-xs opacity-70">
                              {tokenPrefix(t)}
                            </td>
                            <td className="text-xs">{fmt(t.created_at)}</td>
                            <td className="text-xs">{expiryText(t.expires_at)}</td>
                            <td className="text-xs">{fmt(t.last_used_at)}</td>
                            <td className="text-center">
                              {tokenIsAdmin(t) ? (
                                <span className="badge badge-warning badge-sm">
                                  管理员
                                </span>
                              ) : (
                                <span className="badge badge-ghost badge-sm">
                                  普通
                                </span>
                              )}
                              {revoked && (
                                <span className="badge badge-error badge-sm ml-1">
                                  已撤销
                                </span>
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                className="btn btn-xs btn-ghost text-error"
                                disabled={revoked || revoking === id}
                                onClick={() => handleRevoke(t)}
                              >
                                {revoking === id ? "撤销中…" : "撤销"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
