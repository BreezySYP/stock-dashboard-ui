import { JobLogs } from "../components/JobLogs";
import { AppShell } from "../layout/AppShell";

export function LogsPage() {
  return (
    <AppShell title="任务日志" subtitle="最近的 ETL 任务执行记录">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <JobLogs />
      </div>
    </AppShell>
  );
}
