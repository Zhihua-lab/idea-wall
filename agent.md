# Agent Guide

这份文档给后续进入本仓库的编码 Agent 使用。目标是快速理解项目边界、运行方式和改动原则，减少重复摸索。

## 项目概览

这是一个“灵感随手记 / Idea Wall”Web 应用。用户可以浏览公开灵感、按标签筛选、查看详情；登录后可以发布、编辑、删除自己的灵感，也可以点赞。当前主应用位于本仓库根目录。

核心技术栈：

- Vite + React + TypeScript
- React Router
- Supabase Auth / Database / Storage
- Vercel 风格的 `api/` serverless functions
- Stitch 导出的视觉素材与样式

## 目录结构

- `src/pages/`：路由页面。
- `src/components/`：可复用 UI 组件。
- `src/lib/`：Supabase、业务 API、格式化、UI 映射等工具函数。
- `src/auth/`：登录态上下文。
- `api/`：服务端 API，包括 Supabase 代理与 AI 评论接口。
- `docs/sql/`：数据库变更 SQL。
- `public/stitch/`：Stitch/Tailwind 相关静态样式。
- `supabase_comments_schema.sql`：评论相关数据库结构。

外层目录中还可能有 Stitch 原始导出、设计资料和早期 PRD，它们主要用于视觉与产品参考。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

改动完成后至少运行：

```bash
npm run build
```

如果涉及界面行为，启动本地开发服务器并在浏览器中验证关键路径。

## 环境变量

本地开发需要在 `.env` 中配置：

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
DEEPSEEK_API_KEY=
```

部署环境中，`/api/supabase-proxy` 优先读取服务端变量：

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

注意事项：

- 不要提交 `.env`、密钥或任何真实 token。
- `DEEPSEEK_API_KEY` 是服务端变量，不要加 `VITE_` 前缀。
- 生产构建默认通过 `/api/supabase-proxy` 访问 Supabase；本地 `npm run dev` 通常直连 Supabase。

## 路由

- `/`：灵感列表，支持 `?tag=` 筛选。
- `/settings`：设置页。
- `/profile/:userId`：用户主页。
- `/inspiration/:id`：灵感详情。
- `/inspiration/:id/edit`：编辑灵感。
- `/login`：登录 / 注册。
- `/new`：新建灵感。
- `/delete-confirm?id=`：删除确认。

## 数据与权限

主要表：

- `inspirations`：灵感正文、标题、心情、标签、点赞数、图片等。
- `likes`：用户点赞关系。
- `user_profiles`：用户昵称等公开资料。
- `comments` / AI 评论相关表：参考 `docs/sql/20260522_ai_comments.sql`。

数据库安全依赖 Supabase RLS。前端可以做体验层面的权限判断，但不要把它当作真正的安全边界。修改数据访问逻辑时，要确认：

- 未登录用户只能浏览公开内容。
- 登录用户只能新增、编辑、删除自己的内容。
- 点赞需要登录，并依赖唯一约束避免重复点赞。
- 作者昵称通常通过 `user_profiles` 查询后合并展示，不要假设一定能 join 到完整资料。

## 编码约定

- 保持 TypeScript 类型清晰，优先复用 `src/types/database.ts` 中的类型。
- 页面级逻辑放在 `src/pages/`，跨页面复用逻辑放在 `src/lib/` 或 `src/components/`。
- Supabase 访问优先通过已有 lib/API 封装，不要在页面里散落重复查询。
- 保持现有代码风格：单引号、无分号、函数式 React 组件。
- 新增数据库字段时，同步更新 SQL 文档、类型定义和相关读写逻辑。
- 不要把部署平台、Supabase、DeepSeek 的密钥写入源码。

## UI 与产品原则

这个产品的气质是轻量、手账、灵感墙。改 UI 时优先延续现有 Stitch 风格：

- 保留当前页面的 scrapbook / card 视觉语言。
- 优先复用 `public/stitch/stitch-custom.css` 和已有 class。
- 列表、详情、写作、登录等主流程要在移动端和桌面端都可用。
- 状态要完整：loading、empty、error、未登录、无权限、提交中。
- 不要为了小改动引入新的 UI 框架或大规模重构样式系统。

## API 注意事项

- `api/supabase-proxy.ts` 用于线上代理 Supabase REST/Auth/Storage 请求。
- `api/ai-comment.ts` 调用 DeepSeek 生成 AI 评论，必须只在服务端读取 `DEEPSEEK_API_KEY`。
- API 返回应保持前端易处理的 JSON 结构，并给出清晰错误信息。
- 修改 API 后同时检查本地开发与生产代理路径的行为差异。

## 验证清单

根据改动范围选择验证项：

- `npm run build`
- 首页列表加载、筛选、空状态
- 登录 / 注册 / 登出
- 新建灵感
- 编辑自己的灵感
- 删除自己的灵感
- 未登录点赞跳转登录
- 登录后点赞 / 取消点赞
- 详情页作者、标签、图片、评论展示
- 个人主页和设置页
- API 代理在部署环境是否返回预期数据

## 工作方式

开始改动前先读相关页面、lib 和 API 文件，不要只按文件名猜实现。仓库可能包含用户未提交的改动，处理时只改任务相关文件，不要回滚无关变化。

完成后在回复中说明：

- 改了哪些文件。
- 解决了什么问题。
- 跑过哪些验证。
- 还有哪些需要人工配置或线上检查的事项。
