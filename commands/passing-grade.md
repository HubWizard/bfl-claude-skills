---
description: Set the Second Pass passing grade. Any output graded below this bar triggers a revision loop. Accepts A, B, C, D, or F.
argument-hint: <A|B|C|D|F>
---

# Set Second Pass passing grade

The user wants to set the Second Pass skill's passing grade to: **$ARGUMENTS**

Perform these steps:

1. **Validate the argument.** It must be exactly one of `A`, `B`, `C`, `D`, `F` (case-insensitive). If it is anything else — empty, multiple letters, a word, a number — respond with:
   ```
   Invalid grade. Usage: /second-pass:passing-grade <A|B|C|D|F>
   ```
   and stop.

2. **Normalize to uppercase.**

3. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

4. **Read existing config** at `~/.claude/second-pass/config.json` if it exists. If it does not exist, start from defaults:
   ```json
   {"passing_grade": "B", "iteration_cap": 3}
   ```

5. **Update the `passing_grade` field** to the normalized letter. Preserve all other fields (e.g., `iteration_cap`) unchanged.

6. **Write the updated config back** to `~/.claude/second-pass/config.json` as valid JSON (pretty-printed, 2-space indent).

7. **Confirm to the user** in a single line:
   ```
   Second Pass passing grade set to <X>. Outputs graded below <X> will trigger revision.
   ```

Do not ask the user questions. Do not list the rubric. Do not explain what Second Pass is. This is a config change — be terse and done.
