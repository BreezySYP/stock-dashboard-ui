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
npm run dev        # http://localhost:3011
```

> 端口固定为 3011（`strictPort`）：auth 服务 GitHub 登录成功后会把浏览器跳回
> `http://localhost:3011/auth/callback`，两边端口必须一致，否则回调请求会一直挂起。

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

## 页面与权限

整体是「左侧边栏 + 顶栏」外壳，未登录访问任何页面都会落到全屏登录页。

| 页面 | 路径 | 权限 |
| --- | --- | --- |
| 会话列表 | `/chat` | 登录用户 |
| 会话详情 | `/chat/:thread_id` | 登录用户 |
| 我的记忆 | `/memories` | 登录用户（管理员可查他人） |
| API 密钥 | `/settings/api-keys` | 登录用户 |
| 股票数据 | `/stocks`、`/stocks/:code` | 仅管理员 |
| Pipeline | `/pipeline` | 仅管理员 |
| 任务日志 | `/logs` | 仅管理员 |
| AI 评测 | `/chat/:thread_id/eval` | 仅管理员 |

权限判断来自 `/api/auth/me` 的 `is_admin` / `admin` / `role`；前端隐藏只是体验层，
真正的授权必须由后端执行。

### Agent 会话接口

| 接口 | 说明 |
| --- | --- |
| `POST /api/ai/threads` | 新建会话，`thread_id` 由服务端生成 |
| `GET /api/ai/threads?limit&offset&user_id` | 列出会话（按最近活跃排序，`user_id` 仅管理员可用） |
| `PATCH /api/ai/threads/{thread_id}` | 重命名（body `{title}`） |
| `DELETE /api/ai/threads/{thread_id}` | 删除会话 |
| `GET /api/ai/threads/{thread_id}/conversation` | 获取对话内容 |
| `POST /api/ai/qa?thread_id=...` | 触发回答（`thread_id` 同时在 query 和 body 里） |
| `GET /api/ai/qa/stream/{job_id}` | SSE 进度流 |

所有 `/api/ai/*` 接口都需要 `Authorization: Bearer`。聊天的实时进度用
fetch + ReadableStream 读取 SSE，才能带上鉴权头（`EventSource` 无法自定义请求头）。

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
