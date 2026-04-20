# Extraction Prompt Template

Use this template when converting transcript chunks into structured rule cards.

## Task

Read the transcript chunk and extract only reusable BaZi interpretation knowledge.

## Output Requirements

Return JSON only.

Return this shape:

```json
{
  "cards": [
    {
      "topic": "weak_earth",
      "topic_family": "element_balance",
      "claim": "Weak earth often reduces steadiness and carrying capacity.",
      "conditions": ["earth is weak in the chart"],
      "interpretation": "Grounding and stability need support.",
      "product_safe_advice": [
        "Simplify the day's commitments.",
        "Add buffer time around transitions."
      ],
      "do_not_say": [
        "Guaranteed bad outcome",
        "Absolute prediction"
      ],
      "confidence": "medium"
    }
  ]
}
```

## Rules

- Extract only ideas that are reusable across cases.
- Ignore long anecdotes unless they reveal a rule.
- Convert absolute claims into probabilistic interpretation.
- Keep user-facing advice practical and safe.
- If the speaker makes a deterministic or extreme claim, preserve the idea in softened form and add the original style to `do_not_say`.
- If a chunk contains no reusable rule, return `{"cards":[]}`.

## Input Chunk

Paste one chunk JSON `text` field here.
