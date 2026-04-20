# Supabase Knowledge Vector Import

This project already has a pgvector schema in:

- `/Users/liheng/Desktop/cosmic-daily-app/backend/schema_casting.sql`

The importer below loads the curated QiMen and BaZi knowledge bases into:

- `sources`
- `documents`
- `document_versions`
- `document_chunks`

with `embedding vector(1536)` stored in `document_chunks.embedding`.

## 1. Prerequisites

You need:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DASHSCOPE_API_KEY`

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` as a backward-compatible fallback
- `OPENAI_API_KEY` if you later switch to `--embed-provider openai`

The target Supabase database must already have the pgvector tables from:

- `/Users/liheng/Desktop/cosmic-daily-app/backend/schema_casting.sql`

If you only want the minimum tables required for knowledge-vector import, use:

- `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/sql/knowledge_vector_minimal.sql`
- `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/sql/knowledge_vector_match_function.sql`

## 2. Local env file

Create a private local file from the template:

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
cp .env.knowledge-import.example .env.knowledge-import
```

Then fill in:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DASHSCOPE_API_KEY`

The importer will auto-load `/Users/liheng/Desktop/cosmic-daily-app/.env.knowledge-import`.

If you prefer shell exports instead, that still works.

## 3. Dry run

Check how many rows will be generated before writing anything:

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
python3 scripts/upload_knowledge_vectors_to_supabase.py --scope all --dry-run
```

You can limit it to one knowledge family:

```bash
python3 scripts/upload_knowledge_vectors_to_supabase.py --scope qimen --dry-run
python3 scripts/upload_knowledge_vectors_to_supabase.py --scope bazi --dry-run
```

## 4. Upload

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SECRET_KEY="YOUR_SUPABASE_SECRET_KEY"
export DASHSCOPE_API_KEY="YOUR_DASHSCOPE_API_KEY"

python3 scripts/upload_knowledge_vectors_to_supabase.py --scope all
```

By default the importer uses:

- provider: `qwen`
- model: `text-embedding-v4`

If you want OpenAI later:

```bash
python3 scripts/upload_knowledge_vectors_to_supabase.py \
  --scope all \
  --embed-provider openai \
  --embed-model text-embedding-3-small
```

The script is idempotent:

- source ids are deterministic
- document ids are deterministic
- version ids are deterministic
- chunk ids are deterministic

So rerunning it will upsert instead of duplicating rows.

## 5. What the importer reads

### QiMen

- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-case-cards.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-rule-cards.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-reasoning-patterns.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-term-notes.json`
- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/qimen/qimen-conflict-resolution-cards.json`

### BaZi

- `/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/teacher-rule-library.json`

## 6. Chunking defaults

Current defaults:

- chunk size: `1200` characters
- overlap: `150` characters
- embedding provider: `qwen`
- embedding model: `text-embedding-v4`

You can override them:

```bash
python3 scripts/upload_knowledge_vectors_to_supabase.py \
  --scope qimen \
  --chunk-size 1000 \
  --chunk-overlap 120
```

## 7. Retrieval validation

After import, run the match RPC SQL in Supabase:

- `/Users/liheng/Desktop/cosmic-daily-app/backend/supabase/sql/knowledge_vector_match_function.sql`

Then validate semantic search locally:

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
python3 scripts/query_knowledge_vectors.py \
  "Should I invest more in my stock account right now?" \
  --scope qimen \
  --question-type money_wealth \
  --collection cards \
  --top-k 5
```

This embeds the query with Qwen, calls `match_document_chunks`, and prints the top matches.

## 8. Completeness audit

To verify that Supabase contains the full deterministic dataset expected from the local knowledge base:

```bash
cd /Users/liheng/Desktop/cosmic-daily-app
python3 scripts/audit_knowledge_vectors_in_supabase.py --scope all
```

This compares expected deterministic IDs against the remote rows in:

- `sources`
- `documents`
- `document_versions`
- `document_chunks`
