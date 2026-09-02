import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { evalApi } from "../api/eval";
import type {
  EvalDryRunPayload,
  EvalScores,
  FaithfulnessClaim,
} from "../types";

const STORAGE_KEYS = {
  question: "eval.question",
  answer: "eval.answer",
  ragContext: "eval.rag_context",
} as const;

function loadDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // 存储不可用时静默忽略
  }
}

function clearDrafts() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // 存储不可用时静默忽略
  }
}

interface ScoreSpec {
  key: keyof EvalScores;
  label: string;
  desc: string;
}

const SCORE_SPECS: ScoreSpec[] = [
  { key: "faithfulness", label: "Faithfulness", desc: "答案忠于检索上下文" },
  { key: "answer_relevancy", label: "Answer Relevancy", desc: "答案与问题相关性" },
  { key: "profile_recall", label: "Profile Recall", desc: "检索池纯度（参考）" },
  { key: "profile_precision", label: "Profile Precision", desc: "检索池纯度（参考）" },
  { key: "citation_recall", label: "Citation Recall", desc: "引用召回率" },
  { key: "citation_precision", label: "Citation Precision", desc: "引用精确率" },
];

// rag_context 文本 → string[]：支持 JSON 数组 / 单个 JSON / 每行一项
function parseRagContext(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      );
    }
    if (parsed !== null && typeof parsed === "object") {
      return [JSON.stringify(parsed)];
    }
  } catch {
    // 不是合法 JSON，按每行一项解析
  }

  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatScore(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (value >= 0 && value <= 1) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(4);
}

function scorePercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value * 100));
}

function scoreBarClass(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "bg-base-300";
  if (value >= 0.8) return "bg-success";
  if (value >= 0.6) return "bg-warning";
  return "bg-error";
}

function claimResultClass(result: string): string {
  const r = (result ?? "").trim();
  if (r.includes("不支持")) return "badge-error";
  if (r.includes("支持")) return "badge-success";
  return "badge-warning";
}

function errorMessage(e: unknown): string {
  const err = e as { response?: { data?: unknown }; message?: string };
  if (err?.response?.data !== undefined) {
    try {
      return JSON.stringify(err.response.data);
    } catch {
      return String(err.response.data);
    }
  }
  return err?.message ?? String(e);
}

export function EvalPage() {
  const navigate = useNavigate();
  const { thread_id = "qa_default" } = useParams<{ thread_id: string }>();

  const [question, setQuestion] = useState(() => loadDraft(STORAGE_KEYS.question));
  const [answer, setAnswer] = useState(() => loadDraft(STORAGE_KEYS.answer));
  const [ragContextText, setRagContextText] = useState(() =>
    loadDraft(STORAGE_KEYS.ragContext),
  );
  const [pushLangsmith, setPushLangsmith] = useState(false);
  const [includeClaimDetails, setIncludeClaimDetails] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EvalScores | null>(null);
  const [claimDetails, setClaimDetails] = useState<unknown>(null);
  const [faithfulnessClaims, setFaithfulnessClaims] = useState<
    FaithfulnessClaim[] | null
  >(null);
  const [requestBody, setRequestBody] = useState<EvalDryRunPayload | null>(null);

  // 自动保存草稿，刷新 / 重开页面后无需重新输入
  useEffect(() => {
    saveDraft(STORAGE_KEYS.question, question);
    saveDraft(STORAGE_KEYS.answer, answer);
    saveDraft(STORAGE_KEYS.ragContext, ragContextText);
  }, [question, answer, ragContextText]);

  async function onSubmit() {
    if (loading) return;
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) {
      setError("请至少填写 question 和 answer");
      return;
    }

    const payload: EvalDryRunPayload = {
      question: q,
      answer: a,
      rag_context: parseRagContext(ragContextText),
      push_langsmith: pushLangsmith,
      include_claim_details: includeClaimDetails,
    };

    setLoading(true);
    setError("");
    setRequestBody(payload);
    setResult(null);
    setClaimDetails(null);
    setFaithfulnessClaims(null);

    try {
      const raw = (await evalApi.dryRun(payload)) ?? {};
      // 兼容直接返回 scores 字典 / { scores: {...} } 两种结构
      const scores = (raw?.scores ?? raw) as EvalScores;
      setResult(scores);
      setClaimDetails(
        raw?.claim_details ?? (raw as Record<string, unknown>).claim_details ?? null,
      );
      setFaithfulnessClaims(
        (raw?.faithfulness_claims ??
          raw?.scores?.faithfulness_claims ??
          null) as FaithfulnessClaim[] | null,
      );
    } catch (e) {
      console.error(e);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    clearDrafts();
    setQuestion("");
    setAnswer("");
    setRagContextText("");
    setError("");
    setResult(null);
    setClaimDetails(null);
    setFaithfulnessClaims(null);
    setRequestBody(null);
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Navbar ── */}
      <nav className="navbar bg-base-200 border-b border-base-300 px-4 shrink-0">
        <div className="flex-1 flex items-center gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate(`/chat/${thread_id}`)}
          >
            ←
          </button>
          <span className="font-mono font-bold">🧪 AI 评测</span>
          <span className="badge badge-outline badge-sm">{thread_id}</span>
        </div>
        <div className="flex-none">
          <button
            className="btn btn-xs btn-ghost opacity-50"
            onClick={reset}
          >
            清空
          </button>
        </div>
      </nav>

      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* ── 表单 ── */}
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Question <span className="text-error">*</span>
                  </span>
                  <span className="label-text-alt opacity-50">可短</span>
                </label>
                <input
                  type="text"
                  className="input input-sm input-bordered"
                  placeholder="例如：贵州茅台 2024 年营收表现如何？"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Answer <span className="text-error">*</span>
                  </span>
                  <span className="label-text-alt opacity-50">长文本</span>
                </label>
                <textarea
                  className="textarea textarea-bordered text-sm font-mono min-h-40"
                  placeholder="粘贴需要评测的模型回答..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">RAG Context</span>
                  <span className="label-text-alt opacity-50">
                    长文本 / JSON
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered text-sm font-mono min-h-40"
                  placeholder={
                    '支持两种写法：\n1. JSON 数组：["chunk1", {"page": 1, "content": "..."}, ...]\n2. 每行一个片段'
                  }
                  value={ragContextText}
                  onChange={(e) => setRagContextText(e.target.value)}
                />
                <label className="label">
                  <span className="label-text-alt opacity-50">
                    可以是结构化 JSON 对象数组，提交时会自动转为字符串数组
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="label cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={pushLangsmith}
                    onChange={(e) => setPushLangsmith(e.target.checked)}
                  />
                  <span className="label-text text-sm">push_langsmith</span>
                </label>
                <label className="label cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={includeClaimDetails}
                    onChange={(e) => setIncludeClaimDetails(e.target.checked)}
                  />
                  <span className="label-text text-sm">
                    include_claim_details
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={`btn btn-primary flex-1 ${loading ? "loading loading-spinner" : ""}`}
                  disabled={loading || !question.trim() || !answer.trim()}
                  onClick={onSubmit}
                >
                  {loading ? "评测中..." : "🚀 开始评测"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={loading}
                  onClick={reset}
                  title="清空 question / answer / rag_context"
                >
                  🗑 清空
                </button>
              </div>
              <p className="text-xs opacity-40">
                💾 question / answer / rag_context 会自动保存在本地
                (localStorage)，刷新页面后无需重新输入
              </p>
            </div>
          </div>

          {/* ── 结果 ── */}
          <div className="space-y-4">
            {loading && (
              <div className="card bg-base-200 border border-base-300">
                <div className="card-body items-center justify-center gap-3 py-16">
                  <span className="loading loading-ring loading-lg" />
                  <p className="text-sm opacity-60">正在评测...</p>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="alert alert-error">
                <span>⚠️ {error}</span>
              </div>
            )}

            {!loading && !error && !result && (
              <div className="card bg-base-200 border border-base-300 border-dashed">
                <div className="card-body items-center justify-center text-center gap-2 py-16">
                  <span className="text-4xl">🧪</span>
                  <p className="text-sm opacity-60">
                    填写左侧表单，调用 api/eval/dry-run 进行评测
                  </p>
                  <p className="text-xs opacity-40 font-mono">
                    POST /api/eval/dry-run
                  </p>
                </div>
              </div>
            )}

            {!loading && result && (
              <>
                <div className="card bg-base-200 border border-base-300">
                  <div className="card-body gap-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold">评分结果</h2>
                      <div className="flex flex-wrap gap-2 text-xs justify-end">
                        <span className="badge badge-ghost badge-sm">
                          🕐 {result.timestamp || "—"}
                        </span>
                        <span className="badge badge-ghost badge-sm max-w-full truncate">
                          Q: {result.question || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SCORE_SPECS.map((spec) => {
                        const value = result[spec.key];
                        return (
                          <div
                            key={spec.key}
                            className="rounded-xl bg-base-100 border border-base-300 p-3 space-y-2"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold font-mono truncate">
                                  {spec.label}
                                </p>
                                <p className="text-[11px] opacity-50 truncate">
                                  {spec.desc}
                                </p>
                              </div>
                              <span className="text-lg font-bold font-mono shrink-0">
                                {formatScore(value)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-base-300 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${scoreBarClass(value)}`}
                                style={{ width: `${scorePercent(value)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {faithfulnessClaims && faithfulnessClaims.length > 0 && (
                  <details className="card bg-base-200 border border-base-300 overflow-hidden" open>
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center gap-2">
                      📄 Faithfulness Claims
                      <span className="badge badge-sm badge-outline">
                        {faithfulnessClaims.length}
                      </span>
                    </summary>
                    <div className="px-4 pb-4 space-y-3">
                      {faithfulnessClaims.map((fc, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-base-100 border border-base-300 p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm flex-1">
                              <span className="font-mono opacity-40 mr-2">
                                {i + 1}
                              </span>
                              {fc.claim}
                            </p>
                            <span
                              className={`badge badge-sm shrink-0 ${claimResultClass(fc.result)}`}
                            >
                              {fc.result || "—"}
                            </span>
                          </div>
                          {fc.sentences && fc.sentences.length > 0 && (
                            <details className="ml-5">
                              <summary className="text-xs opacity-50 cursor-pointer">
                                依据句（{fc.sentences.length}）
                              </summary>
                              <ol className="list-decimal list-inside space-y-1 mt-2">
                                {fc.sentences.map((s, j) => (
                                  <li key={j} className="text-xs opacity-70">
                                    {s}
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {claimDetails != null && (
                  <details className="card bg-base-200 border border-base-300 overflow-hidden">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center gap-2">
                      📋 Claim Details
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-base-100 rounded-lg p-3 max-h-96 overflow-auto">
                        {JSON.stringify(claimDetails, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}

                {requestBody && (
                  <details className="card bg-base-200 border border-base-300 overflow-hidden">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold flex items-center gap-2">
                      📤 请求体
                    </summary>
                    <div className="px-4 pb-4">
                      <pre className="text-xs whitespace-pre-wrap bg-base-100 rounded-lg p-3 max-h-72 overflow-auto">
                        {JSON.stringify(requestBody, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
