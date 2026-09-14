import { useEffect } from "react";
import { useSSE } from "../hooks/useSSE";
import { StatusBadge } from "./StatusBadge";

interface Props {
  jobId: string | null;
  onDone?: () => void;
}

export function SSEConsole({ jobId, onDone }: Props) {
  const { events, done, error } = useSSE(jobId);

  useEffect(() => {
    if (done && !error && onDone) {
      const timer = setTimeout(onDone, 500);
      return () => clearTimeout(timer);
    }
  }, [done, error, onDone]);

  if (!jobId) return null;

  return (
    <div className="bg-base-300 rounded-box p-3 mt-3 max-h-48 overflow-y-auto font-mono text-xs">
      {events.length === 0 && !done && (
        <span className="loading loading-dots loading-xs" />
      )}
      {events.map((e, i) => (
        <div key={i} className="flex gap-2 items-start py-0.5">
          <StatusBadge status={e.status} size="xs" />
          <span className="opacity-60">[{e.step}]</span>
          <span>{e.message}</span>
          {e.progress != null && (
            <span className="ml-auto opacity-50">
              {Math.round(e.progress * 100)}%
            </span>
          )}
        </div>
      ))}
      {error && <div className="text-error mt-1">✗ {error}</div>}
      {done && !error && <div className="text-success mt-1">✓ 任务完成</div>}
    </div>
  );
}
