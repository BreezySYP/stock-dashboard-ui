import { ChatProgress } from "@/types";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { agentApi } from "../api/agent";
import ReactMarkdown from "react-markdown";

// npm install react-markdown

interface Message {
  role: "user" | "assistant";
  content: string;
  progress?: ChatProgress[];
  done?: boolean;
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

  // 自动滚到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex flex-col h-screen bg-base-100">
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
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
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
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-content rounded-br-sm"
                  : "bg-base-200 rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
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
