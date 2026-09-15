import type {
  ChatStartResponse,
  ChatThread,
  ChatThreadListResponse,
  ConversationMessage,
  ConversationResponse,
  StopTaskResponse,
} from "../types";
import client from "./client";

export interface ThreadListParams {
  limit?: number;
  offset?: number;
  /** 仅管理员可指定查看某用户的会话 */
  user_id?: string;
}

export const agentApi = {
  /**
   * 触发 AI 回答。
   * 后端把 thread_id 定义成 query 参数（body 里也要带一份）。
   */
  ask: (thread_id: string, job_id: string, question: string) =>
    client
      .post<ChatStartResponse>(
        "/ai/qa",
        { thread_id, job_id, question },
        { params: { thread_id } },
      )
      .then((r) => r.data),

  /** 协作式停止：Agent 在下一个节点开始前中断。 */
  stopQa: (job_id: string) =>
    client
      .post<StopTaskResponse>(`/ai/qa/${encodeURIComponent(job_id)}/stop`)
      .then((r) => r.data),

  /** 获取短期 RedisSaver 里的对话 */
  conversation: (thread_id: string) =>
    client
      .get<ConversationResponse | ConversationMessage[]>(
        `/ai/threads/${encodeURIComponent(thread_id)}/conversation`,
      )
      .then((r) => r.data),

  /** 会话列表（按最近活跃排序） */
  listThreads: (params: ThreadListParams = {}) =>
    client
      .get<ChatThreadListResponse>("/ai/threads", { params })
      .then((r) => r.data),

  /** 新建会话，thread_id 由服务端生成 */
  createThread: () =>
    client.post<ChatThread>("/ai/threads").then((r) => r.data),

  /** 重命名会话 */
  renameThread: (thread_id: string, title: string) =>
    client
      .patch(`/ai/threads/${encodeURIComponent(thread_id)}`, { title })
      .then((r) => r.data),

  /** 删除会话（对话数据 + 归属记录） */
  deleteThread: (thread_id: string) =>
    client
      .delete(`/ai/threads/${encodeURIComponent(thread_id)}`)
      .then((r) => r.data),
};

/** 列表兼容数组与 { items / threads / data } 包装 */
export function normalizeThreads(res: ChatThreadListResponse): ChatThread[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as ChatThread[];
  const wrapped = res.items ?? res.threads ?? res.data;
  return Array.isArray(wrapped) ? wrapped : [];
}

export function threadTitle(t: ChatThread): string {
  const title = typeof t.title === "string" ? t.title.trim() : "";
  return title || "未命名会话";
}

/**
 * conversation 接口返回的是自由对象（additionalProperties: true），
 * 这里把常见的包装 / 数组形态都收敛成消息数组。
 */
export function normalizeConversation(res: unknown): ConversationMessage[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as ConversationMessage[];
  if (typeof res !== "object") return [];

  const obj = res as Record<string, unknown>;
  for (const key of ["items", "messages", "data", "conversation", "history"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as ConversationMessage[];
  }
  // 兜底：只有一个数组字段的对象，例如 { checkpoints: [...] }
  const arrays = Object.values(obj).filter(Array.isArray);
  if (arrays.length === 1) return arrays[0] as ConversationMessage[];
  return [];
}
