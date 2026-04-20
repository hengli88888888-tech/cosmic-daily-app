# Yang Dun QiMen Chart Plugin Spec

## Goal

Design a dedicated Yang Dun QiMen Dun Jia chart plugin that can later be implemented as a first-class engine beside the existing BaZi chart engine.

This plugin is for:

- internal chart generation
- hidden validation pages
- future reasoning pipelines

It is not a user-facing “show the mechanics” page.

## Scope

### In Scope For V1

- Yang Dun charts only
- event-time chart generation
- plate construction from question time and timezone
- chart metadata and structured output
- enough output to support later reasoning
- first runnable system profile: `ChaiBu`

### Out Of Scope For V1

- Yin Dun support
- multiple system variants in one engine at the same maturity level
- full interpretation generation
- user-facing visual board editor

Current implementation note:

- a first preview engine has been implemented in `qimen-preview`
- it targets `mQimen.app` behavior in `拆补` mode
- `china95.net/qimen_show.asp` is now treated as a secondary oracle for `拆补 / 排盘结构 / summary field` cross-checks
- an oracle-backed `置闰` preview is also available
- `master-reply-submit` can now trigger a live QiMen chart at question submit time
- `阴遁` remains explicitly unimplemented for now

Even though the first implementation is Yang Dun only, the plugin must still understand:

- the seasonal boundary that switches from Yang Dun to Yin Dun
- cross-boundary validation samples

That is required so the engine can cleanly reject out-of-scope Yin Dun calculations instead of silently building the wrong chart.

## Plugin Position In The System

The Yang Dun plugin should sit beside the existing shared chart infrastructure, not inside the knowledge-ingestion tool.

Target role:

- input: question submission datetime and device timezone
- output: structured QiMen chart JSON
- consumers:
  - hidden chart test page
  - future QiMen question-answer engine
  - multimodal course review tools

Keep calculation logic separate from interpretation logic.

## Required Inputs

- submitted-at datetime
- client timezone

Optional:

- request id
- client offset snapshot
- source label such as `manual_question_time` or `imported_case`

## Engine Modules

### 1. Time Normalizer

Responsibilities:

- normalize local civil time
- resolve timezone through IANA tzdb
- support DST handling through timezone rules
- return a stable UTC timestamp for plate construction
- treat the question submission time as the chart time

Outputs:

- local civil datetime
- UTC datetime
- timezone metadata
- DST applied or not
- casting time basis

### 2. Solar Context Engine

Responsibilities:

- determine current solar term
- determine seasonal context for Yang Dun construction
- expose year/month/day/hour stems and branches needed by the plate engine

This module should reuse stable calendrical infrastructure where possible, but must not mix interpretation into the output.

### 3. Yang Dun Plate Engine

Responsibilities:

- determine the Yang Dun bureau number
- determine the xun-shou and dun-jia context
- determine whether the timestamp is still inside the Yang Dun window
- place:
  - nine palaces
  - eight gates
  - nine stars
  - eight deities / spirits
  - heaven plate stems
  - earth plate stems
  - human layer fields when applicable
- calculate:
  - 值符
  - 值使
  - 旬首
  - 空亡
  - 马星

This is the core plugin.

### 4. Auxiliary Marker Engine

Responsibilities:

- add chart-level helper markers
- expose palace-level helper flags
- keep them structured and auditable

Examples:

- empty / void markers
- horse star
- chief deity placement
- chief gate placement
- middle-palace handling

### 5. Chart Serializer

Responsibilities:

- emit one stable JSON schema
- label engine version and rule profile
- expose enough detail for later reasoning and for hidden validation pages

## Output Shape

The plugin should output structured JSON with these top-level sections:

- `input`
- `timing`
- `calendar_context`
- `chart`
- `palaces`
- `markers`
- `engine_metadata`

Suggested content:

### `input`

- submission datetime
- timezone
- source: `question_submit_time`

### `timing`

- utc_datetime
- local_datetime
- dst_applied
- timezone_name
- casting_time_basis

### `calendar_context`

- solar_term
- year_ganzhi
- month_ganzhi
- day_ganzhi
- hour_ganzhi

### `chart`

- mode: `yang_dun`
- yin_yang: `阳遁`
- bureau_number
- xun_shou
- zhi_fu
- zhi_shi
- dun_profile
- solar_term

### `palaces`

Array of 9 palace objects. Each palace should expose:

- palace index
- lo-shu position
- earth_plate_stem
- heaven_plate_stem
- gate
- star
- deity
- original_gate_palace
- empty flag
- horse flag
- notes array

### `markers`

- kong_wang
- horse_star
- active_palace_hints
- middle_palace_policy

### `engine_metadata`

- engine: `qimen_yang_plugin`
- version
- rule_profile
- source
- fallback flag

## Rule Assets To Prepare

Store plugin rule assets separately from BaZi under a new structured folder.

Recommended files:

- `specs/qimen-engine/engine-profile.json`
- `specs/qimen-engine/yang-dun-rules.json`
- `specs/qimen-engine/palace-layout.json`
- `specs/qimen-engine/output-schema.example.json`
- `specs/qimen-engine/yang-dun-validation-cases.json`

The final implementation should read rule data from these files rather than burying mappings throughout code.

## Integration Targets

### Hidden Chart Test Page

Add a future hidden route similar to the BaZi chart test page:

- input event time and timezone
- render structured Yang Dun chart output
- show rule profile and engine version

### Future Reasoning

The plugin should later map into the shared inference framework:

- foundation: palaces, gates, stars, deities
- structure: dominant palace combination
- branching: empty / blocked / active / opposing
- landing: timing, movement, conflict, strategy

## Validation Strategy

Validation should be done in three phases.

### Phase 1: Plate Construction Validation

Compare against a dual-oracle set, not just one source.

Current oracle set:

- primary: `mQimen.app`
- secondary: `china95.net/qimen_show.asp`

For each sample, verify:

- bureau number
- xun shou
- zhi fu
- zhi shi
- palace placements
- gate placements
- star placements
- deity placements

For `拆补`, the goal is to match both oracle summaries where they overlap.

For `置闰`, current primary oracle remains `mQimen.app`; `china95` should only be used as a supplementary reference until the newer page flow is fully decoded or course material clearly confirms the rule boundary.

### Phase 2: Seasonal Boundary Validation

Verify that the engine:

- accepts winter-solstice to summer-solstice Yang Dun inputs
- rejects or explicitly flags summer-solstice and after as out-of-scope for the Yang-only plugin
- still preserves the correct solar-term context in metadata

### Phase 3: Marker Validation

Verify:

- kong wang
- horse star
- chief markers
- any helper flags

## Test Matrix

At minimum, build validation sets for:

- different hours within the same day
- solar term boundary days
- timezone-separated international inputs
- DST-on vs DST-off local timestamps
- same local clock time in different timezones

Do not start interpretation tests until plate construction is stable.

## Engineering Defaults

- V1 supports Yang Dun only.
- V1 must still expose when an input belongs to Yin Dun.
- V1 is calculation-only, not interpretation-first.
- Keep source and fallback metadata explicit.
- Keep all plate placements machine-readable.
- Do not expose raw chart mechanics in the user-facing app by default.
- QiMen charts are auto-cast from question submission time.
- Users do not manually enter location for QiMen v1.
- The production choice between `拆补` and `置闰` is not yet hard-coded from doctrine; it should be refined from upcoming course evidence, not only from oracle behavior.

## Rules Locked From The Current Design

- Time basis: question-submission-time chart
- Casting basis: device local civil time
- Classification:
  - winter solstice to before summer solstice: Yang Dun
  - summer solstice to before winter solstice: Yin Dun
- Four pillars come from the existing calendrical engine using the submission timestamp
- Yang Dun earth plate uses the fixed顺布六仪 / 逆布三奇 mapping defined in the rule assets
- Value-star lookup is keyed from the hour stem
- Value-gate lookup is keyed from the hour branch context
- Eight deities in Yang Dun follow forward palace order
- Output must include a palace-by-palace machine-readable board and a concise `值符值使` summary block
