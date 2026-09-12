// ── Stock ────────────────────────────────────────────────

export interface StockLinks {
  eastmoney: string;
  xueqiu: string;
  tonghuashun: string;
}

export interface StepStatus {
  step: string;
  status: "pending" | "running" | "success" | "failed" | null;
  last_success: string | null;
  row_count: number;
  error_msg: string | null;
}

export interface StockSummary {
  code: string;
  name: string;
  latest_close: number | null;
  latest_date: string | null;
  step_status: Record<string, StepStatus>;
  links: StockLinks;
}

export interface StockListResponse {
  total: number;
  page: number;
  page_size: number;
  items: StockSummary[];
}

// ── Detail ───────────────────────────────────────────────

export interface OHLCRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  price_change: number | null;
}

export interface NewsRow {
  id: number;
  title: string;
  content: string | null;
  source: string | null;
  url: string | null;
  date: string | null;
}

export interface FinancialRow {
  report_date: string | null;
  revenue: number | null;
  net_profit: number | null;
  eps: number | null;
  roe: number | null;
  report_type: string | null;
}

export interface ProfileRow {
  code: string;
  name: string | null;
  industry: string | null;
  main_business: string | null;
  employees: number | null;
  listing_date: string | null;
}

export interface StockDetail {
  code: string;
  name: string;
  profile: ProfileRow | null;
  ohlc: OHLCRow[];
  news: NewsRow[];
  financial: FinancialRow[];
  links: StockLinks;
}

// ── ETL ──────────────────────────────────────────────────

export interface JobLog {
  id: number;
  code: string;
  step: string;
  status: "pending" | "running" | "success" | "failed";
  triggered_by: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  row_count: number;
  error_msg: string | null;
}

export interface TriggerResponse {
  job_ids: string[];
  message: string;
}

export interface StepMeta {
  step: string;
  label: string;
  group: "daily" | "season";
  per_stock: boolean;
}

export interface SSEEvent {
  job_id: number;
  code: string;
  step: string;
  status: "running" | "success" | "failed";
  message: string;
  progress: number | null;
  done?: boolean;
  error?: string;
}

// ── Status ───────────────────────────────────────────────

export interface CheckpointInfo {
  step: string;
  start_date: string | null;
  start_code: string | null;
  last_completed_date: string | null;
  last_completed_at: string | null;
}

export interface SummaryStep {
  step: string;
  label: string;
  group: string;
  checkpoint: CheckpointInfo | null;
  last_job: JobLog | null;
}

export interface Summary {
  steps: Record<string, SummaryStep>;
  running_count: number;
}

export interface ChatProgress {
  type: string;
  status: string;
  node: string;
  message: string;
  done?: boolean;
}

export interface ChatStartResponse {
  thread_id: string;
  message: string;
}

// ── Conversation History ────────────────────────────────

export interface ConversationMessage {
  role: string;
  type?: string;
  content: unknown;
  created_at?: string | null;
  timestamp?: string | null;
}

// 兼容数组或 { items / messages / data } 包装结构
export interface ConversationResponse {
  items?: ConversationMessage[];
  messages?: ConversationMessage[];
  data?: ConversationMessage[];
  [key: string]: unknown;
}

// ── Chat threads ────────────────────────────────────────

export interface ChatThread {
  thread_id: string;
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count?: number | null;
  [key: string]: unknown;
}

// 兼容数组与 { items / threads / data } 包装
export interface ChatThreadListResponse {
  items?: ChatThread[];
  threads?: ChatThread[];
  data?: ChatThread[];
  total?: number;
  [key: string]: unknown;
}

// ── Memory ───────────────────────────────────────────────

export interface MemoryItem {
  id: string;
  user_id: string;
  namespace: string;
  memory_type: string;
  content: string;
  content_truncated?: boolean;
  importance: number | null;
  confidence: number | null;
  status: string;
  source: string;
  created_at: string | null;
  updated_at: string | null;
  expires_at: string | null;
}

export interface MemoryListResponse {
  total: number;
  items: MemoryItem[];
}

// ── Auth ────────────────────────────────────────────────

// 后端返回结构较宽松（additionalProperties: true），字段做兼容处理。
export interface AuthUser {
  id?: string | number;
  user_id?: string | number;
  login?: string;
  username?: string;
  name?: string;
  email?: string | null;
  avatar_url?: string | null;
  provider?: string;
  role?: string;
  is_admin?: boolean;
  admin?: boolean;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AuthToken {
  id: string;
  name?: string | null;
  prefix?: string | null;
  token_prefix?: string | null;
  last4?: string | null;
  is_admin?: boolean;
  admin?: boolean;
  revoked?: boolean;
  revoked_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  last_used_at?: string | null;
  [key: string]: unknown;
}

// 列表接口可能直接返回数组，或用 items / tokens / data 包装。
export interface AuthTokenListResponse {
  items?: AuthToken[];
  tokens?: AuthToken[];
  data?: AuthToken[];
  total?: number;
  [key: string]: unknown;
}

// 明文 secret 的字段名不确定，创建后做多字段兜底提取。
/** 创建密钥后返回的元数据（不含明文） */
export interface CreatedTokenMeta {
  id?: string;
  name?: string | null;
  token_prefix?: string | null;
  is_admin?: boolean;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  [key: string]: unknown;
}

/**
 * POST /api/auth/tokens 的响应。
 * 明文在 access_token，token 里是元数据对象（不是明文）。
 */
export interface CreateTokenResponse {
  access_token?: string;
  token_type?: string;
  token?: CreatedTokenMeta | string | null;
  is_admin?: boolean;
  notice?: string;
  secret?: string;
  api_key?: string;
  plaintext?: string;
  key?: string;
  [key: string]: unknown;
}

export interface CreateTokenRequest {
  name?: string;
  expires_days?: number | null;
  admin?: boolean;
}

export interface ServiceTokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  expires_at?: string | null;
  [key: string]: unknown;
}

export interface ClientTokenRequest {
  client_id: string;
  client_secret: string;
  days?: number | null;
  admin?: boolean;
}

// ── Eval ────────────────────────────────────────────────

export interface EvalDryRunPayload {
  answer: string;
  question: string;
  rag_context: string[];
  push_langsmith: boolean;
  include_claim_details: boolean;
}

export interface EvalScores {
  faithfulness: number;
  answer_relevancy: number;
  profile_recall: number;
  profile_precision: number;
  citation_recall: number;
  citation_precision: number;
  timestamp: string;
  question: string;
  claim_details?: unknown;
  faithfulness_claims?: FaithfulnessClaim[];
}

export interface FaithfulnessClaim {
  claim: string;
  sentences: string[];
  result: string;
}

// 兼容两种返回结构：直接返回 scores 字典，或 { scores: {...}, claim_details: [...] }
export interface EvalDryRunResponse {
  scores?: EvalScores;
  claim_details?: unknown;
  faithfulness_claims?: FaithfulnessClaim[];
  [key: string]: unknown;
}
