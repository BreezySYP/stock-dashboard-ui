import dayjs from "dayjs";
import type { StepMeta } from "../types";

export type CheckpointMode = "date" | "step" | "code";

export interface CheckpointRow {
  key: string;
  date: string;
  code: string;
  step: string;
  status: string;
  startedAt: string;
  completedAt: string;
  total: number;
  latestCount: number;
  inLatestWindow: boolean;
  steps: Record<string, number>;
  stockCount: number;
  raw: Record<string, unknown>;
}

export interface NormalizedCheckpointData {
  rows: CheckpointRow[];
  groupCounts: Record<string, number>;
  total: number;
  meta: Record<string, unknown>;
}

interface AggregateOptions {
  selectedStep?: string;
  cutoffDate?: string;
  match?: "any" | "all";
}

interface RawRow {
  code: string;
  step: string;
  startedAt: string;
  completedAt: string;
  raw: Record<string, unknown>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const LIST_KEYS = [
  "items",
  "rows",
  "results",
  "list",
  "checkpoints",
  "data",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pickString(
  value: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
  }
  return "";
}

function listPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of LIST_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizedDate(value: string): string {
  if (!value) return "";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : value.slice(0, 10);
}

function latestDate(values: string[]): string {
  return values
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] ?? "";
}

function dateAtOrAfter(value: string, cutoff: string): boolean {
  if (!value) return false;
  if (!cutoff) return true;
  return normalizedDate(value) >= cutoff;
}

function normalizeRawRows(payload: unknown): RawRow[] {
  return listPayload(payload)
    .map((item, index) => {
      if (!isRecord(item)) {
        return {
          code: String(item ?? ""),
          step: "",
          startedAt: "",
          completedAt: "",
          raw: { value: item, index },
        };
      }
      return {
        code: pickString(item, ["code", "stock_code", "symbol", "ts_code"]),
        step: pickString(item, ["step", "step_name"]),
        startedAt: pickString(item, [
          "start_at",
          "started_at",
          "last_started_at",
        ]),
        completedAt: pickString(item, [
          "completed_at",
          "last_completed_at",
          "finished_at",
        ]),
        raw: item,
      };
    })
    .filter((row) => row.code || row.step);
}

function emptyCounts(): Record<string, number> {
  return { updated: 0, matched: 0, stale: 0, missing: 0, pending: 0 };
}

function aggregateByDate(rawRows: RawRow[]): NormalizedCheckpointData {
  const buckets = new Map<
    string,
    { records: number; codes: Set<string>; steps: Record<string, number> }
  >();

  for (const row of rawRows) {
    const date = row.completedAt ? normalizedDate(row.completedAt) : "未完成";
    const bucket = buckets.get(date) ?? {
      records: 0,
      codes: new Set<string>(),
      steps: {},
    };
    bucket.records += 1;
    if (row.code) bucket.codes.add(row.code);
    if (row.step) bucket.steps[row.step] = (bucket.steps[row.step] ?? 0) + 1;
    buckets.set(date, bucket);
  }

  const newestDate = latestDate(
    Array.from(buckets.keys()).filter((date) => DATE_RE.test(date)),
  );
  const rows: CheckpointRow[] = Array.from(buckets.entries()).map(
    ([date, bucket], index) => ({
      key: `${date}-${index}`,
      date,
      code: "",
      step: "",
      status: date === newestDate ? "latest" : "stale",
      startedAt: "",
      completedAt: "",
      total: bucket.records,
      latestCount: date === newestDate ? bucket.records : 0,
      inLatestWindow: date === newestDate,
      steps: bucket.steps,
      stockCount: bucket.codes.size,
      raw: {},
    }),
  );

  return {
    rows,
    groupCounts: emptyCounts(),
    total: rawRows.length,
    meta: { latest_date: newestDate },
  };
}

function latestRawRow(rows: RawRow[]): RawRow {
  return [...rows].sort((a, b) => {
    const aTime = a.completedAt || a.startedAt;
    const bTime = b.completedAt || b.startedAt;
    return bTime.localeCompare(aTime);
  })[0];
}

function aggregateByStep(
  rawRows: RawRow[],
  selectedStep: string,
  cutoffDate: string,
): NormalizedCheckpointData {
  const byCode = new Map<string, RawRow[]>();
  for (const row of rawRows) {
    if (row.step !== selectedStep || !row.code) continue;
    const rows = byCode.get(row.code) ?? [];
    rows.push(row);
    byCode.set(row.code, rows);
  }

  const rows: CheckpointRow[] = [];
  const groupCounts = emptyCounts();
  for (const [code, codeRows] of byCode.entries()) {
    const row = latestRawRow(codeRows);
    const status = !row.completedAt
      ? "pending"
      : dateAtOrAfter(row.completedAt, cutoffDate)
        ? "updated"
        : "stale";
    groupCounts[status] += 1;
    rows.push({
      key: `${code}-${selectedStep}`,
      date: normalizedDate(row.completedAt || row.startedAt),
      code,
      step: selectedStep,
      status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      total: 1,
      latestCount: status === "updated" ? 1 : 0,
      inLatestWindow: status === "updated",
      steps: {
        [selectedStep]: status === "updated" ? 1 : status === "stale" ? -1 : 0,
      },
      stockCount: 1,
      raw: row.raw,
    });
  }

  return {
    rows,
    groupCounts,
    total: rows.length,
    meta: { step: selectedStep, cutoff_date: cutoffDate },
  };
}

function expectedStepNames(
  rawRows: RawRow[],
  steps: Pick<StepMeta, "step" | "per_stock">[],
): string[] {
  const perStock = steps.filter((step) => step.per_stock).map((step) => step.step);
  if (perStock.length > 0) return perStock;
  return Array.from(new Set(rawRows.map((row) => row.step).filter(Boolean)));
}

function aggregateByCode(
  rawRows: RawRow[],
  steps: Pick<StepMeta, "step" | "per_stock">[],
  cutoffDate: string,
  match: "any" | "all",
): NormalizedCheckpointData {
  const expected = expectedStepNames(rawRows, steps);
  const byCode = new Map<string, Map<string, RawRow[]>>();

  for (const row of rawRows) {
    if (!row.code || !row.step) continue;
    const stepRows = byCode.get(row.code) ?? new Map<string, RawRow[]>();
    const rows = stepRows.get(row.step) ?? [];
    rows.push(row);
    stepRows.set(row.step, rows);
    byCode.set(row.code, stepRows);
  }

  const rows: CheckpointRow[] = [];
  const groupCounts = emptyCounts();
  for (const [code, stepRows] of byCode.entries()) {
    const stepStates: Record<string, number> = {};
    let updated = 0;
    let missing = 0;
    let stale = 0;
    let latestCompletedAt = "";

    for (const step of expected) {
      const rowsForStep = stepRows.get(step);
      if (!rowsForStep || rowsForStep.length === 0) {
        stepStates[step] = 0;
        missing += 1;
        continue;
      }

      const row = latestRawRow(rowsForStep);
      if (!row.completedAt) {
        stepStates[step] = 0;
        missing += 1;
      } else if (dateAtOrAfter(row.completedAt, cutoffDate)) {
        stepStates[step] = 1;
        updated += 1;
      } else {
        stepStates[step] = -1;
        stale += 1;
      }
      if (row.completedAt > latestCompletedAt) {
        latestCompletedAt = row.completedAt;
      }
    }

    const status =
      missing > 0
        ? "missing"
        : match === "all"
          ? updated === expected.length
            ? "matched"
            : "stale"
          : updated > 0
            ? "matched"
            : "stale";
    groupCounts[status] += 1;

    rows.push({
      key: code,
      date: normalizedDate(latestCompletedAt),
      code,
      step: "",
      status,
      startedAt: "",
      completedAt: latestCompletedAt,
      total: expected.length || stepRows.size,
      latestCount: updated,
      inLatestWindow: status === "matched",
      steps: stepStates,
      stockCount: 1,
      raw: { stale_steps: stale },
    });
  }

  return {
    rows,
    groupCounts,
    total: rows.length,
    meta: { cutoff_date: cutoffDate, match, expected_steps: expected },
  };
}

export function aggregateRawCheckpoints(
  payload: unknown,
  steps: Pick<StepMeta, "step" | "per_stock">[],
  mode: CheckpointMode,
  options: AggregateOptions = {},
): NormalizedCheckpointData {
  const rawRows = normalizeRawRows(payload);
  const cutoffDate = options.cutoffDate ?? dayjs().format("YYYY-MM-DD");

  if (mode === "date") return aggregateByDate(rawRows);
  if (mode === "step") {
    return aggregateByStep(
      rawRows,
      options.selectedStep ?? "",
      cutoffDate,
    );
  }
  return aggregateByCode(
    rawRows,
    steps,
    cutoffDate,
    options.match ?? "all",
  );
}

export function checkpointStatusMeta(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "updated":
      return { label: "已更新", className: "badge-success" };
    case "matched":
      return { label: "已齐全", className: "badge-success" };
    case "pending":
      return { label: "未完成", className: "badge-warning" };
    case "stale":
      return { label: "已过期", className: "badge-warning" };
    case "missing":
      return { label: "缺失", className: "badge-error" };
    case "latest":
      return { label: "最新窗口", className: "badge-info" };
    default:
      return { label: status || "未知", className: "badge-ghost" };
  }
}
