import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3010,
    host: "0.0.0.0",
    proxy: {
      // ← 精确路径放前面，否则 /api 会把所有请求都拦截
      "/api/etl": {
        target: "http://host.docker.internal:8011",
        changeOrigin: true,
        rewrite: (path) => path, // 保持路径不变
      },
      "/api/ai": {
        target: "http://host.docker.internal:8013",
        changeOrigin: true,
      },
      "/api": {
        // ← /api 放最后，兜底
        target: "http://host.docker.internal:8010",
        changeOrigin: true,
      },
    },
  },
});
