-- Lock down direct client access to public tables.
-- Oraya mobile/admin clients use Edge Functions. Those functions use
-- service-role clients where needed and are responsible for auth checks.
-- With RLS enabled and no anon/authenticated policies, browser/mobile clients
-- cannot read or mutate these tables directly with the publishable key.

drop policy if exists users_select_own on public.users;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists bazi_charts_select_own on public.bazi_charts;
drop policy if exists readings_select_own on public.readings;
drop policy if exists member_daily_messages_select_own on public.member_daily_messages;
drop policy if exists member_daily_messages_update_own on public.member_daily_messages;
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists coin_wallets_select_own on public.coin_wallets;
drop policy if exists coin_ledger_select_own on public.coin_ledger;
drop policy if exists share_events_select_own on public.share_events;
drop policy if exists master_questions_select_own on public.master_questions;
drop policy if exists master_events_select_own on public.master_events;
drop policy if exists admin_users_select_self on public.admin_users;

alter table if exists public.users enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.bazi_charts enable row level security;
alter table if exists public.readings enable row level security;
alter table if exists public.member_daily_messages enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.coin_wallets enable row level security;
alter table if exists public.coin_ledger enable row level security;
alter table if exists public.share_events enable row level security;
alter table if exists public.master_questions enable row level security;
alter table if exists public.master_events enable row level security;
alter table if exists public.internal_incidents enable row level security;
alter table if exists public.admin_users enable row level security;
alter table if exists public.qimen_outcome_feedback enable row level security;
alter table if exists public.qimen_teacher_question_type_scores enable row level security;
alter table if exists public.location_resolution_cache enable row level security;

alter table if exists public.sources enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.document_versions enable row level security;
alter table if exists public.document_chunks enable row level security;
alter table if exists public.citations enable row level security;
alter table if exists public.tags enable row level security;
alter table if exists public.document_tags enable row level security;
alter table if exists public.defect_taxonomy enable row level security;
alter table if exists public.diagnostic_question_sets enable row level security;
alter table if exists public.diagnostic_questions enable row level security;
alter table if exists public.diagnostic_rules enable row level security;
alter table if exists public.solution_actions enable row level security;
alter table if exists public.solution_evidence_links enable row level security;
alter table if exists public.case_sessions enable row level security;
alter table if exists public.case_answers enable row level security;
alter table if exists public.case_images enable row level security;
alter table if exists public.case_hypotheses enable row level security;
alter table if exists public.case_reports enable row level security;
alter table if exists public.ingestion_jobs enable row level security;
alter table if exists public.review_tasks enable row level security;
