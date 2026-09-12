import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const IMPORT_RE =
  /(?:import|export)[^'"()]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;

/**
 * dev server 起来后先把整张模块图（含 Tailwind/daisyUI 的首次 CSS 编译）
 * 跑一遍，这样浏览器打开时不用等编译，冷启动从 ~8s 降到 1s 内。
 */
async function warmup(server: ViteDevServer) {
  const started = Date.now();
  const logger = server.config.logger;
  const seen = new Set<string>();
  const queue = ["/src/main.tsx"];
  const timings: { url: string; ms: number }[] = [];

  // 首页也要先转一遍，否则第一个请求仍要等
  try {
    const html = await readFile(
      resolve(server.config.root, "index.html"),
      "utf-8",
    );
    const t = Date.now();
    await server.transformIndexHtml("/", html);
    timings.push({ url: "/index.html", ms: Date.now() - t });
  } catch {
    // 首页转换失败不影响预热其余模块
  }

  while (queue.length) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    let result: Awaited<ReturnType<typeof server.transformRequest>>;
    const t = Date.now();
    try {
      result = await server.transformRequest(url);
    } catch {
      continue;
    }
    timings.push({ url, ms: Date.now() - t });

    // transformRequest 返回的是 { code, map, ... }，不是字符串
    const code = typeof result === "string" ? result : result?.code;
    if (!code) continue;

    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(code))) {
      const spec = m[1] ?? m[2];
      if (!spec?.startsWith("/") || spec.startsWith("/@")) continue;
      const clean = spec.split("?")[0];
      // 依赖已经由 esbuild 预打包，不需要预热
      if (clean.startsWith("/node_modules/")) continue;
      if (!seen.has(clean)) queue.push(clean);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const url = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}/`;
  const slowest = timings
    .filter((t) => t.ms > 500)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
    .map((t) => `${t.url} ${t.ms}ms`)
    .join(" · ");
  logger.info(
    `\n  ✅ 预热完成：${seen.size} 个模块 / ${seconds}s${slowest ? `（最慢：${slowest}）` : ""}\n` +
      `  ➜ 现在可以打开浏览器：${url}\n`,
  );
}

function warmupPlugin(): Plugin {
  return {
    name: "app-warmup",
    apply: "serve",
    configureServer(server) {
      if (process.env.NO_WARMUP) {
        server.config.logger.info("\n  已跳过预热（NO_WARMUP=1）");
        return;
      }
      server.httpServer?.once("listening", () => {
        server.config.logger.info("\n  ⏳ 正在预编译模块（首次启动需要几秒）…");
        warmup(server).catch((e) => console.error("[warmup] 失败", e));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), warmupPlugin()],
  server: {
    // auth 服务 GitHub 回调后跳转的前端地址是 localhost:3011，
    // 这里保持一致，避免端口对不上导致回调请求挂起
    port: 3011,
    strictPort: true,
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
