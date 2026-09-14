import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { apiErrorMessage } from "../lib/errors";
import type { EtlStatistics as EtlStatisticsData } from "../types";

const EMPTY_STATISTICS: EtlStatisticsData = {
  run_count: 0,
  completed: {},
  skipped: {},
  failed: {},
};

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const count = Number(item);
    if (Number.isFinite(count)) result[key] = count;
  }
  return result;
}

function normalizeStatistics(payload: unknown): EtlStatisticsData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return EMPTY_STATISTICS;
  }
  const root = payload as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  return {
    start: typeof nested.start === "string" ? nested.start : null,
    end: typeof nested.end === "string" ? nested.end : null,
    run_count: Number(nested.run_count ?? nested.runs ?? 0) || 0,
    completed: numberRecord(nested.completed ?? nested.completed_counts),
    skipped: numberRecord(nested.skipped ?? nested.skipped_counts),
    failed: numberRecord(nested.failed ?? nested.failed_counts),
    ...root,
  };
}

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

export function EtlStatistics() {
  const [start, setStart] = useState(
    dayjs().subtract(6, "day").format("YYYY-MM-DD"),
  );
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [data, setData] = useState<EtlStatisticsData>(EMPTY_STATISTICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await etlApi.statistics({
        start: start || undefined,
        end: end || undefined,
      });
      setData(normalizeStatistics(response));
    } catch (err) {
      setError(apiErrorMessage(err, "加载 ETL 统计失败"));
    } finally {
      setLoading(false);
    }
  }, [end, start]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const stepNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(data.completed),
          ...Object.keys(data.skipped),
          ...Object.keys(data.failed),
        ]),
      ).sort((a, b) => {
        const completedDiff =
          (data.completed[b] ?? 0) - (data.completed[a] ?? 0);
        return completedDiff || a.localeCompare(b);
      }),
    [data],
  );

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-bold">执行统计</h2>
          <p className="text-xs text-base-content/50">
            聚合日期范围内各次任务的成功、跳过与失败数量
          </p>
        </div>
        <label className="form-control ml-auto">
          <span className="label-text text-xs">开始日期</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="form-control">
          <span className="label-text text-xs">结束日期</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={loading}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            "↺ 刷新"
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-error mt-3 py-2 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat rounded-box bg-base-200 py-3">
          <div className="stat-title text-xs">任务次数</div>
          <div className="stat-value text-2xl">
            {data.run_count.toLocaleString()}
          </div>
        </div>
        <div className="stat rounded-box bg-base-200 py-3">
          <div className="stat-title text-xs">成功处理</div>
          <div className="stat-value text-2xl text-success">
            {sum(data.completed).toLocaleString()}
          </div>
        </div>
        <div className="stat rounded-box bg-base-200 py-3">
          <div className="stat-title text-xs">跳过</div>
          <div className="stat-value text-2xl text-warning">
            {sum(data.skipped).toLocaleString()}
          </div>
        </div>
        <div className="stat rounded-box bg-base-200 py-3">
          <div className="stat-title text-xs">失败</div>
          <div className="stat-value text-2xl text-error">
            {sum(data.failed).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm w-full">
          <thead>
            <tr className="bg-base-200">
              <th>Step</th>
              <th className="text-right">成功处理</th>
              <th className="text-right">跳过</th>
              <th className="text-right">失败</th>
            </tr>
          </thead>
          <tbody>
            {stepNames.map((step) => (
              <tr key={step} className="hover">
                <td className="font-mono text-xs">{step}</td>
                <td className="text-right font-mono text-success">
                  {(data.completed[step] ?? 0).toLocaleString()}
                </td>
                <td className="text-right font-mono text-warning">
                  {(data.skipped[step] ?? 0).toLocaleString()}
                </td>
                <td className="text-right font-mono text-error">
                  {(data.failed[step] ?? 0).toLocaleString()}
                </td>
              </tr>
            ))}
            {!loading && stepNames.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-base-content/40">
                  该时间范围内暂无统计
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
