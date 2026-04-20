# Oraya Admin Web

独立后台位置：

- `/Users/liheng/Desktop/cosmic-daily-app/admin-web`

本地启动：

```bash
bash /Users/liheng/Desktop/cosmic-daily-app/scripts/run_oraya_admin_local.sh
```

说明：

- 这个脚本默认使用稳定模式：
  - 清理旧 `.next` 产物
  - `next build`
  - `next start`
- 这样可以避开本地 `next dev` 热更新偶发的 chunk/runtime 缓存错误

需要的环境变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

本地开发默认会自动写入：

- `http://127.0.0.1:54321`
- 本地 publishable anon key

登录方式：

- Google 登录
- 登录后仍需 `admin_users` 表中存在当前 `user_id`
- 本地开发可直接使用 `Use local dev admin`

当前页面：

- `/dashboard`
- `/users`
- `/users/[userId]`
- `/readings`
- `/readings/[threadId]`
- `/charts`
- `/incidents`
- `/import-runs`

当前支持的运营动作：

- 查看 Dashboard 指标
- 搜索用户并进入用户详情
- 查看命盘审阅、首屏洞察原始结构、derived factors
- 查看问答线程与系统回答
- 标记 incident 为 `resolved / ignored / reopened`
- 给用户补发 coins
- 手动重触发 `first-impression`
- 查看课程导入进度与原始 state

依赖的 admin-only functions：

- `admin-dashboard`
- `admin-users-search`
- `admin-user-detail`
- `admin-readings-list`
- `admin-reading-detail`
- `admin-incidents`
- `admin-coins-adjust`
- `admin-first-impression-rerun`
- `admin-import-runs`
- `first-impression-debug`

部署说明：

- `/Users/liheng/Desktop/cosmic-daily-app/docs/ORAYA-ADMIN-DEPLOY.md`
