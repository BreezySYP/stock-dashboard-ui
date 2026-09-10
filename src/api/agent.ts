import {
  ChatStartResponse,
  ConversationMessage,
  ConversationResponse,
} from "../types";
import agent_client from "./client";

export const agentApi = {
  ask: (thread_id: string, job_id: string, question: string) =>
    agent_client
      .post<ChatStartResponse>("/ai/qa", { thread_id, job_id, question })
      .then((r) => r.data),

  conversation: (thread_id: string) =>
    agent_client
      .get<
        ConversationResponse | ConversationMessage[]
      >(`/ai/threads/${thread_id}/conversation`)
      .then((r) => r.data),
};
