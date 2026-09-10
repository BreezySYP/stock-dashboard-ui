import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { stocksApi } from "../api/stocks";
import { etlApi } from "../api/etl";
import { StockRow } from "../components/StockRow";
import { PipelineOverview } from "../components/PipelineOverview";
import { JobLogs } from "../components/JobLogs";
import type { StockSummary, StepMeta } from "../types";
import { Chat } from "../components/Chat";

type Tab = "chat" | "stocks" | "pipeline" | "logs";

export function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("stocks");
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [steps, setSteps] = useState<StepMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const PAGE_SIZE = 50;

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stocksApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword,
      });
      setStocks(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    etlApi.steps().then(setSteps).catch(console.error);
  }, []);

  useEffect(() => {
    if (tab === "stocks") fetchStocks();
  }, [tab, fetchStocks]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div
      className={
        tab === "chat"
          ? "h-screen flex flex-col overflow-hidden bg-base-100"
          : "min-h-screen bg-base-100"
      }
    >
      {/* ── Navbar ── */}
      <nav className="navbar bg-base-200 border-b border-base-300 px-6 shrink-0">
        <div className="flex-1">
          <span className="text-lg font-bold font-mono tracking-tight">
            📈 Stock ETL Dashboard
          </span>
        </div>
        <div className="flex-none">
          <button
            type="button"
            className="btn btn-sm btn-ghost mr-2"
            onClick={() => navigate("/memories")}
          >
            🧠 记忆
          </button>
          <div className="tabs tabs-boxed bg-base-300">
            {(["chat", "stocks", "pipeline", "logs"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`tab tab-sm ${tab === t ? "tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "chat" && "ai问答"}
                {t === "stocks" && "股票列表"}
                {t === "pipeline" && "Pipeline"}
                {t === "logs" && "任务日志"}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {tab === "chat" ? (
        <div className="flex-1 min-h-0">
          <Chat />
        </div>
      ) : (
        <div className="p-6">
          {/* ── Stocks tab ── */}
          {tab === "stocks" && (
          <div className="space-y-4">
            {/* Search + stats */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                className="input input-sm input-bordered w-64 font-mono"
                placeholder="搜索代码或名称..."
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
              />
              <span className="text-xs opacity-50">共 {total} 只股票</span>
              <button
                className={`btn btn-sm btn-ghost ml-auto ${loading ? "loading loading-spinner" : ""}`}
                onClick={fetchStocks}
                disabled={loading}
              >
                {loading ? "" : "↺ 刷新"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-sm table-pin-rows w-full">
                <thead>
                  <tr className="bg-base-200">
                    <th className="font-mono">代码</th>
                    <th>名称</th>
                    <th className="text-right">最新价</th>
                    <th>日期</th>
                    {steps
                      .filter((s) =>
                        [
                          "history",
                          "financial_statement",
                          "profile",
                          "news",
                        ].includes(s.step),
                      )
                      .map((s) => (
                        <th key={s.step} className="text-center text-xs">
                          {s.label}
                        </th>
                      ))}
                    <th>链接</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && stocks.length === 0 && (
                    <tr>
                      <td colSpan={99} className="text-center py-12">
                        <span className="loading loading-spinner loading-md" />
                      </td>
                    </tr>
                  )}
                  {!loading && stocks.length === 0 && (
                    <tr>
                      <td colSpan={99} className="text-center py-12 opacity-40">
                        暂无数据
                      </td>
                    </tr>
                  )}
                  {stocks.map((stock) => (
                    <StockRow
                      key={stock.code}
                      stock={stock}
                      steps={steps}
                      onRefresh={fetchStocks}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <div className="join">
                  <button
                    className="join-item btn btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    «
                  </button>
                  {Array.from(
                    { length: Math.min(totalPages, 10) },
                    (_, i) => i + 1,
                  ).map((p) => (
                    <button
                      key={p}
                      className={`join-item btn btn-sm ${page === p ? "btn-active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className="join-item btn btn-sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── Pipeline tab ── */}
          {tab === "pipeline" && <PipelineOverview />}

          {/* ── Logs tab ── */}
          {tab === "logs" && <JobLogs />}
        </div>
      )}
    </div>
  );
}
