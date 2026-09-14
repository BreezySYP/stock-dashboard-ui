import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { etlApi } from "../api/etl";
import { apiErrorMessage } from "../lib/errors";
import type { StepMeta } from "../types";
import { CheckpointExplorer } from "./CheckpointExplorer";
import { EtlJobProgress } from "./EtlJobProgress";
import { EtlRuns } from "./EtlRuns";
import { EtlStatistics } from "./EtlStatistics";

type TriggerMode = "daily" | "season" | "factor";

const FACTOR_STEPS = ["technical", "financial", "composite"];

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
  const [triggering, setTriggering] = useState<TriggerMode | null>(null);
  const [triggerMessage, setTriggerMessage] = useState("");
  const [triggerError, setTriggerError] = useState("");
  const [lastTriggeredAt, setLastTriggeredAt] = useState("");
  const [showSteps, setShowSteps] = useState(false);

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

  const handleTrigger = async (mode: TriggerMode) => {
    if (triggering) return;
    setTriggering(mode);
    setTriggerError("");
    setTriggerMessage("");
    setActiveJobIds([]);
    try {
      const response =
        mode === "factor"
          ? await etlApi.triggerFactor(FACTOR_STEPS)
          : await etlApi.triggerAll(mode);
      setActiveJobIds(response.job_ids ?? []);
      setTriggerMessage(response.message || `${MODE_LABEL[mode]}已启动`);
      setLastTriggeredAt(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    } catch (error) {
      setTriggerError(apiErrorMessage(error, `${MODE_LABEL[mode]}启动失败`));
    } finally {
      setTriggering(null);
    }
  };

  const handleJobDone = useCallback((jobId: string) => {
    setActiveJobIds((ids) => ids.filter((id) => id !== jobId));
  }, []);

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
              <span className="loading loading-ring loading-xs" />
              任务进度（{activeJobIds.length}）
            </div>
            {activeJobIds.map((jobId, index) => (
              <EtlJobProgress
                key={jobId}
                jobId={jobId}
                index={index}
                onDone={handleJobDone}
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
