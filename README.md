# 灵感随手记 — Web

Vite + React + TypeScript + React Router + **Supabase**。Stitch 的 Tailwind 主题在 `public/stitch/tailwind.config.js`，补充样式在 `public/stitch/stitch-custom.css`（按页面 `stitch-shell--*` 作用域划分）。

## 环境变量

复制 `.env.example` 为 `.env`，填入 Supabase 控制台的项目 URL 与 **anon** key（变量名需带 `VITE_` 前缀）：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `DEEPSEEK_API_KEY`（服务端专用，用于 `/api/ai-comment` 调用 DeepSeek，不要加 `VITE_` 前缀）

生产构建（如 Vercel）默认通过 **`/api/supabase-proxy`** 转发 REST/Auth/Storage 到 Supabase；`npm run dev` 仍直连 Supabase。服务端代理优先读取 **`SUPABASE_URL`**、**`SUPABASE_ANON_KEY`**（与 `VITE_SUPABASE_*` 同值），否则线上代理可能 500。仅在本地执行 `vite preview` 且需要直连时，可在 `.env` 中设置 `VITE_USE_SUPABASE_EDGE_PROXY=0`。

不要将 `.env` 提交到 Git（已在 `.gitignore` 中忽略）。

## 本地运行

```bash
cd web
npm install
npm run dev
```

## 路由

| 路径 | 说明 |
|------|------|
| `/` | 灵感列表（`?tag=标签` 筛选） |
| `/inspiration/:id` | 详情、点赞、作者编辑/删除入口 |
| `/inspiration/:id/edit` | 编辑（仅本人） |
| `/login` | 登录 / 注册，`?redirect=` 登录后回跳 |
| `/new` | 新建（需登录） |
| `/delete-confirm?id=` | 删除确认（需登录，且 RLS 仅允许删自己的行） |

## 数据库约定

需与你在 Supabase 中已创建的表、RLS、`likes` 触发器维护 `likes_count` 等一致。列表与详情通过 **`inspirations` + `user_profiles`** 两次查询合并昵称（无额外视图也可工作）。

## 构建

```bash
npm run build
```
