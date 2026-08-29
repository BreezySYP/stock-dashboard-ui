import agent_client from "./client";
import type { MemoryListResponse } from "../types";

export interface MemoryListParams {
  limit?: number;
  memory_type?: string;
  namespace?: string;
}

export const memoryApi = {
  list: (userId: string, params: MemoryListParams = {}) =>
    agent_client
      .get<MemoryListResponse>(
        `/ai/users/${encodeURIComponent(userId)}/memories`,
        { params },
      )
      .then((r) => r.data),
};
