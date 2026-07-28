import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { stocksApi } from "../api/stocks";
import { etlApi } from "../api/etl";
import { StatusBadge } from "../components/StatusBadge";
import { SSEConsole } from "../components/SSEConsole";
import { JobLogs } from "../components/JobLogs";
import type { StockDetail, StepMeta } from "../types";

const PER_STOCK_STEPS = ["history", "financial_statement", "profile", "news"];

export function StockDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [steps, setSteps] = useState<StepMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [trigLoading, setTrigLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"ohlc" | "news" | "financial" | "logs">(
    "ohlc",
  );

  const fetchDetail = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const data = await stocksApi.detail(code);
      setDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    etlApi.steps().then(setSteps).catch(console.error);
  }, [code]);

  const handleTrigger = async (step: string) => {
    if (!code) return;
    setTrigLoading(step);
    try {
      const res = await etlApi.triggerStock(code, [step]);
      setActiveJob(res.job_ids[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setTrigLoading(null);
    }
  };

  if (!detail) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="opacity-50">未找到股票数据</p>
          <button className="btn btn-sm" onClick={() => navigate("/")}>
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  // Chart data (oldest first)
  const chartData = [...detail.ohlc].reverse().map((r) => ({
    date: dayjs(r.date).format("MM-DD"),
    close: r.close,
    volume: r.volume ? Math.round(r.volume / 10000) : null,
    change: r.price_change,
  }));

  const latestClose = detail.ohlc[0]?.close ?? 0;
  const prevClose = detail.ohlc[1]?.close ?? latestClose;
  const pctChange = prevClose
    ? (((latestClose - prevClose) / prevClose) * 100).toFixed(2)
    : "0.00";
  const isUp = parseFloat(pctChange) >= 0;

  const visibleSteps = steps.filter((s) => PER_STOCK_STEPS.includes(s.step));

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Navbar ── */}
      <nav className="navbar bg-base-200 border-b border-base-300 px-6">
        <div className="flex-1 flex items-center gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => navigate("/")}
          >
            ← 返回
          </button>
          <span className="font-mono font-bold text-lg">{detail.code}</span>
          <span className="text-base-content/60">{detail.name}</span>
          {detail.profile?.industry && (
            <span className="badge badge-outline badge-sm">
              {detail.profile.industry}
            </span>
          )}
        </div>
        {/* Price */}
        <div className="flex-none flex items-center gap-4 font-mono">
          <span
            className={`text-2xl font-bold ${isUp ? "text-success" : "text-error"}`}
          >
            {latestClose.toFixed(2)}
          </span>
          <span className={`badge ${isUp ? "badge-success" : "badge-error"}`}>
            {isUp ? "+" : ""}
            {pctChange}%
          </span>
        </div>
      </nav>

      <div className="p-6 space-y-6">
        {/* ── Top grid: Profile + Download buttons ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile card */}
          <div className="lg:col-span-2 card bg-base-200 shadow-sm">
            <div className="card-body py-4 px-5">
              <h3 className="card-title text-sm">公司简介</h3>
              {detail.profile ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <div>
                    <span className="opacity-50">行业：</span>
                    {detail.profile.industry ?? "—"}
                  </div>
                  <div>
                    <span className="opacity-50">员工：</span>
                    {detail.profile.employees?.toLocaleString() ?? "—"}
                  </div>
                  <div className="col-span-2">
                    <span className="opacity-50">主营：</span>
                    <span className="opacity-80">
                      {detail.profile.main_business ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="opacity-50">上市日期：</span>
                    {detail.profile.listing_date
                      ? dayjs(detail.profile.listing_date).format("YYYY-MM-DD")
                      : "—"}
                  </div>
                </div>
              ) : (
                <p className="text-sm opacity-40">暂无简介数据，请先下载。</p>
              )}
            </div>
          </div>

          {/* Download buttons card */}
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body py-4 px-5 space-y-3">
              <h3 className="card-title text-sm">数据下载</h3>
              <div className="space-y-2">
                {visibleSteps.map((s) => (
                  <button
                    key={s.step}
                    className={`btn btn-sm btn-outline w-full justify-start ${
                      trigLoading === s.step ? "loading loading-spinner" : ""
                    }`}
                    disabled={trigLoading !== null}
                    onClick={() => handleTrigger(s.step)}
                  >
                    {trigLoading === s.step ? "" : `↓ ${s.label}`}
                  </button>
                ))}
              </div>

              {/* SSE console */}
              <SSEConsole
                jobId={activeJob}
                onDone={() => {
                  setActiveJob(null);
                  fetchDetail();
                }}
              />

              {/* External links */}
              <div className="divider my-1" />
              <div className="flex flex-col gap-1">
                <a
                  href={detail.links.eastmoney}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-xs btn-ghost justify-start"
                >
                  🔗 东方财富
                </a>
                <a
                  href={detail.links.xueqiu}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-xs btn-ghost justify-start"
                >
                  🔗 雪球
                </a>
                <a
                  href={detail.links.tonghuashun}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-xs btn-ghost justify-start"
                >
                  🔗 同花顺
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tabs tabs-bordered">
          {(["ohlc", "news", "financial", "logs"] as const).map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? "tab-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "ohlc" && `K线 (${detail.ohlc.length})`}
              {t === "news" && `新闻 (${detail.news.length})`}
              {t === "financial" && `财务 (${detail.financial.length})`}
              {t === "logs" && "任务日志"}
            </button>
          ))}
        </div>

        {/* ── OHLC tab ── */}
        {tab === "ohlc" && (
          <div className="space-y-4">
            {/* Price chart */}
            {chartData.length > 0 ? (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body py-4 px-5">
                  <h3 className="card-title text-sm">收盘价走势</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(var(--b3))"
                      />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10 }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "oklch(var(--b2))",
                          border: "none",
                          borderRadius: 8,
                        }}
                        formatter={(v: number) => [v.toFixed(2), "收盘价"]}
                      />
                      <ReferenceLine
                        y={prevClose}
                        stroke="oklch(var(--bc) / 0.2)"
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke={isUp ? "oklch(var(--su))" : "oklch(var(--er))"}
                        dot={false}
                        strokeWidth={1.5}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 opacity-40">暂无 K 线数据</div>
            )}

            {/* OHLC table */}
            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-xs table-pin-rows w-full">
                <thead>
                  <tr className="bg-base-200">
                    <th>日期</th>
                    <th className="text-right">开盘</th>
                    <th className="text-right">最高</th>
                    <th className="text-right">最低</th>
                    <th className="text-right">收盘</th>
                    <th className="text-right">涨跌</th>
                    <th className="text-right">成交量(万)</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.ohlc.map((r, i) => {
                    const up = (r.price_change ?? 0) >= 0;
                    return (
                      <tr key={i} className="hover">
                        <td className="font-mono text-xs">
                          {dayjs(r.date).format("YYYY-MM-DD")}
                        </td>
                        <td className="text-right font-mono text-xs">
                          {r.open?.toFixed(2) ?? "—"}
                        </td>
                        <td className="text-right font-mono text-xs">
                          {r.high?.toFixed(2) ?? "—"}
                        </td>
                        <td className="text-right font-mono text-xs">
                          {r.low?.toFixed(2) ?? "—"}
                        </td>
                        <td className="text-right font-mono text-xs font-medium">
                          {r.close?.toFixed(2) ?? "—"}
                        </td>
                        <td
                          className={`text-right font-mono text-xs ${up ? "text-success" : "text-error"}`}
                        >
                          {r.price_change != null
                            ? `${up ? "+" : ""}${r.price_change.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="text-right font-mono text-xs opacity-60">
                          {r.volume != null
                            ? Math.round(r.volume / 10000).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── News tab ── */}
        {tab === "news" && (
          <div className="space-y-2">
            {detail.news.length === 0 && (
              <div className="text-center py-12 opacity-40">暂无新闻数据</div>
            )}
            {detail.news.map((n) => (
              <div
                key={n.id}
                className="card bg-base-200 shadow-sm hover:bg-base-300 transition-colors"
              >
                <div className="card-body py-3 px-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <a
                        href={n.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sm hover:text-primary line-clamp-2"
                      >
                        {n.title}
                      </a>
                      {n.content && (
                        <p className="text-xs opacity-50 line-clamp-2">
                          {n.content}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-xs opacity-40">
                        {n.date ? dayjs(n.date).format("MM-DD HH:mm") : "—"}
                      </div>
                      {n.source && (
                        <div className="badge badge-ghost badge-xs">
                          {n.source}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Financial tab ── */}
        {tab === "financial" && (
          <div className="overflow-x-auto rounded-box border border-base-300">
            <table className="table table-sm w-full">
              <thead>
                <tr className="bg-base-200">
                  <th>报告期</th>
                  <th>类型</th>
                  <th className="text-right">营收(亿)</th>
                  <th className="text-right">净利润(亿)</th>
                  <th className="text-right">EPS</th>
                  <th className="text-right">ROE(%)</th>
                </tr>
              </thead>
              <tbody>
                {detail.financial.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 opacity-40">
                      暂无财务数据
                    </td>
                  </tr>
                )}
                {detail.financial.map((f, i) => {
                  const profitUp = (f.net_profit ?? 0) >= 0;
                  return (
                    <tr key={i} className="hover">
                      <td className="font-mono text-xs">
                        {f.report_date
                          ? dayjs(f.report_date).format("YYYY-MM-DD")
                          : "—"}
                      </td>
                      <td>
                        <span className="badge badge-xs badge-outline">
                          {f.report_type ?? "—"}
                        </span>
                      </td>
                      <td className="text-right font-mono text-xs">
                        {f.revenue != null ? (f.revenue / 1e8).toFixed(2) : "—"}
                      </td>
                      <td
                        className={`text-right font-mono text-xs ${profitUp ? "text-success" : "text-error"}`}
                      >
                        {f.net_profit != null
                          ? (f.net_profit / 1e8).toFixed(2)
                          : "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {f.eps?.toFixed(2) ?? "—"}
                      </td>
                      <td className="text-right font-mono text-xs">
                        {f.roe?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Logs tab ── */}
        {tab === "logs" && <JobLogs code={code} />}
      </div>
    </div>
  );
}
