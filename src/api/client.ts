import axios from "axios";

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

[client, etl_client, agent_client].forEach((c) =>
  c.interceptors.response.use(
    (r) => r,
    (err) => {
      console.error("API Error:", err.response?.data || err.message);
      return Promise.reject(err);
    },
  ),
);

export default client;
