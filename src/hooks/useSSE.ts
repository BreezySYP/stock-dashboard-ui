import { useEffect, useRef, useState } from "react";
import type { SSEEvent } from "../types";

export function useSSE(jobId: number | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (jobId === null) return;
    setEvents([]);
    setDone(false);

    const es = new EventSource(`/api/etl/stream/${jobId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data: SSEEvent = JSON.parse(e.data);
      if (data.done) {
        setDone(true);
        es.close();
        return;
      }
      if (data.error) {
        setDone(true);
        es.close();
        return;
      }
      setEvents((prev) => [...prev, data]);
    };

    es.onerror = () => {
      es.close();
      setDone(true);
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  return { events, done };
}
