# Casting Defect Diagnostic Knowledge Base Architecture

## Goal

Build a Chinese-first intelligent knowledge base and diagnostic assistant for foundry engineers. The system should:

- diagnose casting defects through guided follow-up questions
- accept text, process parameters, and photos
- retrieve evidence from papers, patents, standards, authoritative articles, videos, and internal cases
- return ranked solutions with reasons and citations
- support WeChat Mini Program as the main user entry point

## Product Scope

### In Scope For MVP

- defect diagnosis for cast iron parts
- text plus image input
- guided follow-up questions
- evidence-backed answer generation
- citation rendering for papers, patents, standards, articles, and videos
- Chinese UI, multilingual source ingestion

### Out Of Scope For MVP

- full enterprise MES integration
- automatic parameter write-back into factory systems
- open-ended expert community features
- unsupported alloys and processes without curated rules

## System Architecture

```text
WeChat Mini Program
  -> API Gateway / BFF
    -> Session Service
    -> Diagnostic Orchestrator
      -> Follow-up Engine
      -> Retrieval Engine
      -> Reasoning Engine
      -> Ranking Engine
    -> Citation Service
    -> File Upload Service
    -> Admin Review Console

Data Layer
  -> Postgres
  -> pgvector
  -> Object Storage
  -> Job Queue

Offline Pipelines
  -> Source Ingestion
  -> OCR / ASR / Translation
  -> Chunking / Tagging / Embedding
  -> Authority Review
  -> Rule Pack Publishing
```

## Core Technical Principles

1. The model does not diagnose directly from memory. It must use structured defect rules and retrieved evidence.
2. Answers are never single-shot if key process information is missing. The system asks follow-up questions first.
3. Images are supportive evidence, not the only evidence.
4. Every important recommendation should map to at least one citation or one explicit internal rule.
5. Output must separate confirmed conclusions from hypotheses and missing information.

## Main Services

### 1. Session Service

Stores the full diagnostic case:

- user question
- uploaded images
- answered follow-up fields
- draft hypotheses
- final report

### 2. Follow-up Engine

Rule-driven question engine that asks only the most valuable next question.

Inputs:

- detected defect category candidates
- missing required fields
- user role and context
- image signals

Outputs:

- next question
- selectable options or numeric fields
- reason for asking
- blocking level

Example:

- If the user mentions "缩孔" and material is missing, ask for material family first.
- If the user uploaded a fracture image but no defect location, ask for exact location before offering a fix.

### 3. Retrieval Engine

Hybrid retrieval layer:

- keyword retrieval for exact terminology
- vector retrieval for semantically similar defect cases
- graph-like filtering by material, process, defect, and authority level

Search targets:

- papers
- patents
- standards
- authoritative articles
- expert videos
- internal reviewed cases
- defect rule packs

### 4. Reasoning Engine

Combines:

- structured rule evaluation
- multimodal extraction results
- retrieved evidence
- LLM summarization

Responsibilities:

- infer likely defect category
- infer likely causes
- request missing data when confidence is low
- map causes to actionable solutions

### 5. Ranking Engine

Orders actions by engineering priority rather than by text similarity.

Ranking factors:

- likelihood of root cause
- expected impact
- implementation cost
- production risk
- time to verify
- reversibility

### 6. Citation Service

Builds user-facing citation cards.

Citation card fields:

- source type
- title
- authors or organization
- year
- language
- evidence summary
- original link
- confidence that the source supports the recommendation

## Data Model

### Content Tables

- `sources`: source site or institution registry
- `documents`: top-level content record
- `document_versions`: raw snapshots for traceability
- `document_chunks`: searchable chunks
- `citations`: normalized citation records
- `tags`: controlled vocabulary
- `document_tags`: tag mapping
- `experts`: expert profiles
- `expert_documents`: relationship between experts and content

### Diagnostic Tables

- `defect_taxonomy`: canonical defect definitions
- `diagnostic_question_sets`: follow-up templates by defect and process
- `diagnostic_questions`: individual question definitions
- `diagnostic_rules`: machine-readable cause and recommendation rules
- `solution_actions`: normalized recommended actions
- `solution_evidence_links`: actions mapped to documents or rules
- `case_sessions`: user diagnostic sessions
- `case_answers`: collected field values
- `case_images`: uploaded images and extraction results
- `case_hypotheses`: ranked hypotheses
- `case_reports`: final generated reports

### Ingestion Tables

- `ingestion_jobs`: fetch, OCR, ASR, translate, embed, review jobs
- `review_tasks`: human review queue
- `authority_policies`: domain and source-level trust policy

## Recommended Entity Design

### Document

Must support all content types through one model.

Required fields:

- `doc_type`: paper, patent, standard, article, video, case
- `title`
- `source_id`
- `language`
- `publisher`
- `publish_date`
- `canonical_url`
- `abstract_text`
- `full_text_status`
- `authority_level`
- `review_status`

Optional domain fields:

- `doi`
- `patent_number`
- `standard_code`
- `video_platform`
- `speaker_names`

### Diagnostic Question

Required fields:

- `field_key`
- `prompt_zh`
- `input_type`
- `is_required`
- `applies_to_materials`
- `applies_to_processes`
- `applies_to_defects`
- `priority`

Example field keys:

- `material_family`
- `casting_process`
- `pouring_temperature_c`
- `carbon_equivalent`
- `inoculation_method`
- `defect_location`
- `defect_stage_detected`
- `has_fracture_image`

### Diagnostic Rule

Rule structure should be explicit, auditable, and versioned.

Example rule logic:

- if defect is `shrinkage`
- and material is `ductile_iron`
- and location is `thermal_hot_spot`
- and riser_feeding is `insufficient`
- then raise root cause score for `feeding_design_issue`
- then recommend actions `optimize_riser`, `add_chill`, `verify_modulus`

## Knowledge Organization

### Controlled Vocabulary

Use stable canonical keys in English for the system and Chinese labels for UI.

Core vocab groups:

- defect category
- alloy family
- molding process
- pouring system
- feeding system
- inoculation treatment
- melting and holding
- heat treatment
- inspection method
- defect location
- microstructure feature

### Authority Levels

- `A`: standards bodies, official patent systems, top journals, universities, national institutes, major industry associations
- `B`: reputable trade media, technical conference papers, expert talks with identifiable affiliations
- `C`: blogs or secondary summaries
- `D`: unverified reposts

MVP retrieval should prefer A and B only.

## Diagnostic Flow

### Step 1. Intake

The user submits:

- free-text defect description
- optional process parameters
- optional images

### Step 2. Initial Classification

The system detects:

- likely defect classes
- missing critical fields
- whether image analysis is useful

### Step 3. Follow-up Loop

The system asks the next best question until:

- minimum evidence threshold is met
- or the user declines further input

### Step 4. Retrieval

Retrieve:

- defect rules
- similar reviewed cases
- papers, patents, standards, articles, videos

Filters:

- material
- process
- defect
- authority level
- language

### Step 5. Reasoning And Ranking

Produce:

- top hypotheses
- ranked solutions
- reasons for ranking
- unresolved uncertainties

### Step 6. Report Generation

Structured report sections:

- problem summary
- collected evidence
- likely causes ranked
- recommended actions ranked
- why this order was chosen
- what to verify next
- citations

## Multimodal Strategy

### Image Inputs

Support:

- full part overview
- local defect close-up
- fracture surface
- macrostructure
- microstructure
- process card screenshot

### Image Processing

Pipeline:

1. classify image type
2. extract visible defect patterns
3. detect missing image angles
4. attach extracted features to the session

The model should output features like:

- cavity-like
- rounded pore-like
- crack-like
- slag-like irregular inclusion
- surface-only or internal indication

These are features, not final diagnoses.

## RAG Design

### Retrieval Layers

1. exact term retrieval
2. vector similarity retrieval
3. metadata filtering
4. reranking for diagnostic relevance

### Chunking Rules

- chunk by section or logical paragraph
- keep figure captions and table summaries if legally allowed
- preserve source coordinates for citation
- store translated summary separately from original text

### Answer Grounding

The final answer should consume:

- structured session facts
- top defect rules
- top retrieved evidence chunks
- top similar internal cases

The generation prompt should force:

- no unsupported claims
- explicit uncertainty
- citations for recommendations

## WeChat Mini Program API Surface

### User APIs

- `POST /api/cases`
  - create a diagnostic session
- `POST /api/cases/{id}/messages`
  - submit text or structured answers
- `POST /api/cases/{id}/images`
  - upload image metadata
- `GET /api/cases/{id}/next-question`
  - fetch next question
- `POST /api/cases/{id}/analyze`
  - trigger reasoning
- `GET /api/cases/{id}/report`
  - get final report
- `GET /api/search`
  - search documents and cases

### Admin APIs

- `POST /api/admin/ingestion-jobs`
- `POST /api/admin/documents/review`
- `POST /api/admin/rules/publish`
- `GET /api/admin/review-queue`

## Output Contract

The report schema should be stable and structured.

Core fields:

- `diagnosis_status`: confirmed, probable, insufficient_data
- `defect_candidates`
- `evidence_summary`
- `missing_information`
- `ranked_root_causes`
- `ranked_actions`
- `verification_steps`
- `citations`

Each ranked action should include:

- `action_key`
- `title_zh`
- `priority_rank`
- `reason`
- `expected_effect`
- `cost_level`
- `risk_level`
- `evidence_refs`

## Tech Stack Recommendation

### Frontend

WeChat Mini Program:

- Taro with React
- or native Mini Program if the team already has strong WeChat experience

Do not use Flutter as the main Mini Program delivery path for this product.

### Backend

- Supabase Postgres
- pgvector
- object storage
- edge functions or a separate API service for orchestration

### Pipeline

- Python for ingestion, OCR, ASR, translation, tagging, batch jobs
- queue worker for asynchronous tasks

### Models

- one LLM for dialogue, reasoning, and summarization
- one embedding model for retrieval
- one vision-capable model for image feature extraction

## Security And Compliance

1. Store source URLs and access timestamps for every external item.
2. Respect licensing for papers and videos. If full text cannot be stored, store metadata and summary only.
3. Mark machine translation and machine summary explicitly.
4. Retain raw evidence used in each report for auditability.
5. Keep enterprise private cases isolated from public knowledge.

## Delivery Plan

### Phase 1. Foundation

- define taxonomy
- build schema
- build ingestion pipeline for metadata and summaries
- publish first rule packs for 8 to 12 defects

### Phase 2. Guided Diagnosis MVP

- session API
- follow-up engine
- hybrid retrieval
- report generation
- WeChat Mini Program basic flow

### Phase 3. Multimodal Upgrade

- image feature extraction
- image-guided follow-up
- confidence calibration

### Phase 4. Enterprise Mode

- private case base
- team review workflow
- internal process standards

## Recommended First Build Order

1. finalize defect taxonomy and controlled vocabulary
2. implement core schema
3. ingest 50 to 100 authoritative documents with review
4. encode question sets for top 10 cast iron defects
5. implement session and report APIs
6. add citation-backed answer generation
7. add image analysis
