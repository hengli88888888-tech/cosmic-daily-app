-- Oraya App (MVP) schema

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

update users
set email = null
where nullif(btrim(coalesce(email, '')), '') is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_email_not_blank'
  ) then
    alter table users
      add constraint users_email_not_blank
      check (email is null or btrim(email) <> '');
  end if;
end
$$;

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  dob date not null,
  tob time,
  gender text,
  age_band text,
  birthplace text not null,
  birthplace_latitude double precision,
  birthplace_longitude double precision,
  timezone text not null,
  intent text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists gender text;
alter table profiles add column if not exists age_band text;
alter table profiles add column if not exists birthplace_latitude double precision;
alter table profiles add column if not exists birthplace_longitude double precision;

create table if not exists bazi_charts (
  user_id uuid primary key references users(id) on delete cascade,
  dob date not null,
  tob time,
  gender text,
  age_band text,
  birthplace text not null,
  birthplace_latitude double precision,
  birthplace_longitude double precision,
  timezone text not null,
  chart_text text not null,
  pillars jsonb not null,
  analysis jsonb not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists location_resolution_cache (
  query_key text primary key,
  normalized_name text not null,
  country text,
  region text,
  latitude double precision not null,
  longitude double precision not null,
  timezone text not null,
  source_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date_local date not null,
  timezone text not null,
  scores jsonb not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, date_local)
);

create table if not exists member_daily_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  message_date date not null,
  timezone text not null,
  membership_tier text not null,
  variant text not null,
  title text not null,
  summary text not null,
  body jsonb not null default '{}'::jsonb,
  is_favorited boolean not null default false,
  is_read boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_date)
);

create index if not exists idx_member_daily_messages_user_visible
  on member_daily_messages(user_id, is_favorited, expires_at desc, message_date desc);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'revenuecat',
  plan_code text not null,
  status text not null,
  weekly_coin_allowance integer not null default 0,
  next_coin_grant_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_subscriptions_user_provider_plan
  on subscriptions(user_id, provider, plan_code);

create table if not exists coin_wallets (
  user_id uuid primary key references users(id) on delete cascade,
  balance integer not null default 0,
  granted_total integer not null default 0,
  purchased_total integer not null default 0,
  bonus_total integer not null default 0,
  spent_total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  source_type text not null,
  reason text not null,
  source_ref text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_ledger_user_created
  on coin_ledger(user_id, created_at desc);

create table if not exists share_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text,
  target_hint text,
  share_result text,
  rewarded boolean not null default false,
  reward_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_share_events_user_created
  on share_events(user_id, created_at desc);

create table if not exists master_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  parent_question_id uuid references master_questions(id) on delete set null,
  question_text text not null,
  category text,
  divination_system text not null default 'bazi',
  divination_profile text,
  question_kind text not null default 'deep',
  coin_cost integer not null default 0,
  priority text not null default 'normal',
  status text not null default 'submitted',
  price_paid numeric(10,2),
  currency text default 'USD',
  paid_at timestamptz,
  sla_deadline_at timestamptz,
  assigned_master_id text,
  answer_text text,
  delivered_at timestamptz,
  compensation_type text default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions add column if not exists weekly_coin_allowance integer not null default 0;
alter table subscriptions add column if not exists next_coin_grant_at timestamptz;
alter table master_questions add column if not exists parent_question_id uuid references master_questions(id) on delete set null;
alter table master_questions add column if not exists divination_system text not null default 'bazi';
alter table master_questions add column if not exists divination_profile text;
alter table master_questions add column if not exists question_kind text not null default 'deep';
alter table master_questions add column if not exists coin_cost integer not null default 0;

create or replace function grant_user_coins(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_source_type text,
  p_source_ref text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_bucket text default 'granted'
) returns jsonb
language plpgsql
security definer
as $$
declare
  existing_entry coin_ledger%rowtype;
  wallet_row coin_wallets%rowtype;
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  if p_idempotency_key is not null then
    select * into existing_entry
    from coin_ledger
    where idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'ok', true,
        'applied', false,
        'balance_after', existing_entry.balance_after,
        'ledger_id', existing_entry.id
      );
    end if;
  end if;

  insert into coin_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet_row
  from coin_wallets
  where user_id = p_user_id
  for update;

  new_balance := wallet_row.balance + p_amount;

  update coin_wallets
  set
    balance = new_balance,
    granted_total = granted_total + case when p_bucket = 'granted' then p_amount else 0 end,
    purchased_total = purchased_total + case when p_bucket = 'purchased' then p_amount else 0 end,
    bonus_total = bonus_total + case when p_bucket = 'bonus' then p_amount else 0 end,
    updated_at = now()
  where user_id = p_user_id;

  insert into coin_ledger (
    user_id,
    delta,
    balance_after,
    source_type,
    reason,
    source_ref,
    note,
    metadata,
    idempotency_key
  ) values (
    p_user_id,
    p_amount,
    new_balance,
    p_source_type,
    p_reason,
    p_source_ref,
    p_note,
    coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key
  ) returning * into existing_entry;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'balance_after', new_balance,
    'ledger_id', existing_entry.id
  );
end;
$$;

create or replace function spend_user_coins(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_source_type text,
  p_source_ref text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  existing_entry coin_ledger%rowtype;
  wallet_row coin_wallets%rowtype;
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'spend amount must be positive';
  end if;

  if p_idempotency_key is not null then
    select * into existing_entry
    from coin_ledger
    where idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'ok', true,
        'applied', false,
        'balance_after', existing_entry.balance_after,
        'ledger_id', existing_entry.id
      );
    end if;
  end if;

  insert into coin_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into wallet_row
  from coin_wallets
  where user_id = p_user_id
  for update;

  if wallet_row.balance < p_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'INSUFFICIENT_COINS',
      'balance_after', wallet_row.balance
    );
  end if;

  new_balance := wallet_row.balance - p_amount;

  update coin_wallets
  set
    balance = new_balance,
    spent_total = spent_total + p_amount,
    updated_at = now()
  where user_id = p_user_id;

  insert into coin_ledger (
    user_id,
    delta,
    balance_after,
    source_type,
    reason,
    source_ref,
    note,
    metadata,
    idempotency_key
  ) values (
    p_user_id,
    -p_amount,
    new_balance,
    p_source_type,
    p_reason,
    p_source_ref,
    p_note,
    coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key
  ) returning * into existing_entry;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'balance_after', new_balance,
    'ledger_id', existing_entry.id
  );
end;
$$;

create index if not exists idx_master_questions_status_deadline
  on master_questions(status, sla_deadline_at);

create table if not exists master_events (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references master_questions(id) on delete cascade,
  event_type text not null,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists internal_incidents (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  incident_type text not null,
  user_id uuid references users(id) on delete set null,
  severity text not null default 'warning',
  status text not null default 'open',
  message text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_internal_incidents_user_created
  on internal_incidents(user_id, created_at desc);

create table if not exists admin_users (
  user_id uuid primary key references users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists qimen_outcome_feedback (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references master_questions(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  divination_system text not null default 'qimen_yang',
  question_type text,
  system_profile text,
  teacher_conclusion text,
  user_feedback text,
  verdict text not null default 'pending',
  failed_step text,
  failed_support_id text,
  failure_summary text,
  failure_tags text[] not null default '{}'::text[],
  operator_notes text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qimen_outcome_feedback_verdict_check
    check (verdict in ('pending', 'matched', 'partially_matched', 'missed'))
);

create unique index if not exists idx_qimen_outcome_feedback_thread
  on qimen_outcome_feedback(thread_id);

create index if not exists idx_qimen_outcome_feedback_verdict
  on qimen_outcome_feedback(verdict, updated_at desc);

create index if not exists idx_qimen_outcome_feedback_question_type
  on qimen_outcome_feedback(question_type, updated_at desc);

create table if not exists qimen_teacher_question_type_scores (
  id uuid primary key default gen_random_uuid(),
  teacher_id text not null,
  question_type text not null,
  runs integer not null default 0,
  majority_match_count integer not null default 0,
  teacher_conclusion_match_count integer not null default 0,
  feedback_match_count integer not null default 0,
  partially_matched_count integer not null default 0,
  missed_count integer not null default 0,
  score numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qimen_teacher_question_type_scores_status_check
    check (status in ('active', 'downranked', 'muted')),
  constraint qimen_teacher_question_type_scores_unique
    unique (teacher_id, question_type)
);

create index if not exists idx_qimen_teacher_question_type_scores_question_type
  on qimen_teacher_question_type_scores(question_type, status, score desc);

alter table qimen_outcome_feedback add column if not exists failed_step text;
alter table qimen_outcome_feedback add column if not exists failed_support_id text;
alter table qimen_outcome_feedback add column if not exists failure_summary text;
alter table qimen_outcome_feedback add column if not exists question_type text;

alter table profiles alter column dob drop not null;
alter table profiles alter column birthplace drop not null;

alter table bazi_charts alter column dob drop not null;
alter table bazi_charts alter column birthplace drop not null;
alter table bazi_charts add column if not exists age_band text;
alter table bazi_charts alter column chart_text drop not null;
alter table bazi_charts alter column pillars drop not null;
alter table bazi_charts alter column analysis drop not null;

alter table users enable row level security;
alter table profiles enable row level security;
alter table bazi_charts enable row level security;
alter table readings enable row level security;
alter table member_daily_messages enable row level security;
alter table subscriptions enable row level security;
alter table coin_wallets enable row level security;
alter table coin_ledger enable row level security;
alter table share_events enable row level security;
alter table master_questions enable row level security;
alter table master_events enable row level security;
alter table internal_incidents enable row level security;
alter table admin_users enable row level security;
alter table qimen_outcome_feedback enable row level security;
alter table qimen_teacher_question_type_scores enable row level security;
alter table location_resolution_cache enable row level security;

drop policy if exists users_select_own on users;
create policy users_select_own
  on users for select
  using (auth.uid() = id);

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own
  on profiles for select
  using (auth.uid() = user_id);

drop policy if exists bazi_charts_select_own on bazi_charts;
create policy bazi_charts_select_own
  on bazi_charts for select
  using (auth.uid() = user_id);

drop policy if exists readings_select_own on readings;
create policy readings_select_own
  on readings for select
  using (auth.uid() = user_id);

drop policy if exists member_daily_messages_select_own on member_daily_messages;
create policy member_daily_messages_select_own
  on member_daily_messages for select
  using (auth.uid() = user_id);

drop policy if exists member_daily_messages_update_own on member_daily_messages;
create policy member_daily_messages_update_own
  on member_daily_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists subscriptions_select_own on subscriptions;
create policy subscriptions_select_own
  on subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists coin_wallets_select_own on coin_wallets;
create policy coin_wallets_select_own
  on coin_wallets for select
  using (auth.uid() = user_id);

drop policy if exists coin_ledger_select_own on coin_ledger;
create policy coin_ledger_select_own
  on coin_ledger for select
  using (auth.uid() = user_id);

drop policy if exists share_events_select_own on share_events;
create policy share_events_select_own
  on share_events for select
  using (auth.uid() = user_id);

drop policy if exists master_questions_select_own on master_questions;
create policy master_questions_select_own
  on master_questions for select
  using (auth.uid() = user_id);

drop policy if exists master_events_select_own on master_events;
create policy master_events_select_own
  on master_events for select
  using (
    exists (
      select 1
      from master_questions mq
      where mq.id = master_events.question_id
        and mq.user_id = auth.uid()
    )
  );
