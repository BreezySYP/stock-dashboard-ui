// GitHub OAuth 跳转相关工具：取一次性 code、记住登录前的落点。
//
// 注意地址栏里出现的只是**短时效、一次性的 code**，不是 token：
// code 换到 token 后立即把 code 从地址栏抹掉，token 只进 Recoil。

const NEXT_KEY = "auth.next";

// 回调带回来的非凭证参数，清理 URL 时一并去掉
const CALLBACK_NOISE = ["state", "iss", "scope", "token_type", "expires_in"];

/**
 * 从回调地址里取一次性 code（query 或 hash 都兼容），
 * 并立刻把 code / state 等参数从地址栏移除。
 */
export function extractCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const { search, hash, pathname } = window.location;
  const query = search.replace(/^\?/, "");

  const rawHash = hash.replace(/^#/, "");
  const hashSplit = rawHash.indexOf("?");
  const hashPath = hashSplit >= 0 ? rawHash.slice(0, hashSplit) : "";
  const hashQuery = hashSplit >= 0 ? rawHash.slice(hashSplit + 1) : rawHash;

  const code =
    new URLSearchParams(query).get("code") ??
    new URLSearchParams(hashQuery).get("code");

  if (!code) return null;

  const scrub = (raw: string) =>
    raw
      .split("&")
      .filter(Boolean)
      .filter((kv) => {
        const key = decodeURIComponent(kv.split("=")[0]);
        return key !== "code" && !CALLBACK_NOISE.includes(key);
      })
      .join("&");

  const nextQuery = scrub(query);
  const nextHashQuery = scrub(hashQuery);
  const nextHash = nextHashQuery
    ? hashPath
      ? `${hashPath}?${nextHashQuery}`
      : nextHashQuery
    : hashPath;

  const newUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ""}${
    nextHash ? `#${nextHash}` : ""
  }`;
  try {
    window.history.replaceState(null, "", newUrl);
  } catch {
    // 忽略
  }

  return code;
}

// 登录前记住当前位置，登录回调后跳回（只存路径，不存 token）。
export function rememberRedirect(path: string): void {
  try {
    sessionStorage.setItem(NEXT_KEY, path);
  } catch {
    // 忽略
  }
}

export function consumeRedirect(fallback = "/"): string {
  try {
    const next = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    if (next && next.startsWith("/")) return next;
  } catch {
    // 忽略
  }
  return fallback;
}
