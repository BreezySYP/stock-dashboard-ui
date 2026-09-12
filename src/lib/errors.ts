/**
 * Extract a user-facing message from an API error.
 *
 * FastAPI commonly returns `{ detail: "..." }`; fall back to the Error
 * message and finally to the caller-provided text.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };

  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message;
  }

  return fallback;
}
