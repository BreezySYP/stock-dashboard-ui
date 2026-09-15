import client from "./client";
import type {
  TriggerResponse,
  RawCheckpoint,
  EtlStatistics,
  EtlRun,
  StopTaskResponse,
  JobLog,
  StepMeta,
  Summary,
  CheckpointInfo,
} from "../types";

export const etlApi = {
  // Steps meta
  steps: () => client.get<StepMeta[]>("/etl/steps").then((r) => r.data),

  // Trigger
  triggerStock: (code: string, steps: string[]) =>
    client
      .post<TriggerResponse>("/etl/trigger/stock", { code, steps })
      .then((r) => r.data),

  triggerAll: (mode: "daily" | "season", steps?: string[]) =>
    client
      .post<TriggerResponse>("/etl/trigger/all", { mode, steps })
      .then((r) => r.data),

  triggerFactor: (factors: string[]) =>
    client
      .post<TriggerResponse>("/etl/trigger/factor", { factors })
      .then((r) => r.data),

  /** 协作式停止：任务在下一个安全点中断，并通过 SSE 推送 stopped。 */
  stopJob: (jobId: string) =>
    client
      .post<StopTaskResponse>(
        `/etl/jobs/${encodeURIComponent(jobId)}/stop`,
      )
      .then((r) => r.data),

  /** 一次拉取 etl_code_checkpoint 全量原始行，聚合交给前端。 */
  checkpointsRaw: () =>
    client
      .get<RawCheckpoint[]>("/etl/checkpoints/codes/raw", {
        timeout: 120000,
      })
      .then((r) => r.data),

  statistics: (params: { start?: string; end?: string } = {}) =>
    client
      .get<EtlStatistics>("/etl/statistics", { params })
      .then((r) => r.data),

  runs: (
    params: { start?: string; end?: string; status?: string } = {},
  ) => client.get<EtlRun[]>("/etl/runs", { params }).then((r) => r.data),

  // Jobs
  runningJobs: () =>
    client.get<JobLog[]>("/etl/jobs/running").then((r) => r.data),

  jobLogs: (params?: { code?: string; step?: string; limit?: number }) =>
    client.get<JobLog[]>("/etl/jobs/logs", { params }).then((r) => r.data),

  cancelJob: (jobId: number) =>
    client.delete(`/etl/jobs/${jobId}`).then((r) => r.data),

  // Status
  summary: () => client.get<Summary>("/status/summary").then((r) => r.data),

  checkpoints: () =>
    client
      .get<Record<string, CheckpointInfo>>("/status/checkpoints")
      .then((r) => r.data),

  clearCheckpoint: (step: string) =>
    client.delete(`/status/checkpoints/${step}`).then((r) => r.data),
};
