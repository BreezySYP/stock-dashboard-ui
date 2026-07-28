import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { StatusBadge } from "./StatusBadge";
import { SSEConsole } from "./SSEConsole";
import type { Summary } from "../types";

export function PipelineOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [triggering, setTriggering] = useState(false);

  const fetchSummary = async () => {
    try {
      const data = await etlApi.summary();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSummary();
    const id = setInterval(fetchSummary, 15000);
    return () => clearInterval(id);
  }, []);

  const handleTriggerAll = async (mode: "daily" | "season") => {
    setTriggering(true);
    try {
      const res = await etlApi.triggerAll(mode);
      setActiveJobIds(res.job_ids);
    } catch (e) {
      console.error(e);
    } finally {
      setTriggering(false);
    }
  };

  const handleClearCheckpoint = async (step: string) => {
    if (!confirm(`确认清除 ${step} 的断点？下次将从头全量执行。`)) return;
    await etlApi.clearCheckpoint(step);
    fetchSummary();
  };

  if (!summary) return <div className="loading loading-spinner loading-md" />;

  const stepList = Object.values(summary.steps);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">Pipeline 总览</h2>
          {summary.running_count > 0 && (
            <div className="badge badge-warning gap-1">
              <span className="loading loading-ring loading-xs" />
              {summary.running_count} 个任务运行中
            </div>
          )}
        </div>

        {/* Master switches */}
        <div className="flex gap-2">
          <button
            className={`btn btn-sm btn-primary ${triggering ? "loading loading-spinner" : ""}`}
            disabled={triggering}
            onClick={() => handleTriggerAll("daily")}
          >
            {triggering ? "" : "▶ 每日全量"}
          </button>
          <button
            className={`btn btn-sm btn-secondary ${triggering ? "loading loading-spinner" : ""}`}
            disabled={triggering}
            onClick={() => handleTriggerAll("season")}
          >
            {triggering ? "" : "▶ 季报全量"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={fetchSummary}>
            ↺ 刷新
          </button>
        </div>
      </div>

      {/* SSE console for all triggered jobs */}
      {activeJobIds.length > 0 && (
        <div className="space-y-1">
          {activeJobIds.slice(0, 3).map((id) => (
            <SSEConsole
              key={id}
              jobId={id}
              onDone={() => {
                setActiveJobIds((prev) => prev.filter((j) => j !== id));
                fetchSummary();
              }}
            />
          ))}
          {activeJobIds.length > 3 && (
            <p className="text-xs opacity-50">
              + {activeJobIds.length - 3} 个任务运行中...
            </p>
          )}
        </div>
      )}

      {/* Steps table */}
      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>Step</th>
              <th>标签</th>
              <th>分组</th>
              <th>最新状态</th>
              <th>最后完成</th>
              <th>断点日期</th>
              <th>断点 Code</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {stepList.map((s) => (
              <tr key={s.step} className="hover">
                <td className="font-mono text-xs">{s.step}</td>
                <td>{s.label}</td>
                <td>
                  <span
                    className={`badge badge-xs ${s.group === "daily" ? "badge-info" : "badge-accent"}`}
                  >
                    {s.group}
                  </span>
                </td>
                <td>
                  <StatusBadge status={s.last_job?.status ?? null} size="xs" />
                </td>
                <td className="text-xs opacity-60">
                  {s.checkpoint?.last_completed_at
                    ? dayjs(s.checkpoint.last_completed_at).format(
                        "MM-DD HH:mm",
                      )
                    : "—"}
                </td>
                <td className="font-mono text-xs opacity-60">
                  {s.checkpoint?.last_completed_date ?? "—"}
                </td>
                <td className="font-mono text-xs opacity-60">
                  {s.checkpoint?.start_code ?? "—"}
                </td>
                <td>
                  <button
                    className="btn btn-xs btn-ghost text-error opacity-60 hover:opacity-100"
                    onClick={() => handleClearCheckpoint(s.step)}
                    title="清除断点，下次从头执行"
                  >
                    清除断点
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
