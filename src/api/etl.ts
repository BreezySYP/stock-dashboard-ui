import client from "./client";
import type {
  TriggerResponse,
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
