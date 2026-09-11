import { useEffect, useRef, type ReactNode } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { authApi, extractAccessToken } from "../api/auth";
import { setClientToken } from "../api/client";
import { extractCodeFromUrl } from "./oauth";
import {
  authErrorState,
  authLoadingState,
  authReloadState,
  authTokenState,
  authUserState,
  persistToken,
} from "./state";

function errorMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { detail?: unknown }; status?: number };
    message?: string;
  };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return e?.message ?? "请求失败";
}

/**
 * Auth 副作用集中在这里（需要用 RecoilRoot 包裹）：
 * 1. 首次加载：优先用 sessionStorage 里的 token；
 *    若地址栏带一次性 code（GitHub 回调），拿它换 token（token 不经过 URL）
 * 2. token 变化时同步给 axios，并写入 sessionStorage
 * 3. 有 token 时拉取 /me
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useRecoilState(authTokenState);
  const reload = useRecoilValue(authReloadState);
  const setUser = useSetRecoilState(authUserState);
  const setLoading = useSetRecoilState(authLoadingState);
  const setError = useSetRecoilState(authErrorState);
  const bootstrapped = useRef(false);

  // 1. 启动引导：sessionStorage 恢复 → 一次性 code 换 token
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (token) return; // 已从 sessionStorage 恢复

    const code = extractCodeFromUrl();
    if (!code) return; // 普通访问，未登录

    let obtained = false;
    setLoading(true);
    authApi
      .exchangeCode(code)
      .then((data) => {
        const fresh = extractAccessToken(data);
        if (!fresh) {
          // 只打印字段名，避免把 token 打到控制台
          console.warn(
            "[auth] 换码响应里没识别出 token 字段，响应字段：",
            data && typeof data === "object" ? Object.keys(data) : typeof data,
          );
          setError("换取 token 失败：登录接口没有返回 token 字段");
          return;
        }
        obtained = true;
        setToken(fresh);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => {
        // 拿到 token 时由下面的 /me 流程接管 loading
        if (!obtained) setLoading(false);
      });
    // 这里故意不做 cancelled 清理：code 是一次性的，
    // React StrictMode 会重复执行 effect，重复换码会失败，所以用 ref 保证只换一次。
    // 仅在首次挂载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Recoil → axios + sessionStorage（刷新后可恢复）
  useEffect(() => {
    setClientToken(token);
    persistToken(token);
  }, [token]);

  // 3. token → /me
  useEffect(() => {
    if (!token) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authApi
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setUser(null);
        setError(errorMessage(err));
        // token 失效则清掉，避免一直带着坏 token 请求
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 401) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reload, setToken, setUser, setError, setLoading]);

  return <>{children}</>;
}
