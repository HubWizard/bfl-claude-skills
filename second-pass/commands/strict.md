---
description: Set Second Pass to strict mode — passing grade A, iteration cap 5, confirm revisions on. For high-stakes artifacts (client proposals, public-facing copy).
---

# Set Second Pass to strict mode

The user wants high-stakes grading. Apply the strict preset: `passing_grade: A`, `iteration_cap: 5`, `confirm_revisions: true`.

Perform these steps:

1. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

2. **Write the strict config** to `~/.claude/second-pass/config.json` as valid JSON (pretty-printed, 2-space indent):
   ```json
   {
     "passing_grade": "A",
     "iteration_cap": 5,
     "confirm_revisions": true
   }
   ```

3. **Confirm to the user** in a single line:
   ```
   Second Pass set to strict mode (bar A, cap 5, confirm revisions). High-stakes artifacts will iterate aggressively.
   ```

Do not ask the user questions. Do not list the rubric. Do not explain what Second Pass is. This is a preset — be terse and done.
