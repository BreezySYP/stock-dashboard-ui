interface Props {
  status: string | null;
  size?: "xs" | "sm" | "md";
}

const MAP: Record<string, string> = {
  success: "badge-success",
  failed: "badge-error",
  running: "badge-warning badge-running",
  pending: "badge-ghost",
};

const LABEL: Record<string, string> = {
  success: "✓ 成功",
  failed: "✗ 失败",
  running: "⟳ 运行中",
  pending: "· 等待",
};

export function StatusBadge({ status, size = "sm" }: Props) {
  if (!status)
    return (
      <span className="badge badge-ghost badge-sm opacity-30">未执行</span>
    );
  return (
    <span className={`badge badge-${size} ${MAP[status] ?? "badge-ghost"}`}>
      {LABEL[status] ?? status}
    </span>
  );
}
