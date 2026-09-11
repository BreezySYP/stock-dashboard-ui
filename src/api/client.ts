import axios from "axios";

// 由 AuthProvider 把 Recoil 里的 token 同步过来（Recoil 不能在 React 外读取）
let clientToken: string | null = null;

export function setClientToken(token: string | null): void {
  clientToken = token;
}

// ✅ 相对路径，走 vite proxy
const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const etl_client = axios.create({
  baseURL: "/api/etl",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const agent_client = axios.create({
  baseURL: "/api/ai",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// auth 服务（统一登录 / API 密钥）
export const auth_client = axios.create({
  baseURL: "/api/auth",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// 已登录时自动带上 Bearer token
[client, etl_client, agent_client, auth_client].forEach((c) =>
  c.interceptors.request.use((config) => {
    if (clientToken) {
      config.headers.set("Authorization", `Bearer ${clientToken}`);
    }
    return config;
  }),
);

[client, etl_client, agent_client, auth_client].forEach((c) =>
  c.interceptors.response.use(
    (r) => r,
    (err) => {
      console.error("API Error:", err.response?.data || err.message);
      return Promise.reject(err);
    },
  ),
);

export default client;
