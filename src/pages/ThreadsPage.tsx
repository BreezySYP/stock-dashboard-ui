import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { agentApi, normalizeThreads, threadTitle } from "../api/agent";
import { AppShell } from "../layout/AppShell";
import type { ChatThread } from "../types";

function fmtTime(value?: string | null): string {
  if (!value) return "";
  const d = dayjs(value);
  return d.isValid() ? d.format("MM-DD HH:mm") : "";
}

export function ThreadsPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.threads({ limit: 100 });
      setThreads(normalizeThreads(data));
    } catch (e) {
      const err = e as {
        response?: { data?: { detail?: unknown }; status?: number };
        message?: string;
      };
      const detail = err?.response?.data?.detail;
      setThreads([]);
      setError(
        typeof detail === "string"
          ? detail
          : err?.response?.status === 404
            ? "会话列表接口不存在（后端需要提供 GET /api/ai/threads）"
            : err?.message ?? "加载会话列表失败",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createThread = () => navigate(`/chat/${crypto.randomUUID()}`);

  return (
    <AppShell
      title="聊天"
      subtitle="选择一个会话继续，或新建一个"
      actions={
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={createThread}
        >
          ＋ 新建会话
        </button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {error && (
          <div className="alert alert-warning py-2 text-sm">
            <span>⚠ {error}</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={load}
            >
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
                onClick={createThread}
              >
                开始第一个问题
              </button>
            </div>
          )}

          {!loading &&
            threads.map((t) => (
              <button
                key={t.thread_id}
                type="button"
                onClick={() => navigate(`/chat/${t.thread_id}`)}
                className="flex w-full items-center gap-3 border-b border-base-200 px-4 py-3 text-left last:border-b-0 hover:bg-base-200"
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
                <span className="shrink-0 text-xs text-base-content/40">
                  {fmtTime(t.updated_at ?? t.created_at)}
                </span>
                <span className="shrink-0 text-base-content/30">›</span>
              </button>
            ))}
        </div>

        {!loading && threads.length > 0 && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={load}
            >
              ↺ 刷新
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
