import { Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { StockDetailPage } from "./pages/StockDetailPage";
import { MemoriesPage } from "./pages/MemoriesPage";
import { EvalPage } from "./pages/EvalPage";
import { Chat } from "./components/Chat";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/stock/:code" element={<StockDetailPage />} />
      <Route path="/chat/:thread_id/eval" element={<EvalPage />} />
      <Route path="/chat/:thread_id" element={<Chat />} />
      <Route path="/memories" element={<MemoriesPage />} />
      <Route path="/settings/api-keys" element={<ApiKeysPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
    </Routes>
  );
}
