import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { apiErrorMessage } from "../lib/errors";
import { normalizeEtlRuns } from "../lib/etlRuns";
import type { EtlRun } from "../types";
import { StatusBadge } from "./StatusBadge";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("MM-DD HH:mm:ss") : value;
}

function formatDuration(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.floor(value / 60000)}m ${Math.round((value % 60000) / 1000)}s`;
}

function StatsSummary({ stats }: { stats: Record<string, unknown> | null }) {
  if (!stats || Object.keys(stats).length === 0) {
    return <span className="text-base-content/30">—</span>;
  }
  const entries = Object.entries(stats);
  return (
    <div className="flex max-w-md flex-wrap items-center gap-1">
      {entries.slice(0, 4).map(([key, value]) => (
        <span key={key} className="badge badge-ghost badge-xs">
          {key}: {String(value)}
        </span>
      ))}
      <details className="min-w-0">
        <summary className="cursor-pointer text-xs text-primary">详情</summary>
        <pre className="mt-1 max-h-48 max-w-md overflow-auto whitespace-pre-wrap rounded bg-base-200 p-2 text-xs">
          {JSON.stringify(stats, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function EtlRuns() {
  const [start, setStart] = useState(
    dayjs().subtract(6, "day").format("YYYY-MM-DD"),
  );
  const [end, setEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [status, setStatus] = useState("");
  const [runs, setRuns] = useState<EtlRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  useAutoDismiss(error, setError, "");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await etlApi.runs({
          start: start || undefined,
          end: end || undefined,
          status: status || undefined,
        });
        if (!cancelled) setRuns(normalizeEtlRuns(data));
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, "加载 ETL 任务记录失败"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [end, start, status]);

  useEffect(() => {
    setPage(1);
  }, [keyword, pageSize, status]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return runs;
    return runs.filter((run) =>
      [
        run.job_id,
        run.status,
        run.started_at,
        run.finished_at,
        run.error_msg,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [keyword, runs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-bold">任务记录</h2>
          <p className="text-xs text-base-content/50">
            按开始时间倒序查看 job 状态、耗时、行数与 stats 明细
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
        <label className="form-control">
          <span className="label-text text-xs">状态</span>
          <select
            className="select select-bordered select-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部</option>
            <option value="running">运行中</option>
            <option value="success">成功</option>
            <option value="partial">部分成功</option>
            <option value="failed">失败</option>
            <option value="stopped">已停止</option>
          </select>
        </label>
        <label className="form-control min-w-44">
          <span className="label-text text-xs">搜索</span>
          <input
            type="search"
            className="input input-bordered input-sm"
            placeholder="job_id / 状态 / 错误"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="alert alert-error mt-3 py-2 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm table-pin-rows w-full">
          <thead>
            <tr className="bg-base-200">
              <th>Job ID</th>
              <th>状态</th>
              <th>开始时间</th>
              <th>耗时</th>
              <th className="text-right">行数</th>
              <th>Stats</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            )}
            {!loading &&
              pageRows.map((run) => (
                <tr key={run.job_id} className="hover align-top">
                  <td
                    className="max-w-48 truncate font-mono text-xs"
                    title={run.job_id}
                  >
                    {run.job_id}
                  </td>
                  <td>
                    <StatusBadge status={run.status} size="xs" />
                  </td>
                  <td className="text-xs opacity-70">
                    {formatTime(run.started_at)}
                  </td>
                  <td className="font-mono text-xs">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="text-right font-mono text-xs">
                    {run.row_count != null
                      ? run.row_count.toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <StatsSummary stats={run.stats ?? null} />
                    {run.error_msg && (
                      <div
                        className="mt-1 max-w-md truncate text-xs text-error"
                        title={run.error_msg}
                      >
                        {run.error_msg}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && pageRows.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-base-content/40">
                  该时间范围内暂无任务记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-base-content/50">
          共 {filtered.length.toLocaleString()} 条，第 {currentPage} /{" "}
          {totalPages} 页
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs">
          每页
          <select
            className="select select-bordered select-xs"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="join">
          <button
            type="button"
            className="join-item btn btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            «
          </button>
          <button
            type="button"
            className="join-item btn btn-sm pointer-events-none"
          >
            {currentPage}
          </button>
          <button
            type="button"
            className="join-item btn btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() =>
              setPage((value) => Math.min(totalPages, value + 1))
            }
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
}
