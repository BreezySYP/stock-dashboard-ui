# Stock ETL Dashboard UI

A股数据 ETL 管理前端，基于 Vite + React + TypeScript + Tailwind CSS + DaisyUI。

## 技术栈

- **Vite** — 构建工具
- **React 18** + **TypeScript**
- **Tailwind CSS** + **DaisyUI** — UI（night 主题）
- **React Router v6** — 路由
- **Recharts** — K线/财务图表
- **Axios** — HTTP 请求
- **SSE** — 实时进度推送

## 开发

```bash
npm install
npm run dev        # http://localhost:3010
```

## 生产构建

```bash
npm run build
```

## Docker

```bash
docker build -t stock-dashboard-ui .
```

## 后端依赖

需要 `stock_dashboard` FastAPI 服务运行在 `localhost:8010`。
