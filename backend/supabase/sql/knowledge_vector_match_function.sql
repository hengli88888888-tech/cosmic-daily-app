create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_scope text default null,
  filter_language_code text default null,
  filter_question_type text default null,
  filter_collection text default null,
  dedupe_by_title boolean default true
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  language_code text,
  content text,
  canonical_url text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  with ranked as (
    select
      dc.id as chunk_id,
      dc.document_id,
      d.title,
      dc.language_code,
      dc.content,
      d.canonical_url,
      dc.metadata,
      1 - (dc.embedding <=> query_embedding) as similarity,
      row_number() over (
        partition by case
          when dedupe_by_title then d.title
          else dc.id::text
        end
        order by dc.embedding <=> query_embedding
      ) as dedupe_rank
    from document_chunks dc
    join documents d on d.id = dc.document_id
    where dc.embedding is not null
      and (filter_scope is null or dc.metadata ->> 'scope' = filter_scope)
      and (filter_language_code is null or dc.language_code = filter_language_code)
      and (filter_question_type is null or dc.metadata ->> 'question_type' = filter_question_type)
      and (filter_collection is null or dc.metadata ->> 'collection' = filter_collection)
  )
  select
    chunk_id,
    document_id,
    title,
    language_code,
    content,
    canonical_url,
    metadata,
    similarity
  from ranked
  where dedupe_rank = 1
  order by similarity desc
  limit greatest(match_count, 1);
$$;
