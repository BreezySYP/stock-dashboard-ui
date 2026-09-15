import { useEffect, useState } from "react";
import { etlApi } from "../api/etl";
import { apiErrorMessage } from "../lib/errors";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useSSE } from "../hooks/useSSE";
import { StatusBadge } from "./StatusBadge";

interface Props {
  jobId: string | null;
  onDone?: () => void;
}

export function SSEConsole({ jobId, onDone }: Props) {
  const { events, done, error } = useSSE(jobId);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState("");
  useAutoDismiss(stopError, setStopError, "");
  const latest = events[events.length - 1];
  const stopped = latest?.status === "stopped";
  const failed = latest?.status === "failed";

  useEffect(() => {
    setStopping(false);
    setStopError("");
  }, [jobId]);

  useEffect(() => {
    if (done && !error && !stopped && !failed && onDone) {
      const timer = setTimeout(onDone, 500);
      return () => clearTimeout(timer);
    }
  }, [done, error, failed, onDone, stopped]);

  if (!jobId) return null;

  const handleStop = async () => {
    setStopping(true);
    setStopError("");
    try {
      await etlApi.stopJob(jobId);
      onDone?.();
    } catch (err) {
      setStopping(false);
      setStopError(apiErrorMessage(err, "停止 ETL 任务失败"));
    }
  };

  return (
    <div className="mt-3 rounded-box bg-base-300 p-3 font-mono text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-sans font-medium">ETL 进度</span>
        {!done && !stopped && !failed && (
          <button
            type="button"
            className="btn btn-outline btn-error btn-xs ml-auto font-sans"
            disabled={stopping}
            onClick={handleStop}
          >
            {stopping ? "正在停止…" : "停止"}
          </button>
        )}
        {stopped && <span className="ml-auto text-base-content/60">■ 已停止</span>}
      </div>

      <div className="max-h-48 overflow-y-auto">
        {events.length === 0 && !done && !error && (
          <span className="loading loading-dots loading-xs" />
        )}
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-2 py-0.5">
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
        {error && <div className="mt-1 text-warning">⚠ {error}</div>}
        {stopError && <div className="mt-1 text-error">✗ {stopError}</div>}
        {done && !error && !stopped && !failed && (
          <div className="mt-1 text-success">✓ 任务完成</div>
        )}
        {failed && <div className="mt-1 text-error">✗ 任务失败</div>}
      </div>
    </div>
  );
}
