---
description: Set the Second Pass iteration cap — the max number of revision attempts before the skill delivers the best attempt and stops. Accepts a positive integer.
argument-hint: <positive integer>
---

# Set Second Pass iteration cap

The user wants to set the Second Pass iteration cap to: **$ARGUMENTS**

Perform these steps:

1. **Validate the argument.** It must be a positive integer (1 or greater). Reject: empty, non-numeric, zero, negative, decimal, multiple tokens. If invalid, respond with:
   ```
   Invalid cap. Usage: /second-pass:iteration-cap <positive integer>
   ```
   and stop.

2. **Warn on extreme values** (do not block, just warn in the confirmation message):
   - Cap of 1 means no iteration — one grading pass, ship whatever comes back.
   - Cap above 5 means heavy token cost per non-measurable output. Note this in the confirmation.

3. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

4. **Read existing config** at `~/.claude/second-pass/config.json` if it exists. If it does not exist, start from defaults:
   ```json
   {"passing_grade": "B", "iteration_cap": 3}
   ```

5. **Update the `iteration_cap` field** to the parsed integer. Preserve all other fields (e.g., `passing_grade`) unchanged.

6. **Write the updated config back** to `~/.claude/second-pass/config.json` as valid JSON (pretty-printed, 2-space indent).

7. **Confirm to the user** in a single line:
   ```
   Second Pass iteration cap set to <N>. After <N> attempts, the best graded output ships with the grade attached.
   ```
   
   If cap == 1, append: `Note: cap of 1 disables iteration — one grading pass, then ship.`
   If cap > 5, append: `Note: high cap may use significant tokens per non-measurable output.`

Do not ask the user questions. Do not list the rubric. Do not explain what Second Pass is. This is a config change — be terse and done.
