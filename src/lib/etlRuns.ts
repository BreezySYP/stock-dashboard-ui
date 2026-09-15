import type { EtlRun } from "../types";

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
    if (typeof item === "number") return String(item);
  }
  return "";
}

function pickNumber(
  value: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const item = value[key];
    const number = typeof item === "number" ? item : Number(item);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function normalizeEtlRuns(payload: unknown): EtlRun[] {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? ["runs", "items", "rows", "data"].reduce<unknown[]>(
          (found, key) =>
            found.length > 0
              ? found
              : Array.isArray(payload[key])
                ? (payload[key] as unknown[])
                : found,
          [],
        )
      : [];

  return list
    .filter(isRecord)
    .map((item, index) => {
      const stats =
        isRecord(item.stats)
          ? item.stats
          : isRecord(item.statistics)
            ? item.statistics
            : null;
      return {
        ...item,
        job_id:
          pickString(item, ["job_id", "run_id", "id"]) || `run-${index}`,
        status:
          pickString(item, ["status", "state"]).toLowerCase() || "unknown",
        started_at:
          pickString(item, ["started_at", "start_at", "created_at"]) || null,
        finished_at:
          pickString(item, ["finished_at", "completed_at", "end_at"]) || null,
        duration_ms: pickNumber(item, [
          "duration_ms",
          "elapsed_ms",
          "duration",
        ]),
        row_count: pickNumber(item, [
          "row_count",
          "rows",
          "total_rows",
          "count",
        ]),
        stats,
        error_msg:
          pickString(item, ["error_msg", "error", "message"]) || null,
      } as EtlRun;
    });
}
