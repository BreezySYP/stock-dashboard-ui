import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3010,
    host: "0.0.0.0",
    // 容器/挂载盘上 inotify 有时收不到事件，导致 dev server 一直吐旧模块，
    // 用轮询保证改动能触发热更新
    watch: { usePolling: true, interval: 300 },
    proxy: {
      // ← 精确路径放前面，否则 /api 会把所有请求都拦截
      "/api/auth": {
        target: "http://host.docker.internal:8016",
        changeOrigin: true,
      },
      "/api/etl": {
        target: "http://host.docker.internal:8015",
        changeOrigin: true,
        rewrite: (path) => path, // 保持路径不变
      },
      "/api/ai": {
        target: "http://host.docker.internal:8013",
        changeOrigin: true,
      },
      "/api": {
        // ← /api 放最后，兜底
        target: "http://host.docker.internal:8014",
        changeOrigin: true,
      },
    },
  },
});
