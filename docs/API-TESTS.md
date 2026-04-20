# API 联调测试样例（HTTPie / cURL）

## 0) 环境变量
```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_ANON_KEY="YOUR_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export USER_JWT="USER_ACCESS_TOKEN"
```

---

## 1) first-impression
### cURL
```bash
curl -X POST "$SUPABASE_URL/functions/v1/first-impression" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT"
```

### HTTPie
```bash
http POST "$SUPABASE_URL/functions/v1/first-impression" \
  Authorization:"Bearer $USER_JWT"
```

---

## 2) daily-guidance
### cURL
```bash
curl -X POST "$SUPABASE_URL/functions/v1/daily-guidance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"date":"2026-02-27","timezone":"America/Toronto"}'
```

### HTTPie
```bash
http POST "$SUPABASE_URL/functions/v1/daily-guidance" \
  Authorization:"Bearer $USER_JWT" \
  date="2026-02-27" timezone="America/Toronto"
```

---

## 3) master-reply-submit
```bash
curl -X POST "$SUPABASE_URL/functions/v1/master-reply-submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"question_text":"Should I switch jobs next month?","category":"career","priority":"normal"}'
```

---

## 4) master-reply-queue（后台）
```bash
curl -X POST "$SUPABASE_URL/functions/v1/master-reply-queue" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

---

## 5) master-reply-assign（后台分配）
```bash
curl -X POST "$SUPABASE_URL/functions/v1/master-reply-assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"id":"QUESTION_UUID","assigned_master_id":"master_amy"}'
```

## 6) master-reply-deliver（后台交付）
```bash
curl -X POST "$SUPABASE_URL/functions/v1/master-reply-deliver" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"id":"QUESTION_UUID","answer_text":"Here is your personalized 24h guidance..."}'
```

---

## 7) revenuecat-webhook（模拟）
```bash
curl -X POST "$SUPABASE_URL/functions/v1/revenuecat-webhook" \
  -H "Content-Type: application/json" \
  -d '{"type":"RENEWAL","app_user_id":"USER_UUID","entitlement_ids":["pro"],"expiration_at_ms":1772236800000}'
```

---

## 8) sla-check（定时）
```bash
curl -X POST "$SUPABASE_URL/functions/v1/master-reply-sla-check" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
