# Local Run / 联调说明

## 1) Supabase

```bash
cd backend/supabase
supabase start
supabase db reset
supabase functions serve --env-file ../../.env
```

> 先把 `.env.example` 复制为 `.env` 并填写真实 key。

## 2) Deploy functions (cloud)

```bash
supabase functions deploy first-impression
supabase functions deploy daily-guidance
supabase functions deploy master-reply-submit
supabase functions deploy master-reply-sla-check
supabase functions deploy revenuecat-webhook
supabase functions deploy master-reply-queue
supabase functions deploy master-reply-deliver
supabase functions deploy master-reply-assign
```

## 3) Flutter run

```bash
cd app
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=$SUPABASE_URL \
  --dart-define=SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

## 4) Test flow

1. 登录后进入 `/today`，应看到 `First Impression` 首页和 3 条洞察
2. 进入提问页，提交首个问题
3. DB `master_questions` 出现记录
4. 给当前后台账号加管理员权限：

```sql
insert into admin_users(user_id, role) values ('YOUR_USER_UUID', 'admin')
on conflict (user_id) do update set role='admin';
```

5. 使用独立后台调用分配/交付接口
6. 调用 `master-reply-sla-check` 可把超时单标记为 `sla_breached`

## 5) Suggested cron (every 5 min)

- Endpoint: `master-reply-sla-check`
- Purpose: SLA breach auto-mark + compensation tagging
