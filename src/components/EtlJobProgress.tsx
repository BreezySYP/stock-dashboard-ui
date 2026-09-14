import { useEffect } from "react";
import { useSSE } from "../hooks/useSSE";
import { StatusBadge } from "./StatusBadge";

interface Props {
  jobId: string;
  index: number;
  label?: string;
  onDone?: (jobId: string) => void;
}

function normalizeProgress(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const normalized = value > 1 && value <= 100 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

export function EtlJobProgress({ jobId, index, label, onDone }: Props) {
  const { events, done, error } = useSSE(jobId);
  const latest = events[events.length - 1];
  const failed = latest?.status === "failed";
  const disconnected = Boolean(error) && !failed;
  const progress =
    done && !failed && !disconnected ? 1 : normalizeProgress(latest?.progress);
  const status = failed ? "failed" : done ? "success" : "running";

  useEffect(() => {
    if (!done || failed || error || !onDone) return;
    const timer = setTimeout(() => onDone(jobId), 800);
    return () => clearTimeout(timer);
  }, [done, error, failed, jobId, onDone]);

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost badge-sm">
          Job {index + 1}
        </span>
        <span
          className="max-w-48 truncate font-mono text-xs text-base-content/50"
          title={jobId}
        >
          {jobId}
        </span>
        {label && <span className="text-xs">{label}</span>}
        <StatusBadge status={status} size="xs" />
        <span className="ml-auto font-mono text-xs">
          {Math.round(progress * 100)}%
        </span>
      </div>

      <progress
        className={`progress mt-2 w-full ${
          failed
            ? "progress-error"
            : done
              ? "progress-success"
              : disconnected
                ? "progress-warning"
                : "progress-primary"
        }`}
        value={progress * 100}
        max={100}
      />

      <div className="mt-2 flex min-h-5 items-start gap-2 text-xs">
        {!latest && !done && !failed && !disconnected && (
          <span className="loading loading-dots loading-xs" />
        )}
        {latest && (
          <>
            <span className="font-mono text-base-content/45">
              [{latest.step}]
            </span>
            <span
              className={`min-w-0 break-words ${
                disconnected ? "text-warning" : ""
              }`}
            >
              {error || latest.message || "执行中..."}
            </span>
          </>
        )}
        {!latest && error && <span className="text-error">{error}</span>}
        {done && !failed && (
          <span className="text-success">✓ 任务完成</span>
        )}
      </div>
    </div>
  );
}
