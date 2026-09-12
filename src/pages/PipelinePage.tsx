import { PipelineOverview } from "../components/PipelineOverview";
import { AppShell } from "../layout/AppShell";

export function PipelinePage() {
  return (
    <AppShell title="Pipeline" subtitle="各步骤执行状态与手动触发">
      <PipelineOverview />
    </AppShell>
  );
}
