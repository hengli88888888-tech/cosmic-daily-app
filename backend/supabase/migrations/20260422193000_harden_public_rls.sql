-- Harden public schema RLS for production.
-- The mobile app talks to Edge Functions; direct table access from anon clients
-- should be limited to own-user reads only, or denied entirely.

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

-- Knowledge/vector tables are used from service-role Edge Functions and import
-- scripts only. RLS with no anon/authenticated policies prevents direct client
-- reads of proprietary knowledge chunks.
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

do $$
begin
  if to_regclass('public.users') is not null then
    drop policy if exists users_select_own on public.users;
    create policy users_select_own
      on public.users for select
      using (auth.uid() = id);
  end if;

  if to_regclass('public.profiles') is not null then
    drop policy if exists profiles_select_own on public.profiles;
    create policy profiles_select_own
      on public.profiles for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.bazi_charts') is not null then
    drop policy if exists bazi_charts_select_own on public.bazi_charts;
    create policy bazi_charts_select_own
      on public.bazi_charts for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.readings') is not null then
    drop policy if exists readings_select_own on public.readings;
    create policy readings_select_own
      on public.readings for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.member_daily_messages') is not null then
    drop policy if exists member_daily_messages_select_own on public.member_daily_messages;
    create policy member_daily_messages_select_own
      on public.member_daily_messages for select
      using (auth.uid() = user_id);

    drop policy if exists member_daily_messages_update_own on public.member_daily_messages;
    create policy member_daily_messages_update_own
      on public.member_daily_messages for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if to_regclass('public.subscriptions') is not null then
    drop policy if exists subscriptions_select_own on public.subscriptions;
    create policy subscriptions_select_own
      on public.subscriptions for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.coin_wallets') is not null then
    drop policy if exists coin_wallets_select_own on public.coin_wallets;
    create policy coin_wallets_select_own
      on public.coin_wallets for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.coin_ledger') is not null then
    drop policy if exists coin_ledger_select_own on public.coin_ledger;
    create policy coin_ledger_select_own
      on public.coin_ledger for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.share_events') is not null then
    drop policy if exists share_events_select_own on public.share_events;
    create policy share_events_select_own
      on public.share_events for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.master_questions') is not null then
    drop policy if exists master_questions_select_own on public.master_questions;
    create policy master_questions_select_own
      on public.master_questions for select
      using (auth.uid() = user_id);
  end if;

  if to_regclass('public.master_events') is not null then
    drop policy if exists master_events_select_own on public.master_events;
    create policy master_events_select_own
      on public.master_events for select
      using (
        exists (
          select 1
          from public.master_questions mq
          where mq.id = master_events.question_id
            and mq.user_id = auth.uid()
        )
      );
  end if;

  if to_regclass('public.admin_users') is not null then
    drop policy if exists admin_users_select_self on public.admin_users;
    create policy admin_users_select_self
      on public.admin_users for select
      using (auth.uid() = user_id);
  end if;
end
$$;
