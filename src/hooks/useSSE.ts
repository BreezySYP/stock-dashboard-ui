import { useEffect, useState } from "react";
import type { SSEEvent } from "../types";
import { SSE_IDLE_TIMEOUT_MS, streamSSE } from "../lib/sse";
import { apiErrorMessage } from "../lib/errors";
import { etlApi } from "../api/etl";

const EVENT_ID_PREFIX = "etl:sse:event-id:";
const LAST_EVENT_PREFIX = "etl:sse:last-event:";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // 忽略存储不可用
  }
}

function clearSession(...keys: string[]) {
  try {
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // 忽略存储不可用
  }
}

function readLastEvent(jobId: string): SSEEvent | null {
  const value = readSession(`${LAST_EVENT_PREFIX}${jobId}`);
  if (!value) return null;
  try {
    return JSON.parse(value) as SSEEvent;
  } catch {
    return null;
  }
}

function readLastEvents(jobId: string | null): SSEEvent[] {
  if (!jobId) return [];
  const event = readLastEvent(jobId);
  return event ? [event] : [];
}

function isTerminalEvent(data: SSEEvent): boolean {
  const rawDone: unknown = data.done;
  const done =
    rawDone === true || rawDone === "true" || rawDone === 1;
  return done;
}

/** ETL 任务进度流（走带鉴权的 fetch，见 lib/sse.ts） */
export function useSSE(jobId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>(() =>
    readLastEvents(jobId),
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEvents(readLastEvents(jobId));
    setDone(false);
    setError("");
    if (jobId === null) return;

    let active = true;
    let terminal = false;
    let controller: AbortController | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const clearIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };

    const resetIdleTimer = () => {
      clearIdleTimer();
      if (!active || terminal) return;
      idleTimer = setTimeout(async () => {
        if (!active || terminal) return;
        terminal = true;
        let status: "stopped" | "failed" = "stopped";
        let message = "长时间未收到进度，已主动停止任务";

        try {
          await etlApi.stopJob(jobId);
        } catch (error) {
          status = "failed";
          message = apiErrorMessage(error, "长时间无进度且停止任务失败");
          setError(message);
        }

        if (!active || dataRef.current?.done) {
          controller?.abort();
          return;
        }
        const latest = dataRef.current;
        setEvents((prev) => [
          ...prev,
          {
            job_id: jobId,
            code: latest?.code ?? "",
            step: latest?.step ?? "",
            status,
            message,
            progress: latest?.progress ?? null,
            done: true,
          },
        ]);
        setDone(true);
        clearSession(
          `${EVENT_ID_PREFIX}${jobId}`,
          `${LAST_EVENT_PREFIX}${jobId}`,
        );
        controller?.abort();
      }, SSE_IDLE_TIMEOUT_MS);
    };

    const dataRef = { current: null as SSEEvent | null };

    // StrictMode 会执行 setup → cleanup → setup。延迟到下一个事件循环再
    // 发请求，第一次 setup 会在定时器触发前被 cleanup 取消，只建立一条流。
    const timer = setTimeout(() => {
      if (!active) return;
      controller = new AbortController();
      resetIdleTimer();
      const after = readSession(`${EVENT_ID_PREFIX}${jobId}`);
      const streamUrl = `/api/etl/stream/${jobId}${
        after ? `?after=${encodeURIComponent(after)}` : ""
      }`;
      streamSSE<SSEEvent>(
        streamUrl,
        (data, meta) => {
          if (!active) return;
          if (meta.id) writeSession(`${EVENT_ID_PREFIX}${jobId}`, meta.id);
          writeSession(
            `${LAST_EVENT_PREFIX}${jobId}`,
            JSON.stringify(data),
          );
          dataRef.current = data;
          resetIdleTimer();
          setEvents((prev) => [...prev, data]);
          if (isTerminalEvent(data)) {
            terminal = true;
            clearIdleTimer();
            if (data.error) setError(data.error);
            setDone(true);
            clearSession(
              `${EVENT_ID_PREFIX}${jobId}`,
              `${LAST_EVENT_PREFIX}${jobId}`,
            );
            controller?.abort();
          }
        },
        { signal: controller.signal, onActivity: resetIdleTimer },
      )
        .catch((err: unknown) => {
          if (!active) return;
          const name = (err as { name?: string })?.name;
          if (name !== "AbortError") {
            console.error("ETL SSE 失败", err);
            setError(apiErrorMessage(err, "进度连接中断"));
          }
        })
        .finally(() => {
          clearIdleTimer();
          if (!active || terminal) return;
          // 连接提前结束不等于任务完成；后端可能仍在继续执行。
          setError("进度连接已结束，任务可能仍在后台执行");
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
      clearIdleTimer();
      controller?.abort();
    };
  }, [jobId]);

  return { events, done, error };
}
