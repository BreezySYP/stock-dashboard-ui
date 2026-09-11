import { useCallback } from "react";
import {
  useRecoilValue,
  useSetRecoilState,
} from "recoil";
import { authApi } from "../api/auth";
import type { AuthUser } from "../types";
import { rememberRedirect } from "./oauth";
import {
  authErrorState,
  authLoadingState,
  authReloadState,
  authTokenState,
  authUserState,
  isAdminState,
} from "./state";

export interface AuthValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  /** 跳转 GitHub 登录，回来后落到 next */
  login: (next?: string) => void;
  logout: () => void;
  refresh: () => void;
  /** 手动写入 token（OAuth 回调兜底用） */
  setToken: (token: string) => void;
}

/** 读取 Recoil 里的登录状态，并提供 login / logout 等操作 */
export function useAuth(): AuthValue {
  const token = useRecoilValue(authTokenState);
  const user = useRecoilValue(authUserState);
  const loading = useRecoilValue(authLoadingState);
  const error = useRecoilValue(authErrorState);
  const isAdmin = useRecoilValue(isAdminState);

  const setTokenState = useSetRecoilState(authTokenState);
  const setUser = useSetRecoilState(authUserState);
  const setError = useSetRecoilState(authErrorState);
  const setReload = useSetRecoilState(authReloadState);

  const login = useCallback((next?: string) => {
    const target =
      next ?? `${window.location.pathname}${window.location.search}`;
    rememberRedirect(target);
    window.location.href = authApi.loginUrl("/auth/callback");
  }, []);

  const logout = useCallback(() => {
    setTokenState(null);
    setUser(null);
    setError(null);
  }, [setTokenState, setUser, setError]);

  const refresh = useCallback(() => setReload((k) => k + 1), [setReload]);

  const setToken = useCallback(
    (t: string) => setTokenState(t),
    [setTokenState],
  );

  return { user, token, loading, error, isAdmin, login, logout, refresh, setToken };
}
