import client from "./client";
import type { EvalDryRunPayload, EvalDryRunResponse } from "../types";

// 评测 API 挂在 agent 服务下 → POST /api/ai/eval/dry-run
export const evalApi = {
  dryRun: (payload: EvalDryRunPayload) =>
    client
      .post<EvalDryRunResponse>("/ai/eval/dry-run", payload)
      .then((r) => r.data),
};
