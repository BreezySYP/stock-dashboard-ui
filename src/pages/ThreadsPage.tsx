import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { agentApi, normalizeThreads, threadTitle } from "../api/agent";
import { AppShell } from "../layout/AppShell";
import type { ChatThread } from "../types";

const PAGE_SIZE = 50;

function fmtTime(value?: string | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format("MM-DD HH:mm") : "";
}

function errorText(e: unknown, fallback: string): string {
  const err = e as {
    response?: { data?: { detail?: unknown }; status?: number };
    message?: string;
  };
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (err?.response?.status === 404) {
    return "接口不存在（后端需要提供会话相关接口）";
  }
  return err?.message ?? fallback;
}

export function ThreadsPage() {
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.listThreads({ limit: PAGE_SIZE, offset: 0 });
      setThreads(normalizeThreads(data));
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e) {
      setThreads([]);
      setTotal(0);
      setError(errorText(e, "加载会话列表失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await agentApi.listThreads({
        limit: PAGE_SIZE,
        offset: threads.length,
      });
      setThreads((prev) => [...prev, ...normalizeThreads(data)]);
      if (typeof data.total === "number") setTotal(data.total);
    } catch (e) {
      setError(errorText(e, "加载更多失败"));
    } finally {
      setLoadingMore(false);
    }
  };

  // 新建会话：thread_id 由服务端生成
  const createThread = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await agentApi.createThread();
      const id = created?.thread_id;
      if (!id) throw new Error("新建会话没有返回 thread_id");
      navigate(`/chat/${id}`);
    } catch (e) {
      setError(errorText(e, "新建会话失败"));
      setCreating(false);
    }
  };

  const startRename = (t: ChatThread) => {
    setEditingId(t.thread_id);
    setEditTitle(threadTitle(t));
  };

  const saveRename = async (threadId: string) => {
    const title = editTitle.trim();
    if (!title) return;
    setBusyId(threadId);
    try {
      await agentApi.renameThread(threadId, title);
      setThreads((prev) =>
        prev.map((t) => (t.thread_id === threadId ? { ...t, title } : t)),
      );
      setEditingId(null);
    } catch (e) {
      setError(errorText(e, "重命名失败"));
    } finally {
      setBusyId(null);
    }
  };

  const removeThread = async (t: ChatThread) => {
    if (!window.confirm(`确认删除「${threadTitle(t)}」？对话记录会一起删除。`)) {
      return;
    }
    setBusyId(t.thread_id);
    setError(null);
    try {
      await agentApi.deleteThread(t.thread_id);
      setThreads((prev) => prev.filter((x) => x.thread_id !== t.thread_id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      setError(errorText(e, "删除失败"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell
      title="聊天"
      subtitle={total ? `共 ${total} 个会话` : "选择一个会话继续，或新建一个"}
      actions={
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={creating}
          onClick={createThread}
        >
          {creating ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              创建中…
            </>
          ) : (
            "＋ 新建会话"
          )}
        </button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {error && (
          <div className="alert alert-warning py-2 text-sm">
            <span>⚠ {error}</span>
            <button type="button" className="btn btn-xs btn-ghost" onClick={load}>
              重试
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          {loading && (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}

          {!loading && threads.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-base-content/40">
              <span className="text-4xl">💬</span>
              <p className="text-sm">还没有会话</p>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={creating}
                onClick={createThread}
              >
                开始第一个问题
              </button>
            </div>
          )}

          {!loading &&
            threads.map((t) => {
              const editing = editingId === t.thread_id;
              const busy = busyId === t.thread_id;
              return (
                <div
                  key={t.thread_id}
                  className="flex items-center gap-2 border-b border-base-200 px-4 py-3 last:border-b-0 hover:bg-base-200"
                >
                  {editing ? (
                    <>
                      <input
                        autoFocus
                        className="input input-sm input-bordered flex-1"
                        value={editTitle}
                        maxLength={200}
                        disabled={busy}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(t.thread_id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        disabled={busy || !editTitle.trim()}
                        onClick={() => saveRename(t.thread_id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        disabled={busy}
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => navigate(`/chat/${t.thread_id}`)}
                      >
                        <span className="text-lg">💬</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {threadTitle(t)}
                          </span>
                          <span className="block truncate font-mono text-xs text-base-content/40">
                            {t.thread_id}
                          </span>
                        </span>
                      </button>
                      <span className="shrink-0 text-xs text-base-content/40">
                        {fmtTime(t.updated_at ?? t.created_at)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        title="重命名"
                        disabled={busy}
                        onClick={() => startRename(t)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost text-error"
                        title="删除"
                        disabled={busy}
                        onClick={() => removeThread(t)}
                      >
                        {busy ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          "🗑"
                        )}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
        </div>

        {!loading && threads.length > 0 && (
          <div className="flex justify-center gap-2">
            <button type="button" className="btn btn-xs btn-ghost" onClick={load}>
              ↺ 刷新
            </button>
            {threads.length < total && (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? "加载中…" : `加载更多（还有 ${total - threads.length} 个）`}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
