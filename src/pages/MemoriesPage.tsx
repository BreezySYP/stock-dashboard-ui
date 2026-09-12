import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import { memoryApi } from "../api/memory";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "../layout/AppShell";
import { apiErrorMessage } from "../lib/errors";
import type { MemoryItem } from "../types";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

const FETCH_LIMIT = 500;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type SortKey =
  | "created_at"
  | "updated_at"
  | "expires_at"
  | "memory_type"
  | "namespace"
  | "importance"
  | "confidence"
  | "status";
type SortDir = "asc" | "desc";

interface SortColumn {
  key: SortKey;
  label: string;
  align?: "left" | "right";
}

const SORTABLE_COLUMNS: SortColumn[] = [
  { key: "created_at", label: "创建时间" },
  { key: "updated_at", label: "更新时间" },
  { key: "memory_type", label: "类型" },
  { key: "namespace", label: "命名空间" },
  { key: "importance", label: "重要度", align: "right" },
  { key: "confidence", label: "置信度", align: "right" },
  { key: "status", label: "状态" },
];

const isDateKey = (k: SortKey) =>
  k === "created_at" || k === "updated_at" || k === "expires_at";
const isNumberKey = (k: SortKey) => k === "importance" || k === "confidence";

function timeAgo(value?: string | null): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.fromNow() : value;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // 空值排最后
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "zh");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "badge-success";
    case "archived":
    case "expired":
      return "badge-ghost";
    default:
      return "badge-outline";
  }
}

interface SortableThProps {
  col: SortColumn;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

function SortableTh({ col, sortKey, sortDir, onSort }: SortableThProps) {
  const active = sortKey === col.key;
  return (
    <th className={col.align === "right" ? "text-right" : ""}>
      <button
        type="button"
        className={`btn btn-xs btn-ghost px-1 ${col.align === "right" ? "justify-end" : ""} ${
          active ? "text-primary font-bold" : ""
        }`}
        onClick={() => onSort(col.key)}
        title={`按${col.label}排序`}
      >
        {col.label}
        {active && (sortDir === "asc" ? " ▲" : " ▼")}
      </button>
    </th>
  );
}

export function MemoriesPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // 自己的 user_id：优先 /me 的 user_id，兜底 id / login
  const ownUserId = useMemo(() => {
    const raw = user?.user_id ?? user?.id ?? user?.login;
    return raw != null ? String(raw) : "";
  }, [user]);

  const urlUser = searchParams.get("user") ?? "";
  const [userId, setUserId] = useState(urlUser || ownUserId);
  const [queryUserId, setQueryUserId] = useState(urlUser || ownUserId);
  const [records, setRecords] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchMemories = useCallback(async (uid: string) => {
    const trimmed = uid.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await memoryApi.list(trimmed, { limit: FETCH_LIMIT });
      setRecords(Array.isArray(data?.items) ? data.items : []);
      setPage(1);
    } catch (e) {
      setRecords([]);
      setError(apiErrorMessage(e, "加载记忆失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  const effectiveUserId = queryUserId || ownUserId;

  // 自动加载：默认自己，管理员可通过搜索切换成别人
  useEffect(() => {
    if (effectiveUserId) fetchMemories(effectiveUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const handleSearch = () => {
    const trimmed = userId.trim();
    if (!trimmed) return;
    setSearchParams({ user: trimmed }, { replace: true });
    setQueryUserId(trimmed);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(isDateKey(key) || isNumberKey(key) ? "desc" : "asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    const items = [...records];
    items.sort((a, b) => {
      const r = compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? r : -r;
    });
    return items;
  }, [records, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const pageNumbers = useMemo(() => {
    const size = 7;
    let start = Math.max(1, currentPage - Math.floor(size / 2));
    const end = Math.min(totalPages, start + size - 1);
    start = Math.max(1, end - size + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <AppShell
      title="我的记忆"
      subtitle={isAdmin ? "管理员可查询任意用户" : "这里只显示你自己的记忆"}
      actions={
        effectiveUserId ? (
          <span
            className="badge badge-ghost badge-sm max-w-[200px] truncate font-mono"
            title={effectiveUserId}
          >
            {effectiveUserId}
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* ── 查询工具栏 ── */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <input
                type="text"
                className="input input-sm input-bordered w-72 font-mono"
                placeholder="查询其他用户 ID / 名称..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleSearch}
                disabled={!userId.trim() || loading}
              >
                查询
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => fetchMemories(effectiveUserId)}
            disabled={!effectiveUserId || loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "↺ 刷新"
            )}
          </button>
          <span className="text-xs opacity-50">共 {sorted.length} 条</span>
          {sorted.length >= FETCH_LIMIT && (
            <span className="badge badge-warning badge-sm">
              已达单次上限 {FETCH_LIMIT}，可能未显示全部
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs opacity-50">每页</span>
            <select
              className="select select-sm select-bordered"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="alert alert-error shadow-sm">
            <span>⚠ 加载失败：{error}</span>
          </div>
        )}

        {/* ── 表格 ── */}
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm table-pin-rows w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="min-w-[240px]">内容</th>
                {SORTABLE_COLUMNS.map((col) => (
                  <SortableTh
                    key={col.key}
                    col={col}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                ))}
                <th>来源</th>
                <th>过期时间</th>
              </tr>
            </thead>
            <tbody>
              {loading && paged.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-12">
                    <span className="loading loading-spinner loading-md" />
                  </td>
                </tr>
              )}
              {!loading && !error && sorted.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-12 opacity-40">
                    {effectiveUserId
                      ? "该用户暂无记忆"
                      : "没能取到你的用户 ID，请重新登录"}
                  </td>
                </tr>
              )}
              {paged.map((m) => (
                <tr key={m.id} className="hover align-top">
                  <td className="max-w-md">
                    <div
                      className="whitespace-pre-wrap break-words text-xs leading-relaxed line-clamp-3"
                      title={m.content}
                    >
                      {m.content}
                    </div>
                    {m.content_truncated && (
                      <span className="badge badge-warning badge-xs mt-1">
                        内容已截断
                      </span>
                    )}
                  </td>
                  <td
                    className="whitespace-nowrap text-xs"
                    title={
                      m.created_at
                        ? dayjs(m.created_at).format("YYYY-MM-DD HH:mm:ss")
                        : ""
                    }
                  >
                    {timeAgo(m.created_at)}
                  </td>
                  <td className="whitespace-nowrap text-xs opacity-70">
                    {timeAgo(m.updated_at)}
                  </td>
                  <td>
                    <span className="badge badge-outline badge-sm font-mono">
                      {m.memory_type}
                    </span>
                  </td>
                  <td className="font-mono text-xs opacity-80">
                    {m.namespace}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {m.importance ?? "—"}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {m.confidence != null
                      ? `${Math.round(m.confidence * 100)}%`
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={`badge badge-sm ${statusBadgeClass(m.status)}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="text-xs opacity-60">{m.source}</td>
                  <td className="whitespace-nowrap text-xs opacity-50">
                    {timeAgo(m.expires_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 分页 ── */}
        {totalPages > 1 && (
          <div className="flex justify-center">
            <div className="join">
              <button
                type="button"
                className="join-item btn btn-sm"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                «
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`join-item btn btn-sm ${currentPage === p ? "btn-active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="join-item btn btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
