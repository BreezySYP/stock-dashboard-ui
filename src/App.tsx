import { Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { StockDetailPage } from "./pages/StockDetailPage";
import { MemoriesPage } from "./pages/MemoriesPage";
import { Chat } from "./components/Chat";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/stock/:code" element={<StockDetailPage />} />
      <Route path="/chat/:thread_id" element={<Chat />} />
      <Route path="/memories" element={<MemoriesPage />} />
    </Routes>
  );
}
