import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { RequireAdmin, RequireAuth } from "./auth/guards";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ChatPage } from "./pages/ChatPage";
import { EvalPage } from "./pages/EvalPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { LogsPage } from "./pages/LogsPage";
import { MemoriesPage } from "./pages/MemoriesPage";
import { PipelinePage } from "./pages/PipelinePage";
import { StockDetailPage } from "./pages/StockDetailPage";
import { StocksPage } from "./pages/StocksPage";
import { ThreadsPage } from "./pages/ThreadsPage";

/** 旧链接 /stock/:code → /stocks/:code */
function LegacyStockRedirect() {
  const { code } = useParams<{ code: string }>();
  return <Navigate to={code ? `/stocks/${code}` : "/stocks"} replace />;
}

/**
 * 页面权限：
 * - 普通用户：聊天、我的记忆、API 密钥
 * - 管理员：以上 + 股票数据 / Pipeline / 任务日志 / 评测
 */
export default function App() {
  return (
    <Routes>
      {/* 公开 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* 普通用户可用 */}
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ThreadsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chat/:thread_id"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/memories"
        element={
          <RequireAuth>
            <MemoriesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/api-keys"
        element={
          <RequireAuth>
            <ApiKeysPage />
          </RequireAuth>
        }
      />
      <Route
        path="/403"
        element={
          <RequireAuth>
            <ForbiddenPage />
          </RequireAuth>
        }
      />

      {/* 仅管理员 */}
      <Route
        path="/stocks"
        element={
          <RequireAdmin>
            <StocksPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/stocks/:code"
        element={
          <RequireAdmin>
            <StockDetailPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/pipeline"
        element={
          <RequireAdmin>
            <PipelinePage />
          </RequireAdmin>
        }
      />
      <Route
        path="/logs"
        element={
          <RequireAdmin>
            <LogsPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/chat/:thread_id/eval"
        element={
          <RequireAdmin>
            <EvalPage />
          </RequireAdmin>
        }
      />

      {/* 默认与兼容旧链接 */}
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/stock/:code" element={<LegacyStockRedirect />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
