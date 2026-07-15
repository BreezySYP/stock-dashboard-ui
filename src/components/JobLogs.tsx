import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { StatusBadge } from "./StatusBadge";
import type { JobLog } from "../types";

interface Props {
  code?: string;
  step?: string;
}

export function JobLogs({ code, step }: Props) {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await etlApi.jobLogs({ code, step, limit: 50 });
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [code, step]);

  const handleCancel = async (id: number) => {
    await etlApi.cancelJob(id);
    fetch();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm">任务日志</h3>
        <button className="btn btn-xs btn-ghost" onClick={fetch}>
          ↺ 刷新
        </button>
      </div>

      {loading && <div className="loading loading-spinner loading-sm" />}

      <div className="overflow-x-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Code</th>
              <th>Step</th>
              <th>状态</th>
              <th>触发方式</th>
              <th>开始时间</th>
              <th>耗时</th>
              <th>行数</th>
              <th>错误</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="hover">
                <td className="font-mono text-xs opacity-50">{log.id}</td>
                <td className="font-mono text-xs">{log.code}</td>
                <td className="font-mono text-xs">{log.step}</td>
                <td>
                  <StatusBadge status={log.status} size="xs" />
                </td>
                <td className="text-xs opacity-60">{log.triggered_by}</td>
                <td className="text-xs opacity-60">
                  {log.started_at
                    ? dayjs(log.started_at).format("MM-DD HH:mm:ss")
                    : "—"}
                </td>
                <td className="font-mono text-xs">
                  {log.duration_ms != null
                    ? log.duration_ms > 60000
                      ? `${Math.round(log.duration_ms / 60000)}m`
                      : `${Math.round(log.duration_ms / 1000)}s`
                    : "—"}
                </td>
                <td className="font-mono text-xs">{log.row_count}</td>
                <td
                  className="text-xs text-error max-w-xs truncate"
                  title={log.error_msg ?? ""}
                >
                  {log.error_msg ?? "—"}
                </td>
                <td>
                  {(log.status === "pending" || log.status === "running") && (
                    <button
                      className="btn btn-xs btn-ghost text-error"
                      onClick={() => handleCancel(log.id)}
                    >
                      取消
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="text-center opacity-40 py-8">
                  暂无日志
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
