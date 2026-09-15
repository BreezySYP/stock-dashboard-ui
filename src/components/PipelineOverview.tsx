import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { apiErrorMessage } from "../lib/errors";
import { normalizeEtlRuns } from "../lib/etlRuns";
import type { StepMeta } from "../types";
import { CheckpointExplorer } from "./CheckpointExplorer";
import { EtlJobProgress } from "./EtlJobProgress";
import { EtlRuns } from "./EtlRuns";
import { EtlStatistics } from "./EtlStatistics";

type TriggerMode = "daily" | "season" | "factor";

const FACTOR_STEPS = ["technical", "financial", "composite"];
const RUNNING_CHANGED_EVENT = "etl:running-changed";

const MODE_LABEL: Record<TriggerMode, string> = {
  daily: "每日全量",
  season: "季报全量",
  factor: "因子计算",
};

export function PipelineOverview() {
  const [steps, setSteps] = useState<StepMeta[]>([]);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsError, setStepsError] = useState("");
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [stoppingJobIds, setStoppingJobIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [stoppingAll, setStoppingAll] = useState(false);
  const [triggering, setTriggering] = useState<TriggerMode | null>(null);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [triggerError, setTriggerError] = useState("");
  const [lastTriggeredAt, setLastTriggeredAt] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  useAutoDismiss(triggerError, setTriggerError, "");
  useAutoDismiss(stepsError, setStepsError, "");

  const fetchSteps = useCallback(async () => {
    setStepsLoading(true);
    setStepsError("");
    try {
      const data = await etlApi.steps();
      setSteps(Array.isArray(data) ? data : []);
    } catch (error) {
      setStepsError(apiErrorMessage(error, "加载 ETL Step 失败"));
    } finally {
      setStepsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSteps();
  }, [fetchSteps]);

  useEffect(() => {
    let cancelled = false;
    etlApi
      .runs({ status: "running" })
      .then((data) => {
        if (cancelled) return;
        const jobIds = normalizeEtlRuns(data)
          .filter((run) => run.status === "running")
          .map((run) => run.job_id);
        setActiveJobIds((current) =>
          Array.from(new Set([...current, ...jobIds])),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setTriggerError(apiErrorMessage(error, "加载运行中任务失败"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notifyRunningChanged = () => {
    window.dispatchEvent(new Event(RUNNING_CHANGED_EVENT));
  };

  const handleTrigger = async (mode: TriggerMode) => {
    if (triggering) return;
    setTriggering(mode);
    setTriggerError("");
    setTriggerMessage("");
    setActiveJobIds([]);
    setStoppingJobIds(new Set());
    try {
      const response =
        mode === "factor"
          ? await etlApi.triggerFactor(FACTOR_STEPS)
          : await etlApi.triggerAll(mode);
      setActiveJobIds(response.job_ids ?? []);
      setTriggerMessage(response.message || `${MODE_LABEL[mode]}已启动`);
      setLastTriggeredAt(dayjs().format("YYYY-MM-DD HH:mm:ss"));
      notifyRunningChanged();
    } catch (error) {
      setTriggerError(apiErrorMessage(error, `${MODE_LABEL[mode]}启动失败`));
    } finally {
      setTriggering(null);
    }
  };

  const handleJobDone = useCallback((jobId: string) => {
    setActiveJobIds((ids) => ids.filter((id) => id !== jobId));
    setStoppingJobIds((ids) => {
      const next = new Set(ids);
      next.delete(jobId);
      return next;
    });
    window.dispatchEvent(new Event(RUNNING_CHANGED_EVENT));
  }, []);

  const handleStopJob = useCallback(async (jobId: string) => {
    setStoppingJobIds((ids) => new Set(ids).add(jobId));
    try {
      await etlApi.stopJob(jobId);
      handleJobDone(jobId);
    } catch (error) {
      setStoppingJobIds((ids) => {
        const next = new Set(ids);
        next.delete(jobId);
        return next;
      });
      setTriggerError(
        apiErrorMessage(error, `停止任务 ${jobId.slice(0, 8)} 失败`),
      );
    }
    window.dispatchEvent(new Event(RUNNING_CHANGED_EVENT));
  }, [handleJobDone]);

  const handleStopAll = async () => {
    const ids = activeJobIds.filter((jobId) => !stoppingJobIds.has(jobId));
    if (ids.length === 0 || stoppingAll) return;
    setStoppingAll(true);
    setTriggerError("");
    setStoppingJobIds((current) => new Set([...current, ...ids]));

    const results = await Promise.allSettled(
      ids.map((jobId) => etlApi.stopJob(jobId)),
    );
    const failedIds = ids.filter(
      (_, index) => results[index].status === "rejected",
    );
    const succeededIds = ids.filter(
      (_, index) => results[index].status === "fulfilled",
    );
    succeededIds.forEach(handleJobDone);
    if (failedIds.length > 0) {
      setStoppingJobIds((current) => {
        const next = new Set(current);
        failedIds.forEach((jobId) => next.delete(jobId));
        return next;
      });
      setTriggerError(`${failedIds.length} 个任务停止请求失败，请重试`);
    }
    setStoppingAll(false);
    notifyRunningChanged();
  };

  const groupedSteps = useMemo(
    () => ({
      daily: steps.filter((step) => step.group === "daily"),
      season: steps.filter((step) => step.group === "season"),
    }),
    [steps],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-bold">全量执行</h2>
            <p className="text-xs text-base-content/50">
              触发后通过 /api/etl/stream/&#123;job_id&#125; 实时显示每个 job 的进度
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSteps(true)}
            >
              Step 定义
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={triggering !== null}
              onClick={() => handleTrigger("daily")}
            >
              {triggering === "daily" && (
                <span className="loading loading-spinner loading-xs" />
              )}
              ▶ 每日全量
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={triggering !== null}
              onClick={() => handleTrigger("season")}
            >
              {triggering === "season" && (
                <span className="loading loading-spinner loading-xs" />
              )}
              ▶ 季报全量
            </button>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              disabled={triggering !== null}
              onClick={() => handleTrigger("factor")}
            >
              {triggering === "factor" && (
                <span className="loading loading-spinner loading-xs" />
              )}
              ▶ 因子计算
            </button>
          </div>
        </div>

        {triggerError && (
          <div className="alert alert-error mt-3 py-2 text-sm">
            <span>{triggerError}</span>
          </div>
        )}

        {triggerMessage && (
          <div className="alert alert-success mt-3 py-2 text-sm">
            <span>
              {triggerMessage}
              {lastTriggeredAt ? ` · ${lastTriggeredAt}` : ""}
            </span>
          </div>
        )}

        {activeJobIds.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {activeJobIds.some((jobId) => !stoppingJobIds.has(jobId)) ? (
                <span className="loading loading-ring loading-xs" />
              ) : (
                <span className="text-warning">■</span>
              )}
              任务进度（{activeJobIds.length}）
              <button
                type="button"
                className="btn btn-outline btn-error btn-xs ml-auto"
                disabled={
                  stoppingAll ||
                  activeJobIds.every((jobId) => stoppingJobIds.has(jobId))
                }
                onClick={handleStopAll}
              >
                {stoppingAll ? "正在停止…" : "停止全部"}
              </button>
            </div>
            {activeJobIds.map((jobId, index) => (
              <EtlJobProgress
                key={jobId}
                jobId={jobId}
                index={index}
                stopping={stoppingJobIds.has(jobId)}
                onStop={handleStopJob}
                onDone={handleJobDone}
                onDismiss={handleJobDone}
              />
            ))}
          </div>
        )}
      </section>

      <EtlStatistics />

      <EtlRuns />

      <CheckpointExplorer steps={steps} />

      {showSteps && (
        <div className="modal modal-open" role="dialog" aria-modal="true">
          <div className="modal-box max-w-4xl">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-lg font-bold">ETL Step 定义</h3>
                <p className="text-xs text-base-content/50">
                  共 {steps.length} 个；daily {groupedSteps.daily.length} 个，
                  season {groupedSteps.season.length} 个
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm ml-auto"
                disabled={stepsLoading}
                onClick={fetchSteps}
              >
                {stepsLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "↺ 刷新"
                )}
              </button>
            </div>

            {stepsError && (
              <div className="alert alert-warning mt-3 py-2 text-sm">
                <span>{stepsError}</span>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {steps.map((step) => (
                <div
                  key={step.step}
                  className="flex items-center gap-2 rounded-box border border-base-300 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {step.label}
                    </div>
                    <div className="truncate font-mono text-xs text-base-content/45">
                      {step.step}
                    </div>
                  </div>
                  <span
                    className={`badge badge-xs ${
                      step.group === "daily" ? "badge-info" : "badge-accent"
                    }`}
                  >
                    {step.group}
                  </span>
                  <span
                    className={`badge badge-xs ${
                      step.per_stock ? "badge-outline" : "badge-ghost"
                    }`}
                  >
                    {step.per_stock ? "单股" : "全市场"}
                  </span>
                </div>
              ))}
              {!stepsLoading && steps.length === 0 && (
                <div className="py-8 text-center text-sm text-base-content/40 sm:col-span-2">
                  暂无 Step 定义
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowSteps(false)}
              >
                关闭
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="关闭"
            onClick={() => setShowSteps(false)}
          >
            close
          </button>
        </div>
      )}
    </div>
  );
}
