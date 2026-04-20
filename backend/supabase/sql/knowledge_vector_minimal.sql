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
