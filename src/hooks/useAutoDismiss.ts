import { useEffect, type Dispatch, type SetStateAction } from "react";

export const DEFAULT_ERROR_TIMEOUT_MS = 5000;

/** 自动清除用户可见的临时错误提示。 */
export function useAutoDismiss<T>(
  value: T,
  setValue: Dispatch<SetStateAction<T>>,
  emptyValue: T,
  timeoutMs = DEFAULT_ERROR_TIMEOUT_MS,
) {
  useEffect(() => {
    if (value === emptyValue) return;
    const timer = setTimeout(() => {
      setValue(emptyValue);
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [emptyValue, setValue, timeoutMs, value]);
}
