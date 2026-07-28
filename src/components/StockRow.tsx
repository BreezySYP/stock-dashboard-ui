import { useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import type { StockSummary, StepMeta } from "../types";
import { StatusBadge } from "./StatusBadge";
import { SSEConsole } from "./SSEConsole";
import { etlApi } from "../api/etl";

const PER_STOCK_STEPS = ["history", "financial_statement", "profile", "news"];

interface Props {
  stock: StockSummary;
  steps: StepMeta[];
  onRefresh: () => void;
}

export function StockRow({ stock, steps, onRefresh }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const visibleSteps = steps.filter((s) => PER_STOCK_STEPS.includes(s.step));

  const handleTrigger = async (e: React.MouseEvent, step: string) => {
    e.stopPropagation();
    setLoading(step);
    try {
      const res = await etlApi.triggerStock(stock.code, [step]);
      
      setActiveJobId(res.job_ids[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      {/* ── Main row ── */}
      <tr
        className="cursor-pointer hover"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="font-mono text-xs w-4">
          <span className="opacity-40 mr-1">{expanded ? "▼" : "▶"}</span>
          {stock.code}
        </td>
        <td>{stock.name}</td>
        <td className="text-right font-mono text-sm">
          {stock.latest_close != null ? stock.latest_close.toFixed(2) : "—"}
        </td>
        <td className="text-xs opacity-50">
          {stock.latest_date ? dayjs(stock.latest_date).format("MM-DD") : "—"}
        </td>

        {/* Step status columns */}
        {visibleSteps.map((s) => (
          <td
            key={s.step}
            className="text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-1">
              <StatusBadge
                status={stock.step_status[s.step]?.status ?? null}
                size="xs"
              />
              <button
                className={`btn btn-xs btn-outline ${loading === s.step ? "loading loading-spinner" : ""}`}
                disabled={loading !== null}
                onClick={(e) => handleTrigger(e, s.step)}
                title={`下载 ${s.label}`}
              >
                {loading === s.step ? "" : "↓"}
              </button>
            </div>
          </td>
        ))}

        {/* Links */}
        <td onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1 flex-wrap">
            <a
              href={stock.links.eastmoney}
              target="_blank"
              rel="noreferrer"
              className="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
            >
              东财
            </a>
            <a
              href={stock.links.xueqiu}
              target="_blank"
              rel="noreferrer"
              className="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
            >
              雪球
            </a>
            <a
              href={stock.links.tonghuashun}
              target="_blank"
              rel="noreferrer"
              className="btn btn-xs btn-ghost opacity-50 hover:opacity-100"
            >
              同花顺
            </a>
          </div>
        </td>
      </tr>

      {/* ── Expanded row ── */}
      {expanded && (
        <tr>
          <td colSpan={5 + visibleSteps.length} className="p-0">
            <div className="bg-base-200 px-6 py-4 border-t border-base-300">
              {/* Step detail table */}
              <div className="overflow-x-auto mb-3">
                <table className="table table-xs w-full">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>标签</th>
                      <th>状态</th>
                      <th>最后成功</th>
                      <th>行数</th>
                      <th>错误信息</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSteps.map((s) => {
                      const st = stock.step_status[s.step];
                      return (
                        <tr key={s.step}>
                          <td className="font-mono text-xs">{s.step}</td>
                          <td>{s.label}</td>
                          <td>
                            <StatusBadge
                              status={st?.status ?? null}
                              size="xs"
                            />
                          </td>
                          <td className="text-xs opacity-50">
                            {st?.last_success
                              ? dayjs(st.last_success).format(
                                  "YYYY-MM-DD HH:mm",
                                )
                              : "—"}
                          </td>
                          <td className="font-mono text-xs">
                            {st?.row_count ?? 0}
                          </td>
                          <td
                            className="text-xs text-error max-w-xs truncate"
                            title={st?.error_msg ?? ""}
                          >
                            {st?.error_msg ?? "—"}
                          </td>
                          <td>
                            <button
                              className={`btn btn-xs btn-primary ${loading === s.step ? "loading loading-spinner" : ""}`}
                              disabled={loading !== null}
                              onClick={(e) => handleTrigger(e, s.step)}
                            >
                              {loading === s.step ? "" : `下载 ${s.label}`}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SSE console */}
              <SSEConsole
                jobId={activeJobId}
                onDone={() => {
                  setActiveJobId(null);
                  onRefresh();
                }}
              />

              {/* Detail link */}
              <div className="mt-3 flex justify-end">
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/stock/${stock.code}`)}
                >
                  查看完整详情 →
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
