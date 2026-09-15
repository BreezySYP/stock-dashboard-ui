import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { apiErrorMessage } from "../lib/errors";
import {
  aggregateRawCheckpoints,
  checkpointStatusMeta,
  type CheckpointMode,
  type CheckpointRow,
} from "../lib/checkpoints";
import type { StepMeta } from "../types";

type SortKey = keyof Pick<
  CheckpointRow,
  | "code"
  | "date"
  | "status"
  | "startedAt"
  | "completedAt"
  | "total"
  | "latestCount"
  | "stockCount"
> | "stepProgress";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

interface Props {
  steps: StepMeta[];
}

function completedStepCount(row: CheckpointRow): number {
  return Object.values(row.steps).filter((count) => count > 0).length;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "zh-CN", { numeric: true });
}

function sortValue(row: CheckpointRow, key: SortKey): unknown {
  if (key === "stepProgress") return completedStepCount(row);
  return row[key];
}

function formatTime(value: string): string {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : value;
}

function StepBreakdown({
  steps,
  stepMeta,
  limit = 5,
}: {
  steps: Record<string, number>;
  stepMeta: Map<string, StepMeta>;
  limit?: number;
}) {
  const entries = Object.entries(steps).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span className="text-base-content/30">—</span>;

  return (
    <div className="flex max-w-md flex-wrap gap-1">
      {entries.slice(0, limit).map(([step, count]) => (
        <span
          key={step}
          className={`badge badge-xs ${
            count > 0
              ? "badge-success badge-outline"
              : count < 0
                ? "badge-warning badge-outline"
                : "badge-error badge-outline"
          }`}
          title={`${step}: ${count}`}
        >
          {stepMeta.get(step)?.label ?? step}
          {count > 1 ? ` ×${count}` : ""}
        </span>
      ))}
      {entries.length > limit && (
        <span
          className="badge badge-ghost badge-xs"
          title={entries
            .map(([step, count]) => `${step}: ${count}`)
            .join("\n")}
        >
          +{entries.length - limit}
        </span>
      )}
    </div>
  );
}

interface SortableThProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDir;
  align?: "left" | "right";
  onSort: (key: SortKey) => void;
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  align = "left",
  onSort,
}: SortableThProps) {
  const active = sortKey === activeKey;
  return (
    <th className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        className={`btn btn-ghost btn-xs px-1 ${
          align === "right" ? "justify-end" : ""
        } ${active ? "text-primary" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (direction === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

export function CheckpointExplorer({ steps }: Props) {
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const stepMeta = useMemo(
    () => new Map(steps.map((step) => [step.step, step])),
    [steps],
  );

  const [mode, setMode] = useState<CheckpointMode>("date");
  const [date, setDate] = useState(today);
  const [selectedStep, setSelectedStep] = useState("");
  const [match, setMatch] = useState<"any" | "all">("all");
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [refreshKey, setRefreshKey] = useState(0);
  useAutoDismiss(error, setError, "");

  useEffect(() => {
    if (!selectedStep && steps.length > 0) {
      setSelectedStep(steps[0].step);
    }
  }, [selectedStep, steps]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setPayload(null);
      try {
        const data = await etlApi.checkpointsRaw();
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err, "加载断点数据失败"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const normalized = useMemo(
    () =>
      aggregateRawCheckpoints(payload, steps, mode, {
        selectedStep,
        cutoffDate: date,
        match,
      }),
    [date, match, mode, payload, selectedStep, steps],
  );

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return normalized.rows;
    return normalized.rows.filter((row) => {
      const stepText = Object.keys(row.steps).join(" ");
      return [
        row.code,
        row.date,
        row.status,
        row.step,
        row.completedAt,
        stepText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [keyword, normalized.rows]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const result = compareValues(
        sortValue(a, sortKey),
        sortValue(b, sortKey),
      );
      return sortDir === "asc" ? result : -result;
    });
    return rows;
  }, [filtered, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [date, keyword, match, mode, pageSize, selectedStep]);

  const switchMode = (nextMode: CheckpointMode) => {
    setMode(nextMode);
    setSortKey(nextMode === "date" ? "date" : "code");
    setSortDir(nextMode === "date" ? "desc" : "asc");
    setKeyword("");
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "total" ||
          key === "latestCount" ||
          key === "stockCount" ||
          key === "stepProgress" ||
          key === "date" ||
          key === "startedAt" ||
          key === "completedAt"
          ? "desc"
          : "asc",
      );
    }
    setPage(1);
  };

  const latestTotal = normalized.rows.reduce(
    (sum, row) => sum + row.latestCount,
    0,
  );
  const groupTotal = Object.values(normalized.groupCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalStocks = normalized.total || groupTotal;
  const completedCount =
    normalized.groupCounts.updated + normalized.groupCounts.matched;
  const pendingCount =
    normalized.groupCounts.missing + normalized.groupCounts.pending;

  const selectClass = "select select-bordered select-sm";

  return (
    <section className="space-y-4 rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold">股票断点</h2>
          <p className="text-xs text-base-content/50">
            基于 /api/etl/checkpoints/codes/raw 全量数据，聚合、搜索、排序和分页
            均在浏览器完成
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" className="tabs tabs-boxed tabs-sm">
          <button
            type="button"
            role="tab"
            className={`tab ${mode === "date" ? "tab-active" : ""}`}
            onClick={() => switchMode("date")}
          >
            按日期聚合
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${mode === "step" ? "tab-active" : ""}`}
            onClick={() => switchMode("step")}
          >
            按 Step 明细
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${mode === "code" ? "tab-active" : ""}`}
            onClick={() => switchMode("code")}
          >
            按股票聚合
          </button>
        </div>

        {mode !== "date" && (
          <label className="form-control">
            <span className="label-text text-xs">切分日期</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              title="该日期之后完成的断点视为已更新"
            />
          </label>
        )}

        {mode === "step" && (
          <label className="form-control">
            <span className="label-text text-xs">ETL Step</span>
            <select
              className={selectClass}
              value={selectedStep}
              onChange={(event) => setSelectedStep(event.target.value)}
            >
              {steps.map((step) => (
                <option key={step.step} value={step.step}>
                  {step.label} ({step.step})
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === "code" && (
          <label className="form-control">
            <span className="label-text text-xs">匹配方式</span>
            <select
              className={selectClass}
              value={match}
              onChange={(event) =>
                setMatch(event.target.value === "all" ? "all" : "any")
              }
            >
              <option value="all">所有断点满足</option>
              <option value="any">任一步骤满足</option>
            </select>
          </label>
        )}

        <label className="form-control min-w-52 flex-1">
          <span className="label-text text-xs">搜索</span>
          <input
            type="search"
            className="input input-bordered input-sm w-full"
            placeholder={
              mode === "date" ? "搜索日期 / Step" : "搜索股票代码 / 状态 / Step"
            }
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="alert alert-error py-2 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {mode === "date" ? (
          <>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">日期数</div>
              <div className="stat-value text-2xl">{normalized.rows.length}</div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">全量断点记录</div>
              <div className="stat-value text-2xl text-success">
                {normalized.total.toLocaleString()}
              </div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">最新完成日期</div>
              <div className="stat-value text-lg">
                {String(normalized.meta.latest_date || "—")}
              </div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">最新日完成量</div>
              <div className="stat-value text-2xl">
                {latestTotal.toLocaleString()}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">股票总数</div>
              <div className="stat-value text-2xl">
                {totalStocks.toLocaleString()}
              </div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">
                {mode === "step" ? "已更新" : "已完成 / 已齐全"}
              </div>
              <div className="stat-value text-2xl text-success">
                {completedCount.toLocaleString()}
              </div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">已过期</div>
              <div className="stat-value text-2xl text-warning">
                {normalized.groupCounts.stale.toLocaleString()}
              </div>
            </div>
            <div className="stat rounded-box bg-base-200 py-3">
              <div className="stat-title text-xs">
                {mode === "step" ? "未完成" : "缺失 / 未完成"}
              </div>
              <div className="stat-value text-2xl text-error">
                {pendingCount.toLocaleString()}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-box border border-base-300">
        <table className="table table-sm table-pin-rows w-full">
          <thead>
            <tr className="bg-base-200">
              {mode === "date" ? (
                <>
                  <SortableTh
                    label="完成日期"
                    sortKey="date"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <th>窗口</th>
                  <SortableTh
                    label="断点记录数"
                    sortKey="total"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="股票数"
                    sortKey="stockCount"
                    activeKey={sortKey}
                    direction={sortDir}
                    align="right"
                    onSort={handleSort}
                  />
                  <th>分 Step 明细</th>
                </>
              ) : (
                <>
                  <SortableTh
                    label="股票代码"
                    sortKey="code"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="状态"
                    sortKey="status"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  {mode === "step" && (
                    <SortableTh
                      label="开始时间"
                      sortKey="startedAt"
                      activeKey={sortKey}
                      direction={sortDir}
                      onSort={handleSort}
                    />
                  )}
                  <SortableTh
                    label="完成时间"
                    sortKey="completedAt"
                    activeKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  {mode === "code" && (
                    <SortableTh
                      label="已完成 Step"
                      sortKey="stepProgress"
                      activeKey={sortKey}
                      direction={sortDir}
                      align="right"
                      onSort={handleSort}
                    />
                  )}
                  <th>Step 明细</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            )}

            {!loading &&
              pagedRows.map((row) => {
                const dateStatus = row.inLatestWindow ? "latest" : "stale";
                const status = mode === "date" ? dateStatus : row.status;
                const statusMeta = checkpointStatusMeta(status);

                return (
                  <tr key={row.key} className="hover">
                    {mode === "date" ? (
                      <>
                        <td className="font-mono text-xs">
                          {row.date || "—"}
                        </td>
                        <td>
                          <span
                            className={`badge badge-xs ${statusMeta.className}`}
                          >
                            {row.date === "未完成"
                              ? "未完成"
                              : row.inLatestWindow
                                ? "最新"
                                : "历史"}
                          </span>
                        </td>
                        <td className="text-right font-mono">
                          {row.total.toLocaleString()}
                        </td>
                        <td className="text-right font-mono">
                          {row.stockCount.toLocaleString()}
                        </td>
                        <td>
                          <StepBreakdown
                            steps={row.steps}
                            stepMeta={stepMeta}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-mono text-xs">
                          {row.code || "—"}
                        </td>
                        <td>
                          <span
                            className={`badge badge-xs ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        {mode === "step" && (
                          <td className="text-xs opacity-70">
                            {formatTime(row.startedAt)}
                          </td>
                        )}
                        <td className="text-xs opacity-70">
                          {formatTime(row.completedAt)}
                        </td>
                        {mode === "code" && (
                          <td className="text-right font-mono">
                            {completedStepCount(row)} / {row.total}
                          </td>
                        )}
                        <td>
                          <StepBreakdown
                            steps={row.steps}
                            stepMeta={stepMeta}
                            limit={6}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}

            {!loading && pagedRows.length === 0 && !error && (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-base-content/40"
                >
                  暂无断点数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
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
