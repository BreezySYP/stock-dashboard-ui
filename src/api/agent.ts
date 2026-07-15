import { ChatStartResponse } from "../types";
import agent_client from "./client";

export const agentApi = {
  ask: (thread_id: string, question: string) =>
    agent_client
      .post<ChatStartResponse>("/ai/qa", { thread_id, question })
      .then((r) => r.data),
};
