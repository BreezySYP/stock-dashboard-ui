import { useCallback, useEffect, useState } from "react";
import { stocksApi } from "../api/stocks";
import { etlApi } from "../api/etl";
import { StockRow } from "../components/StockRow";
import { AppShell } from "../layout/AppShell";
import type { StockSummary, StepMeta } from "../types";

const PAGE_SIZE = 50;

const SHOW_STEPS = ["history", "financial_statement", "profile", "news"];

export function StocksPage() {
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [steps, setSteps] = useState<StepMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

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
    fetchStocks();
  }, [fetchStocks]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppShell title="股票数据" subtitle={`共 ${total} 只股票`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="input input-sm input-bordered w-64"
            placeholder="搜索代码或名称..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
          <button
            type="button"
            className="btn btn-sm btn-ghost ml-auto"
            onClick={fetchStocks}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "↺ 刷新"
            )}
          </button>
        </div>

        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm table-pin-rows w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="font-mono">代码</th>
                <th>名称</th>
                <th className="text-right">最新价</th>
                <th>日期</th>
                {steps
                  .filter((s) => SHOW_STEPS.includes(s.step))
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
                  <td colSpan={99} className="py-12 text-center">
                    <span className="loading loading-spinner loading-md" />
                  </td>
                </tr>
              )}
              {!loading && stocks.length === 0 && (
                <tr>
                  <td colSpan={99} className="py-12 text-center text-base-content/40">
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

        {totalPages > 1 && (
          <div className="flex justify-center">
            <div className="join">
              <button
                type="button"
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
                  type="button"
                  className={`join-item btn btn-sm ${page === p ? "btn-active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
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
    </AppShell>
  );
}
