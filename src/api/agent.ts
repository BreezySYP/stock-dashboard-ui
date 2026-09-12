import type {
  ChatStartResponse,
  ChatThread,
  ChatThreadListResponse,
  ConversationMessage,
  ConversationResponse,
} from "../types";
import client from "./client";

export const agentApi = {
  ask: (thread_id: string, job_id: string, question: string) =>
    client
      .post<ChatStartResponse>("/ai/qa", { thread_id, job_id, question })
      .then((r) => r.data),

  conversation: (thread_id: string) =>
    client
      .get<ConversationResponse | ConversationMessage[]>(
        `/ai/threads/${encodeURIComponent(thread_id)}/conversation`,
      )
      .then((r) => r.data),

  /** 当前登录用户的会话列表（需要在后端新增该接口） */
  threads: (params: { limit?: number } = {}) =>
    client
      .get<ChatThreadListResponse>("/ai/threads", { params })
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
