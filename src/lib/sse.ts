import { getClientToken } from "../api/client";

/** 连续多久没有收到任何 SSE 网络活动时，主动停止后端任务。 */
export const SSE_IDLE_TIMEOUT_MS = 120_000;

export interface SSEEventMeta {
  id: string | null;
}

export class SseHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`SSE 请求失败：HTTP ${status}`);
    this.name = "SseHttpError";
    this.status = status;
  }
}

/**
 * 用 fetch + ReadableStream 读 SSE。
 * 不用 EventSource 的原因：EventSource 不能自定义请求头，
 * 没法带 `Authorization: Bearer`，后端要求鉴权时会 401。
 *
 * @returns 收到 done / 流结束 时 resolve
 */
export async function streamSSE<T>(
  url: string,
  onData: (data: T, meta: SSEEventMeta) => void,
  options: {
    signal?: AbortSignal;
    onActivity?: () => void;
  } = {},
): Promise<void> {
  const token = getClientToken();
  const res = await fetch(url, {
    headers: {
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: options.signal,
  });

  if (!res.ok) throw new SseHttpError(res.status);
  if (!res.body) return;
  options.onActivity?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    // 同一事件可能有多行 data:
    const lines = chunk.split("\n");
    const idLine = lines.find((line) => line.startsWith("id:"));
    const eventId = idLine ? idLine.slice(3).trim() || null : null;
    const payload = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!payload) return;
    try {
      onData(JSON.parse(payload) as T, { id: eventId });
    } catch {
      // 非 JSON 的心跳/注释行直接忽略
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      options.onActivity?.();
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let index = buffer.indexOf("\n\n");
      while (index >= 0) {
        flush(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
        index = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) flush(buffer);
  } finally {
    reader.cancel().catch(() => {});
  }
}
