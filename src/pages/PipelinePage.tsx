import { PipelineOverview } from "../components/PipelineOverview";
import { AppShell } from "../layout/AppShell";

export function PipelinePage() {
  return (
    <AppShell title="Pipeline" subtitle="股票断点聚合与全量任务进度">
      <PipelineOverview />
    </AppShell>
  );
}
