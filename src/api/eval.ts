import { agent_client } from "./client";
import type { EvalDryRunPayload, EvalDryRunResponse } from "../types";

// 评测 API，挂在默认 /api 下 → POST /api/eval/dry-run
export const evalApi = {
  dryRun: (payload: EvalDryRunPayload) =>
    agent_client
      .post<EvalDryRunResponse>("/eval/dry-run", payload)
      .then((r) => r.data),
};
