Read the QiMen teaching segment JSON and fill editable draft fields for a human reviewer.

Output rules:

- Keep the language simple and review-friendly.
- Do not claim certainty if the board evidence is partial.
- `board_summary_draft` should describe what the teacher appears to be looking at on the board or slide.
- `reasoning_steps_draft` should be a short ordered list of how the teacher seems to move through the reading.
- `question_type_guess` should be a broad category such as career, relationship, health, timing, travel, property, study, legal, or business.
- `final_conclusion_draft` should summarize the likely conclusion the teacher is moving toward.
- `reusable_rule_hint` should only be filled if a clearly reusable reading rule is visible in the segment.
