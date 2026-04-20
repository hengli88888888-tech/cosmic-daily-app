# E2E 验收清单（Master Reply 24h）

## A. 用户侧
- [ ] 用户可登录并进入 Today 页
- [ ] 用户可提交 Ask Master 问题（category + question_text）
- [ ] 提交后返回 ticket id，提示 24h 内回复
- [ ] `master_questions` 写入成功（status=paid, sla_deadline_at 已生成）

## B. 后台侧
- [ ] 管理员账号已写入 `admin_users`
- [ ] `/admin/queue` 正常显示工单
- [ ] 筛选（status/category/due<2h）可用
- [ ] SLA 颜色条显示正确（绿/橙/红）
- [ ] Assign 成功后状态变为 `in_review`

## C. 交付闭环
- [ ] Reply 提交成功，状态变为 `delivered`
- [ ] `delivered_at` 已写入
- [ ] `master_events` 记录 `delivered` 事件

## D. SLA 保障
- [ ] 定时调用 `master-reply-sla-check`
- [ ] 超时工单被标记 `sla_breached`
- [ ] compensation_type 写入（partial_refund）

## E. 订阅联动
- [ ] RevenueCat webhook 打通
- [ ] `subscriptions` 表状态可更新（active/expired）

## F. UI/体验
- [ ] Admin Auto 60s 开关可用
- [ ] 关闭/重开页面后，Auto 60s 状态保持（本地记忆）
