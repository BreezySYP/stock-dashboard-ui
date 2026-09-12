// 与 etl.ts / stocks.ts 同一约定：用 default client（baseURL "/api"），
// 路径里写全服务前缀，即 /api/auth/...
import client from "./client";
import type {
  AuthToken,
  AuthTokenListResponse,
  AuthUser,
  ClientTokenRequest,
  CreateTokenRequest,
  CreateTokenResponse,
  CreatedTokenMeta,
  ServiceTokenResponse,
} from "../types";

export const authApi = {
  /** 浏览器跳转登录：走后端 GitHub OAuth，登录后回到 next 指定的相对路径 */
  loginUrl: (next = "/") =>
    `/api/auth/login/github?next=${encodeURIComponent(next)}`,

  /**
   * 用一次性 code 换 token。
   * GitHub 回调后地址栏里是短时效、一次性的 `code`（不是 token），
   * 这里拿它调 POST /api/auth/token 换成 token，换完立刻从地址栏抹掉。
   * （复数 /api/auth/tokens 是给后端服务间创建 token 用的，前端不用。）
   */
  exchangeCode: (code: string) =>
    client
      .post<ServiceTokenResponse>("/auth/token", { code })
      .then((r) => r.data),

  me: () => client.get<AuthUser>("/auth/me").then((r) => r.data),

  listTokens: () =>
    client.get<AuthTokenListResponse>("/auth/tokens").then((r) => r.data),

  createToken: (payload: CreateTokenRequest) =>
    client
      .post<CreateTokenResponse>("/auth/tokens", payload)
      .then((r) => r.data),

  revokeToken: (tokenId: string) =>
    client
      .delete(`/auth/tokens/${encodeURIComponent(tokenId)}`)
      .then((r) => r.data),

  /** client credentials 换取 service token（脚本/后台调用，非浏览器登录） */
  clientToken: (payload: ClientTokenRequest) =>
    client
      .post<ServiceTokenResponse>("/auth/token", payload)
      .then((r) => r.data),
};

const TOKEN_KEYS = [
  "access_token",
  "token",
  "jwt",
  "access",
  "id_token",
  "api_key",
];

/**
 * 从换 token 的响应里取明文 token。
 * 后端响应的字段名没有写死在文档里（additionalProperties: true），
 * 所以先按常见字段名找，再兜底找带 token/secret/access 的字段。
 */
export function extractAccessToken(res: unknown): string | null {
  if (!res) return null;
  if (typeof res === "string") return res || null;
  if (typeof res !== "object") return null;

  const obj = res as Record<string, unknown>;
  const scopes: Record<string, unknown>[] = [obj];
  for (const wrapper of ["data", "result", "token"]) {
    const inner = obj[wrapper];
    if (inner && typeof inner === "object") {
      scopes.push(inner as Record<string, unknown>);
    }
  }

  for (const scope of scopes) {
    for (const key of TOKEN_KEYS) {
      const value = scope[key];
      if (typeof value === "string" && value.length >= 8) return value;
    }
  }
  for (const scope of scopes) {
    for (const [key, value] of Object.entries(scope)) {
      if (typeof value === "string" && value.length >= 20) {
        if (/(token|secret|jwt|access)/i.test(key)) return value;
      }
    }
  }
  return null;
}

/** tokens 列表兼容数组与 { items / tokens / data } 包装 */
export function normalizeTokens(res: AuthTokenListResponse): AuthToken[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as AuthToken[];
  const wrapped = res.items ?? res.tokens ?? res.data;
  return Array.isArray(wrapped) ? wrapped : [];
}

// 明文可能出现的字段名，按优先级排列
const SECRET_KEYS = [
  "access_token",
  "plaintext",
  "secret",
  "api_key",
  "key",
  "token",
];

/**
 * 创建接口只返回一次明文，字段名做兜底。
 * 注意后端返回里 `token` 常常是元数据对象，只有字符串才算明文。
 */
export function extractSecret(res: CreateTokenResponse | null): string | null {
  if (!res) return null;
  if (typeof res === "string") return res || null;

  const obj = res as Record<string, unknown>;
  const scopes = [obj, obj.token, obj.data].filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object",
  );

  for (const scope of scopes) {
    for (const key of SECRET_KEYS) {
      const value = scope[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return null;
}

/** 创建响应里的元数据（用于展示前缀/有效期） */
export function extractTokenMeta(
  res: CreateTokenResponse | null,
): CreatedTokenMeta | null {
  if (!res || typeof res !== "object") return null;
  const token = (res as CreateTokenResponse).token;
  if (token && typeof token === "object") return token as CreatedTokenMeta;
  if (res.id || res.token_prefix) return res as CreatedTokenMeta;
  return null;
}
