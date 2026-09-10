import { ChatProgress, ConversationMessage, ConversationResponse } from "@/types";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { agentApi } from "../api/agent";
import ReactMarkdown from "react-markdown";

// npm install react-markdown

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

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [progress, setProgress] = useState<ChatProgress[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [thread_id] = useState("qa_default");
  const [job_id, setJob_id] = useState(crypto.randomUUID());
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastMsgCountRef = useRef(0);

  // 加载历史对话（只展示 user_question / report，内容超长时截断）
  useEffect(() => {
    let cancelled = false;
    agentApi
      .conversation(thread_id)
      .then((data) => {
        if (cancelled) return;
        const rawItems: unknown = Array.isArray(data)
          ? data
          : (data as ConversationResponse)?.items ??
            (data as ConversationResponse)?.messages ??
            (data as ConversationResponse)?.data ??
            [];
        if (!Array.isArray(rawItems)) return;

        const history: Message[] = (rawItems as ConversationMessage[])
          .filter((m) => m && (m.type === "user_question" || m.type === "report"))
          .slice(-MAX_HISTORY)
          .map((m) => ({
            role:
              m.role === "agent" || m.role === "assistant"
                ? "assistant"
                : "user",
            content:
              m.type === "report"
                ? extractReportContent(m.content)
                : toMessageContent(m.content),
          }));

        // 如果第一条是 AI 回复（接口可能按时间倒序），翻转成正常顺序
        if (history.length > 1 && history[0].role === "assistant") {
          history.reverse();
        }

        setMessages((prev) => (prev.length === 0 ? history : [...history, ...prev]));
      })
      .catch((e) => console.error("加载历史对话失败", e));
    return () => {
      cancelled = true;
    };
  }, [thread_id]);

  // 自动滚到底部：仅在新消息追加 / 进度更新时滚动，避免展开全文时跳到底部
  useEffect(() => {
    if (messages.length !== lastMsgCountRef.current || progress.length > 0) {
      lastMsgCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, progress]);

  async function sse(): Promise<void> {
    return new Promise((resolve) => {
      setProgress([]);

      const es = new EventSource(`/api/ai/qa/stream/${job_id}`);

      es.onmessage = (e) => {
        const data: ChatProgress = JSON.parse(e.data);
        if (!!data.done) {
          es.close();
          // 把最终 message 加入对话历史
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message, done: true },
          ]);
          setProgress([]);
          setLoading(false);
          resolve();
          return;
        }

        // 追加中间进度
        setProgress((prev) => [...prev, data]);
      };

      es.onerror = () => {
        es.close();
        setLoading(false);
        resolve();
      };
    });
  }

  async function onSubmit() {
    if (!question.trim() || loading) return;

    const userMsg = question.trim();
    setQuestion("");
    setLoading(true);

    // 立即显示用户消息
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    // 调 API 同时开 SSE
    try {
      await Promise.all([agentApi.ask(thread_id, job_id, userMsg), sse()]);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  function toggleExpand(i: number) {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, expanded: !m.expanded } : m)),
    );
    // 展开后保持当前消息气泡位置，不跳到底部
    setTimeout(() => {
      msgElsRef.current.get(i)?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  // 节点图标
  const nodeIcon: Record<string, string> = {
    supervisor: "🧭",
    profile: "👤",
    fundamental: "📊",
    technical: "📈",
    news: "📰",
    synthesizer: "🧠",
    reflection: "🪞",
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-base-100">
      {/* ── Navbar ── */}
      <nav className="navbar bg-base-200 border-b border-base-300 px-4 shrink-0">
        <div className="flex-1 flex items-center gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate("/")}
          >
            ←
          </button>
          <span className="font-mono font-bold">AI 投资顾问</span>
          <span className="badge badge-outline badge-sm">{thread_id}</span>
        </div>
        <div className="flex-none flex items-center gap-2">
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => navigate(`/chat/${thread_id}/eval`)}
          >
            🧪 评测
          </button>
          <button
            className="btn btn-xs btn-ghost opacity-50"
            onClick={() => setMessages([])}
          >
            清空对话
          </button>
        </div>
      </nav>

      {/* ── Messages ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6">
        {/* 空状态 */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
            <span className="text-5xl">📈</span>
            <p className="text-sm">问我任何 A 股投资问题</p>
          </div>
        )}

        {/* 对话历史 */}
        {messages.map((msg, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) msgElsRef.current.set(i, el);
              else msgElsRef.current.delete(i);
            }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* AI 头像 */}
            {msg.role === "assistant" && (
              <div className="avatar placeholder shrink-0">
                <div className="bg-primary text-primary-content rounded-full w-8 h-8">
                  <span className="text-xs">AI</span>
                </div>
              </div>
            )}

            {/* 消息气泡 */}
            <div
              className={`max-w-[75%] min-w-0 break-words rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-content rounded-br-sm"
                  : "bg-base-200 rounded-bl-sm"
              }`}
            >
              <div className="min-w-0">
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-invert overflow-x-auto">
                    <ReactMarkdown>
                      {previewContent(msg.content, msg.expanded)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {previewContent(msg.content, msg.expanded)}
                  </p>
                )}
                {msg.content.length > MAX_PREVIEW_LEN && (
                  <button
                    className="btn btn-xs btn-ghost mt-2"
                    onClick={() => toggleExpand(i)}
                  >
                    {msg.expanded ? "▲ 收起" : "▼ 展开全文"}
                  </button>
                )}
              </div>
            </div>

            {/* 用户头像 */}
            {msg.role === "user" && (
              <div className="avatar placeholder shrink-0">
                <div className="bg-base-300 rounded-full w-8 h-8">
                  <span className="text-xs">你</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 实时进度（loading 中显示） */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="avatar placeholder shrink-0">
              <div className="bg-primary text-primary-content rounded-full w-8 h-8">
                <span className="text-xs">AI</span>
              </div>
            </div>

            <div className="bg-base-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[75%] space-y-2">
              {progress.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="loading loading-dots loading-xs" />
                  <span className="text-xs opacity-50">思考中...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {progress.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span>{nodeIcon[p.node] ?? "⚙️"}</span>
                      <span className="opacity-60 font-mono">{p.node}</span>
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
                        <span className="opacity-40 truncate max-w-xs">
                          {p.message}
                        </span>
                      )}
                    </div>
                  ))}
                  {/* 最后一个节点的 loading */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="loading loading-ring loading-xs" />
                    <span className="text-xs opacity-40">生成中...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end bg-base-200 rounded-2xl px-4 py-3">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent resize-none outline-none text-sm placeholder-base-content/30 max-h-40 min-h-[24px]"
              placeholder="输入问题，Ctrl+Enter 发送..."
              rows={1}
              value={question}
              disabled={loading}
              onChange={(e) => {
                setQuestion(e.target.value);
                // 自动撑高
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={onKeyDown}
            />
            <button
              className={`btn btn-sm btn-primary rounded-xl px-4 ${
                loading ? "loading loading-spinner" : ""
              }`}
              disabled={!question.trim() || loading}
              onClick={onSubmit}
            >
              {loading ? "" : "发送"}
            </button>
          </div>
          <p className="text-xs opacity-30 text-center mt-2">
            Ctrl + Enter 发送 · AI 回答仅供参考，不构成投资建议
          </p>
        </div>
      </div>
    </div>
  );
}
