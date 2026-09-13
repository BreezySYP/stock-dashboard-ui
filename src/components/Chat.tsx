import { ChatProgress } from "@/types";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { agentApi, normalizeConversation } from "../api/agent";
import { useAuth } from "../auth/useAuth";
import { SseHttpError, streamSSE } from "../lib/sse";

const MAX_HISTORY = 30; // 最多展示的历史条数
const MAX_PREVIEW_LEN = 300; // 单条内容预览长度

interface Message {
  role: "user" | "assistant";
  content: string;
  progress?: ChatProgress[];
  done?: boolean;
  expanded?: boolean;
}

function toMessageContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

// 超长内容默认截断，展开后显示全文
function previewContent(content: string, expanded?: boolean): string {
  if (expanded || content.length <= MAX_PREVIEW_LEN) return content;
  return content.slice(0, MAX_PREVIEW_LEN) + "\n……";
}

// report 内容：优先提取 markdown_report 字段，没有就直接用 content 字符串
function extractReportContent(raw: unknown): string {
  if (raw !== null && typeof raw === "object") {
    const md = (raw as Record<string, unknown>).markdown_report;
    if (typeof md === "string" && md.trim()) return md;
    return toMessageContent(raw);
  }

  const str = typeof raw === "string" ? raw : toMessageContent(raw);
  // 匹配 "{'markdown_report': '...', ...}" 中的 markdown_report 值
  const m = str.match(/'markdown_report':\s*'((?:\\.|[^'])*)'/);
  if (m) {
    return m[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return str;
}

const NODE_ICON: Record<string, string> = {
  supervisor: "🧭",
  profile: "👤",
  fundamental: "📊",
  technical: "📈",
  news: "📰",
  synthesizer: "🧠",
  reflection: "🪞",
};

export function Chat({ threadId }: { threadId: string }) {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [progress, setProgress] = useState<ChatProgress[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastMsgCountRef = useRef(0);

  // 切换会话时重置并加载历史（只展示 user_question / report）
  useEffect(() => {
    setMessages([]);
    setProgress([]);
    setError(null);
    let cancelled = false;

    agentApi
      .conversation(threadId)
      .then((data) => {
        if (cancelled) return;
        const rawItems = normalizeConversation(data);
        if (rawItems.length === 0) return;

        const history: Message[] = rawItems
          .filter((m) => m && (m.type === "user_question" || m.type === "report"))
          .slice(-MAX_HISTORY)
          .map((m) => ({
            role:
              m.role === "agent" || m.role === "assistant"
                ? ("assistant" as const)
                : ("user" as const),
            content:
              m.type === "report"
                ? extractReportContent(m.content)
                : toMessageContent(m.content),
          }));

        // 如果第一条是 AI 回复（接口可能按时间倒序），翻转成正常顺序
        if (history.length > 1 && history[0].role === "assistant") {
          history.reverse();
        }
        setMessages(history);
      })
      .catch((e) => {
        // 新会话还没有历史，404 属正常
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status !== 404) console.error("加载历史对话失败", e);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // 离开页面时中断正在进行的流
  useEffect(() => () => abortRef.current?.abort(), []);

  // 自动滚到底部：仅在新消息追加 / 进度更新时滚动，避免展开全文时跳到底部
  useEffect(() => {
    if (messages.length !== lastMsgCountRef.current || progress.length > 0) {
      lastMsgCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, progress]);

  async function onSubmit() {
    const text = question.trim();
    if (!text || loading) return;

    const jobId = crypto.randomUUID(); // 每次提问一个新 job
    const controller = new AbortController();
    abortRef.current = controller;

    setQuestion("");
    setError(null);
    setProgress([]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    try {
      await Promise.all([
        agentApi.ask(threadId, jobId, text),
        streamSSE<ChatProgress>(
          `/api/ai/qa/stream/${jobId}`,
          (data) => {
            if (data.done) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.message, done: true },
              ]);
              setProgress([]);
              controller.abort();
              return;
            }
            setProgress((prev) => [...prev, data]);
          },
          { signal: controller.signal },
        ),
      ]);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      const status =
        e instanceof SseHttpError
          ? e.status
          : (e as { response?: { status?: number } })?.response?.status;
      if (name !== "AbortError") {
        if (status === 401) {
          logout(); // 登录失效 → RequireAuth 会跳登录页
          return;
        }
        console.error("发送失败", e);
        setError("发送失败，请稍后重试");
      }
    } finally {
      setLoading(false);
      setProgress([]);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  function toggleExpand(i: number) {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, expanded: !m.expanded } : m)),
    );
    setTimeout(() => {
      msgElsRef.current.get(i)?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  const latestAssistantIndex = messages.reduce(
    (latest, message, index) =>
      message.role === "assistant" ? index : latest,
    -1,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-base-100">
      {/* ── 会话工具条 ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-base-300 px-4 py-2">
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => navigate("/chat")}
        >
          ← 会话列表
        </button>
        <span
          className="badge badge-ghost badge-sm max-w-[220px] truncate font-mono text-base-content/50"
          title={threadId}
        >
          {threadId}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isAdmin && (
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => navigate(`/chat/${threadId}/eval`)}
            >
              🧪 评测
            </button>
          )}
          <button
            type="button"
            className="btn btn-xs btn-ghost text-base-content/40"
            onClick={() => setMessages([])}
          >
            清空对话
          </button>
        </div>
      </div>

      {/* ── 消息区 ── */}
      <div className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-base-content/35">
            <span className="text-5xl">📈</span>
            <p className="text-sm">问我任何 A 股投资问题</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLatestAssistant = i === latestAssistantIndex;
          const canCollapse =
            msg.content.length > MAX_PREVIEW_LEN && !isLatestAssistant;

          return (
            <div
              key={i}
              ref={(el) => {
                if (el) msgElsRef.current.set(i, el);
                else msgElsRef.current.delete(i);
              }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="avatar placeholder shrink-0">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-content">
                    <span className="text-xs">AI</span>
                  </div>
                </div>
              )}

              <div
                className={`min-w-0 max-w-[75%] break-words rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-content"
                    : "rounded-bl-sm bg-base-200"
                }`}
              >
                <div className="min-w-0">
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none overflow-x-auto">
                      <ReactMarkdown>
                        {previewContent(
                          msg.content,
                          msg.expanded || isLatestAssistant,
                        )}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {previewContent(
                        msg.content,
                        msg.expanded || isLatestAssistant,
                      )}
                    </p>
                  )}
                  {canCollapse && (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost mt-2"
                      onClick={() => toggleExpand(i)}
                    >
                      {msg.expanded ? "▲ 收起" : "▼ 展开全文"}
                    </button>
                  )}
                </div>
              </div>

              {msg.role === "user" && (
                <div className="avatar placeholder shrink-0">
                  <div className="h-8 w-8 rounded-full bg-base-300">
                    <span className="text-xs">你</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 实时进度 */}
        {loading && (
          <div className="flex justify-start gap-3">
            <div className="avatar placeholder shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-content">
                <span className="text-xs">AI</span>
              </div>
            </div>

            <div className="max-w-[75%] space-y-2 rounded-2xl rounded-bl-sm bg-base-200 px-4 py-3">
              {progress.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="loading loading-dots loading-xs" />
                  <span className="text-xs text-base-content/50">思考中...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {progress.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span>{NODE_ICON[p.node] ?? "⚙️"}</span>
                      <span className="font-mono text-base-content/60">
                        {p.node}
                      </span>
                      <span
                        className={`badge badge-xs ${
                          p.status === "done"
                            ? "badge-success"
                            : p.status === "running"
                              ? "badge-warning"
                              : p.status === "error"
                                ? "badge-error"
                                : "badge-ghost"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.message && (
                        <span className="max-w-xs truncate text-base-content/40">
                          {p.message}
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="loading loading-ring loading-xs" />
                    <span className="text-xs text-base-content/40">生成中...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error py-2 text-sm">
            <span>⚠ {error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 输入区 ── */}
      <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl bg-base-200 px-4 py-3">
            <textarea
              ref={textareaRef}
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-base-content/30"
              placeholder="输入问题，Ctrl+Enter 发送..."
              rows={1}
              value={question}
              disabled={loading}
              onChange={(e) => {
                setQuestion(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary rounded-xl px-4"
              disabled={!question.trim() || loading}
              onClick={onSubmit}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "发送"
              )}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-base-content/30">
            Ctrl + Enter 发送 · AI 回答仅供参考，不构成投资建议
          </p>
        </div>
      </div>
    </div>
  );
}
