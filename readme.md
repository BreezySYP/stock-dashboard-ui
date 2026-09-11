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

登录与 API 密钥相关功能依赖 auth 服务（默认 `localhost:8016`，
本地开发通过 Vite / Nginx 的 `/api/auth` 代理访问）：

- `GET  /api/auth/login/github` — GitHub OAuth 登录（浏览器跳转）
- `POST /api/auth/token` — 用一次性 `code` 换取 token
  （带 client_id/client_secret 时则是服务间 token）
- `POST /api/auth/tokens` — 服务间用的 personal token 管理，前端不使用
- `GET  /api/auth/me` — 当前登录用户
- `GET  /api/auth/tokens` — 当前用户的 API 密钥列表
- `POST /api/auth/tokens` — 生成 API 密钥（明文仅返回一次）
- `DELETE /api/auth/tokens/{token_id}` — 撤销密钥

前端页面：`/settings/api-keys`（生成 / 管理 API 密钥）、
`/auth/callback`（GitHub 登录回调）。

### 登录凭证传递方式

token 等价于密码，**不出现在跳转 URL 上**。实际流程是「一次性 code 换 token」：

1. 前端跳 `GET /api/auth/login/github?next=/auth/callback`
2. GitHub 回调到 auth 服务，auth 服务处理后 302 到 `next`，
   地址栏带的是**短时效、一次性的 `code`**（不是 token）
3. 前端立刻 `POST /api/auth/token`，body `{"code": "<code>"}`，换取 token
4. 拿到 token 存进 Recoil（内存 + sessionStorage），并把 `code` 从地址栏抹掉

`/api/auth/tokens`（复数）是后端服务间创建 token 用的，前端不碰。

> 为什么不是 cookie：当前 auth 服务没有 cookie/session 接口
> （`POST /api/auth/session` 返回 404）。若以后改成回调时
> `Set-Cookie: access_token=...; HttpOnly`，可以再简化成 cookie 换取。
