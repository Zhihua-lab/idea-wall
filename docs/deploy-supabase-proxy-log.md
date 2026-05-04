# 部署与 Supabase 同源代理 — 变更日志

**日期：** 2026-05-04  
**背景：** 生产环境直连 `*.supabase.co` 在分流代理/VPN 下易出现 `ERR_CONNECTION_CLOSED`；Vercel Edge 仅用 `VITE_*` 变量时 `/api/supabase-proxy` 曾返回 500。

---

## 1. 同源 Edge 代理（核心）

**目标：** 浏览器只访问自有域名（如 `*.vercel.app`），由 Vercel 服务端再请求 Supabase。

| 文件 | 变更 |
|------|------|
| `api/supabase-proxy.ts` | **新增** Vercel Edge 函数：接收 `?p=`（编码后的 `/rest/v1/...` 或 `/auth/v1/...` + 查询串），校验路径前缀后转发到真实 Supabase，返回响应。仅允许 `/rest/v1/`、`/auth/v1/`，避免开放代理。 |
| `src/lib/supabaseClient.ts` | **生产构建**（`import.meta.env.PROD`）为 `createClient` 注入自定义 `fetch`，将发往 Supabase 项目域名的请求改写为同源 `/api/supabase-proxy?p=...`。本地 `npm run dev` 仍直连 Supabase。可通过 `VITE_USE_SUPABASE_EDGE_PROXY=0` 关闭（如本地 `vite preview` 无 Vercel API）。 |

---

## 2. 修复代理 500：服务端环境变量

**原因：** Edge 运行时对 `VITE_SUPABASE_*` 的注入与前端静态包不一致，易导致代理内读不到 URL/Key 而 500。

| 文件 | 变更 |
|------|------|
| `api/supabase-proxy.ts` | 优先读取 **`SUPABASE_URL`**、**`SUPABASE_ANON_KEY`**，缺失时再回退 `VITE_*`。转发请求头改为白名单（`authorization`、`apikey`、`accept`、`content-type`、`prefer`、`x-client-info` 等）。移除 `redirect: 'manual'`，增加 try/catch，失败时返回 JSON 便于排查。 |

**Vercel 控制台：** 需额外配置与 `VITE_*` 同值的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`，并勾选对应环境（Production / Preview）。

---

## 3. 文档与类型

| 文件 | 变更 |
|------|------|
| `.env.example` | 补充 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 及可选 `VITE_USE_SUPABASE_EDGE_PROXY` 说明。 |
| `README.md` | 说明生产走同源代理及 Vercel 需配置 `SUPABASE_*`。 |
| `src/vite-env.d.ts` | 为 `VITE_USE_SUPABASE_EDGE_PROXY` 增加 `ImportMetaEnv` 声明。 |

---

## 4. 一句话总结

生产环境下数据与鉴权请求经 **`/api/supabase-proxy`** 由 **Vercel Edge** 转发至 Supabase；Edge 使用 **`SUPABASE_URL` + `SUPABASE_ANON_KEY`** 保证运行时配置可靠，前端仍用 **`VITE_SUPABASE_*`** 参与构建与开发体验。
