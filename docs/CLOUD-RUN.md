# Cloud Run / 真实 Supabase 路径联调

这个路径的目标是：

- app 直接连 **真实托管的 Supabase 项目**
- 分析、生成、存档、反馈都走 **Supabase Cloud**
- 不依赖本地 `supabase start` 或 `functions serve`

## 1) 前提

当前云项目已确定为 production：

- Project ref: `lckhqitjvnszcojppnnh`
- Project URL: `https://lckhqitjvnszcojppnnh.supabase.co`

优先读取根目录 `.env.cloud`。如果不存在，才回退到 `.env`。

建议把真实云端配置放在 `.env.cloud`，避免覆盖本地联调用的 `.env`。

`.env.cloud` 至少需要：

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

要求：

- `SUPABASE_URL` 必须是托管项目地址
- 不能是 `127.0.0.1` 或 `localhost`

## 2) 先把函数部署到 Supabase Cloud

至少部署这几条：

```bash
cd backend/supabase
supabase functions deploy user-wallet
supabase functions deploy question-threads
supabase functions deploy member-qimen-feedback
supabase functions deploy master-reply-submit
supabase functions deploy save-profile-and-chart
supabase functions deploy first-impression
supabase functions deploy daily-guidance
```

如果最近改过后台函数逻辑，必须先重新 deploy，再跑 app。

## 3) 启动 app（真实链路）

不指定设备：

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
./scripts/run_oraya_cloud.sh
```

指定设备：

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
./scripts/run_oraya_cloud.sh "DEVICE_ID"
```

这个脚本会：

- 优先从根目录 `.env.cloud` 读取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
- 如果 `.env.cloud` 不存在，再回退读取 `.env`
- 把它们传给 Flutter `--dart-define`
- 强制 app 走真实 Supabase 路径

## 4) 怎么确认不是本地链路

满足这几条就说明你现在测的是“模拟上线”路径：

- 没有运行 `supabase start`
- 没有运行 `supabase functions serve`
- app 是通过 `./scripts/run_oraya_cloud.sh` 启动的
- `.env.cloud` 或 `.env` 里的 `SUPABASE_URL` 是 `https://...supabase.co`

## 5) 建议测试顺序

1. 新用户首问
2. 首问后追问
3. 存档页 thread 列表
4. feedback 提交
5. 出生信息补录
6. 后台查看 thread 与向量命中

## 6) 常见误区

- `flutter run` 但没传 `--dart-define`
  - app 可能仍然指向错误环境
- 本地函数改了，但没 deploy
  - app 连云端时不会读到本地改动
- `.env` 里还是本地地址
  - 这不算模拟上线
