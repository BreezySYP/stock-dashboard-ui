import { useEffect, useState } from "react";
import type { SSEEvent } from "../types";
import { streamSSE } from "../lib/sse";

/** ETL 任务进度流（走带鉴权的 fetch，见 lib/sse.ts） */
export function useSSE(jobId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setEvents([]);
    setDone(false);
    if (jobId === null) return;

    const controller = new AbortController();
    streamSSE<SSEEvent>(
      `/api/etl/stream/${jobId}`,
      (data) => {
        if (data.done || data.error) {
          setDone(true);
          controller.abort();
          return;
        }
        setEvents((prev) => [...prev, data]);
      },
      { signal: controller.signal },
    )
      .catch((err: unknown) => {
        const name = (err as { name?: string })?.name;
        if (name !== "AbortError") console.error("ETL SSE 失败", err);
      })
      .finally(() => setDone(true));

    return () => controller.abort();
  }, [jobId]);

  return { events, done };
}
