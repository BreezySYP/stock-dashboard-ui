import { Navigate, useParams } from "react-router-dom";
import { Chat } from "../components/Chat";
import { AppShell } from "../layout/AppShell";

export function ChatPage() {
  const { thread_id } = useParams<{ thread_id: string }>();
  if (!thread_id) return <Navigate to="/chat" replace />;

  return (
    <AppShell title="AI 投资顾问" subtitle="基于知识库与实时数据回答" fill>
      <Chat threadId={thread_id} />
    </AppShell>
  );
}
