import { useEffect, useState } from "react";
import type { SSEEvent } from "../types";
import { streamSSE } from "../lib/sse";
import { apiErrorMessage } from "../lib/errors";

function isTerminalEvent(data: SSEEvent): boolean {
  const rawDone: unknown = data.done;
  const done =
    rawDone === true || rawDone === "true" || rawDone === 1;
  return Boolean(data.error) || done || data.status === "failed";
}

/** ETL 任务进度流（走带鉴权的 fetch，见 lib/sse.ts） */
export function useSSE(jobId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEvents([]);
    setDone(false);
    setError("");
    if (jobId === null) return;

    let active = true;
    let terminal = false;
    const controller = new AbortController();
    streamSSE<SSEEvent>(
      `/api/etl/stream/${jobId}`,
      (data) => {
        if (!active) return;
        setEvents((prev) => [...prev, data]);
        if (isTerminalEvent(data)) {
          terminal = true;
          if (data.error) setError(data.error);
          setDone(true);
          controller.abort();
        }
      },
      { signal: controller.signal },
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
        if (!active || terminal) return;
        // 连接提前结束不等于任务完成；后端可能仍在继续执行。
        setError("进度连接已结束，任务可能仍在后台执行");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [jobId]);

  return { events, done, error };
}
