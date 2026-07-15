import client from "./client";
import type { StockListResponse, StockDetail } from "../types";

export const stocksApi = {
  list: (params: { page?: number; page_size?: number; keyword?: string }) =>
    client.get<StockListResponse>("/stocks", { params }).then((r) => r.data),

  detail: (code: string) =>
    client.get<StockDetail>(`/stocks/${code}`).then((r) => r.data),

  stepOverview: () => client.get("/stocks/status/overview").then((r) => r.data),
};
