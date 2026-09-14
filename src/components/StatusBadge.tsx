interface Props {
  status: string | null;
  size?: "xs" | "sm" | "md";
}

const MAP: Record<string, string> = {
  success: "badge-success",
  failed: "badge-error",
  partial: "badge-warning",
  running: "badge-warning badge-running",
  pending: "badge-ghost",
  cancelled: "badge-ghost",
};

const LABEL: Record<string, string> = {
  success: "✓ 成功",
  failed: "✗ 失败",
  partial: "! 部分成功",
  running: "⟳ 运行中",
  pending: "· 等待",
  cancelled: "× 已取消",
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
