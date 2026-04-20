create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  home_url text,
  country_code text,
  language_codes text[] not null default '{}',
  authority_level text not null check (authority_level in ('A', 'B', 'C', 'D')),
  license_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  doc_type text not null check (doc_type in ('paper', 'patent', 'standard', 'article', 'video', 'case')),
  title text not null,
  title_zh text,
  language_code text not null,
  publisher text,
  authors jsonb not null default '[]'::jsonb,
  abstract_text text,
  summary_zh text,
  canonical_url text not null,
  publish_date date,
  doi text,
  patent_number text,
  standard_code text,
  video_platform text,
  full_text_status text not null default 'metadata_only' check (full_text_status in ('metadata_only', 'summary_only', 'full_text')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  authority_level text not null check (authority_level in ('A', 'B', 'C', 'D')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_documents_canonical_url on documents(canonical_url);
create index if not exists idx_documents_type_status on documents(doc_type, review_status);
create index if not exists idx_documents_publish_date on documents(publish_date desc);

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_no integer not null,
  raw_content_uri text,
  extracted_text text,
  translated_text_zh text,
  extraction_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_id uuid references document_versions(id) on delete set null,
  chunk_index integer not null,
  section_title text,
  language_code text not null,
  content text not null,
  content_zh text,
  token_count integer,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists idx_document_chunks_document on document_chunks(document_id);

create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  citation_label text not null,
  citation_text text not null,
  evidence_summary_zh text,
  locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  tag_group text not null,
  tag_key text not null,
  label_zh text not null,
  label_en text,
  parent_tag_id uuid references tags(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tag_group, tag_key)
);

create table if not exists document_tags (
  document_id uuid not null references documents(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);

create table if not exists defect_taxonomy (
  id uuid primary key default gen_random_uuid(),
  defect_key text not null unique,
  name_zh text not null,
  name_en text,
  description_zh text,
  severity_default integer not null default 2 check (severity_default between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists diagnostic_question_sets (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid references defect_taxonomy(id) on delete cascade,
  material_tag_id uuid references tags(id) on delete set null,
  process_tag_id uuid references tags(id) on delete set null,
  name text not null,
  version_no integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  unique (defect_id, material_tag_id, process_tag_id, version_no)
);

create table if not exists diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references diagnostic_question_sets(id) on delete cascade,
  field_key text not null,
  prompt_zh text not null,
  input_type text not null check (input_type in ('single_select', 'multi_select', 'number', 'text', 'boolean', 'image')),
  options jsonb not null default '[]'::jsonb,
  unit text,
  is_required boolean not null default false,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (question_set_id, field_key)
);

create table if not exists diagnostic_rules (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid references defect_taxonomy(id) on delete cascade,
  rule_key text not null unique,
  version_no integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  condition_json jsonb not null,
  effect_json jsonb not null,
  explanation_zh text,
  created_at timestamptz not null default now()
);

create table if not exists solution_actions (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  title_zh text not null,
  description_zh text,
  cost_level integer check (cost_level between 1 and 5),
  risk_level integer check (risk_level between 1 and 5),
  expected_effect_level integer check (expected_effect_level between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists solution_evidence_links (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references solution_actions(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  rule_id uuid references diagnostic_rules(id) on delete cascade,
  support_strength numeric(3,2),
  note_zh text,
  created_at timestamptz not null default now(),
  check (document_id is not null or rule_id is not null)
);

create table if not exists case_sessions (
  id uuid primary key default gen_random_uuid(),
  external_user_id text,
  session_status text not null default 'intake' check (session_status in ('intake', 'follow_up', 'analysis', 'completed', 'closed')),
  source_channel text not null default 'wechat_miniprogram',
  initial_question text not null,
  latest_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists case_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references case_sessions(id) on delete cascade,
  field_key text not null,
  value_json jsonb not null,
  answer_source text not null default 'user' check (answer_source in ('user', 'model', 'image_extraction', 'reviewer')),
  created_at timestamptz not null default now()
);

create index if not exists idx_case_answers_session_field on case_answers(session_id, field_key);

create table if not exists case_images (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references case_sessions(id) on delete cascade,
  storage_uri text not null,
  image_type text,
  extraction_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists case_hypotheses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references case_sessions(id) on delete cascade,
  defect_id uuid references defect_taxonomy(id) on delete set null,
  cause_key text not null,
  confidence numeric(4,3) not null,
  supporting_facts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists case_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references case_sessions(id) on delete cascade,
  diagnosis_status text not null check (diagnosis_status in ('confirmed', 'probable', 'insufficient_data')),
  report_json jsonb not null,
  generated_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('fetch', 'ocr', 'asr', 'translate', 'chunk', 'embed', 'review')),
  target_type text not null,
  target_id uuid,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists review_tasks (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  review_type text not null check (review_type in ('authority', 'relevance', 'licensing', 'taxonomy', 'rule')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
