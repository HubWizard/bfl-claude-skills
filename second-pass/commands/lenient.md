---
description: Set Second Pass to lenient mode — passing grade C, iteration cap 2, confirm revisions off. For quick drafts where speed beats polish.
---

# Set Second Pass to lenient mode

The user wants light grading for quick drafts. Apply the lenient preset: `passing_grade: C`, `iteration_cap: 2`, `confirm_revisions: false`.

Perform these steps:

1. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

2. **Write the lenient config** to `~/.claude/second-pass/config.json` as valid JSON (pretty-printed, 2-space indent):
   ```json
   {
     "passing_grade": "C",
     "iteration_cap": 2,
     "confirm_revisions": false
   }
   ```

3. **Confirm to the user** in a single line:
   ```
   Second Pass set to lenient mode (bar C, cap 2, no re-judge). Drafts ship fast.
   ```

Do not ask the user questions. Do not list the rubric. Do not explain what Second Pass is. This is a preset — be terse and done.
