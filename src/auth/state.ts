import { atom, selector } from "recoil";
import type { AuthUser } from "../types";

// ── Auth 状态的唯一来源：Recoil atom ───────────────────────

// token 用 sessionStorage 持久化：刷新页面不掉登录态，
// 关闭标签页即失效；不使用 localStorage。
const TOKEN_STORAGE_KEY = "auth.token";

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // 隐私模式等场景下不可用
    return null;
  }
}

/** 把 token 同步进 sessionStorage（传 null 表示清除） */
export function persistToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 忽略
  }
}

// 默认值直接读 sessionStorage，刷新后首帧就是已登录状态
export const authTokenState = atom<string | null>({
  key: "auth/token",
  default: readStoredToken(),
});

export const authUserState = atom<AuthUser | null>({
  key: "auth/user",
  default: null,
});

export const authLoadingState = atom<boolean>({
  key: "auth/loading",
  default: false,
});

export const authErrorState = atom<string | null>({
  key: "auth/error",
  default: null,
});

// 自增计数器，用于手动重新拉取 /me
export const authReloadState = atom<number>({
  key: "auth/reload",
  default: 0,
});

export function isAdminUser(user: AuthUser | null): boolean {
  if (!user) return false;
  if (typeof user.is_admin === "boolean") return user.is_admin;
  if (typeof user.admin === "boolean") return user.admin;
  return user.role === "admin";
}

export const isAdminState = selector<boolean>({
  key: "auth/isAdmin",
  get: ({ get }) => isAdminUser(get(authUserState)),
});

export const isAuthenticatedState = selector<boolean>({
  key: "auth/isAuthenticated",
  get: ({ get }) => Boolean(get(authTokenState) && get(authUserState)),
});
