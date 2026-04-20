# Metaphysics Inference Architecture

## Goal

Build one reusable inference engine that can support:

- BaZi
- Qi Men Dun Jia
- Mei Hua Yi Shu
- Feng Shui

The point is not to force these systems into the same symbols.
The point is to make them share the same reasoning skeleton.

## Core Idea

Do not store only conclusions.

Store:

- what the base concepts are
- what structure is present
- what the reasoning order is
- what conditions branch the path
- what topic the structure lands on
- how the result should be expressed safely

This is the difference between a quote collection and an inference engine.

## Shared Reasoning Layers

1. Input layer
2. Foundation layer
3. Structure recognition layer
4. Inference-order layer
5. Branching layer
6. Landing layer
7. Expression layer

These layers are defined in:

- [inference-framework.json](/Users/liheng/Desktop/cosmic-daily-app/specs/knowledge-base/inference-framework.json)

The framework now also carries reusable cross-system reasoning nodes such as:

- `mainline_vs_interference`
- `structure_formed_vs_unformed`
- `ownership_and_access`
- `completion_and_efficiency`
- `timing_scheduler`

These are meant to be reused across systems even when the symbols change.

## Why This Matters

If the team only stores isolated rules, the model will do shallow matching:

- see one symbol
- jump to one topic
- output a fragile conclusion

If the team stores inference order, the model can work more like a real practitioner:

- identify the frame
- identify the main structure
- separate mainline from interference
- apply branch conditions
- only then land on marriage, career, health, timing, etc.

## BaZi Example

The correct pattern is:

1. define the framework
2. identify body/use, host/guest, five-element tension
3. identify the main structure
4. check whether the structure is formed, broken, mixed, or reversed
5. identify the useful line and interference line
6. separate ownership from visibility, and completion from partial contact
7. land the structure on a topic
8. convert the result into safe guidance

This pattern should later be mirrored in other systems.

## Future Expansion

### Qi Men Dun Jia

- symbols differ
- reasoning skeleton stays the same

Likely mapping:

- input: event time and location
- foundation: palaces, gates, stars, deities
- structure: dominant palace combination
- branching: empty/dead/blocked vs active/open
- landing: timing, strategy, movement, conflict

### Mei Hua Yi Shu

- input: trigger and question
- foundation: trigrams and transformation rules
- structure: main and transformed hexagram
- branching: moving line and timing path
- landing: event tendency and sequence

### Feng Shui

- input: orientation, plan, environment
- foundation: form, qi, direction, occupants
- structure: support vs pressure pattern
- branching: occupant fit vs space conflict
- landing: health, relationship, work, stability

## Rule For Repetition

When a teacher repeats something many times, do not mark it as redundant by default.

Treat repeated content as one of:

- `foundational`
- `core_emphasis`

This is already being tracked in teacher rules with:

- `knowledge_priority`
- `repetition_signal`

## Engineering Direction

The long-term target should be:

1. source ingestion
2. rule extraction
3. inference-path extraction
4. shared-node matching
5. rule matching
6. path assembly
7. model generation
8. output validation

That is the correct path if the product is going to evolve from BaZi into a multi-system metaphysics engine.
