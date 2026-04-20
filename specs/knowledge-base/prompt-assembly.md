# Prompt Assembly

## Purpose

This file explains how the internal knowledge base should be converted into AI input for daily guidance generation.

## Recommended Assembly Order

1. user profile
2. computed chart summary
3. matched inference-path scaffold
4. matched shared reasoning nodes
5. matched general rule snippets
6. matched teacher-specific rule snippets
7. category score hints
8. safety constraints
9. output schema

## Suggested Input Bundle

```json
{
  "user_profile": {
    "dob": "1994-08-12",
    "tob_optional": "09:30",
    "birthplace": "Toronto, Canada",
    "timezone": "America/Toronto",
    "intent": "career"
  },
  "chart_summary": {
    "day_master": "yi_wood",
    "strong_element": "fire",
    "weak_element": "earth",
    "five_elements": {
      "wood": 22,
      "fire": 31,
      "earth": 10,
      "metal": 15,
      "water": 22
    }
  },
  "inference_path": {
    "framework": "bazi",
    "main_structure": "host-guest body-use with fire-heavy output bias",
    "reasoning_order": [
      "set framework",
      "identify main structure",
      "check whether the structure is really formed",
      "separate mainline from interference",
      "apply topic landing"
    ],
    "branch_conditions": [
      "if body is damaged, reduce assertive advice",
      "if useful line is blocked, prioritize stabilizing actions"
    ]
  },
  "shared_reasoning_nodes": [
    "mainline_vs_interference",
    "structure_formed_vs_unformed",
    "ownership_and_access",
    "completion_and_efficiency",
    "root_and_source",
    "internal_vs_external_domain",
    "body_damage_vs_use_damage"
  ],
  "matched_rules": [
    {
      "id": "weak_earth",
      "interpretation": "Grounding and steadiness need extra support.",
      "advice_bias": {
        "do": ["simplify schedule", "leave buffers", "return to routine"],
        "avoid": ["overcommitting", "rushing transitions"]
      }
    }
  ],
  "matched_teacher_rules": [
    {
      "teacher": "文曾",
      "id": "wenzeng-rule-zhengju-fanju-001",
      "interpretation": "Check whether the chart expression is internally aligned before deriving outcome bias.",
      "product_safe_advice": [
        "Treat misalignment as friction, not guaranteed disaster."
      ]
    }
  ],
  "daily_scores": {
    "action": 68,
    "social": 63,
    "focus": 57,
    "stability": 48,
    "risk": 59
  },
  "policy": {
    "prohibited_claims": [
      "Predicting death, disaster, or unavoidable harm",
      "Guaranteeing wealth, marriage, pregnancy, or career outcomes"
    ],
    "required_style_constraints": [
      "Use probability language",
      "Recommend grounded actions"
    ]
  }
}
```

## Guidance For Prompt Authors

- Pass only matched rules, not the full knowledge base.
- Pass the matched inference path whenever available; do not let the model jump from a single signal directly to a conclusion.
- Pass shared reasoning nodes when the topic depends on ownership, completion, stage timing, or mainline-vs-interference distinction.
- Pass only the teacher-specific rules that actually matched the current chart or inference path.
- Keep the prompt factual and compact.
- Avoid exposing internal metaphysical jargon unless the product surface explicitly wants it.
- Use rule IDs in logs so outputs can be audited later.

## Engineering Note

The ideal long-term pipeline is:

1. chart calculation
2. rule matching
3. inference-path and shared-node matching
4. score derivation
5. prompt assembly
6. model generation
7. schema validation
