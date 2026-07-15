---
description: Toggle Second Pass re-judge after revision. true = verify lift in a loop (more tokens, more confidence). false = trust judge's feedback, ship after one revision (default, cheaper).
argument-hint: <true|false>
---

# Set Second Pass confirm-revisions flag

The user wants to set `confirm_revisions` to: **$ARGUMENTS**

Perform these steps:

1. **Validate the argument.** Must be `true` or `false` (case-insensitive). Reject anything else with:
   ```
   Invalid value. Usage: /second-pass:confirm-revisions <true|false>
   ```
   and stop.

2. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

3. **Read existing config** at `~/.claude/second-pass/config.json` if it exists. If it does not exist, start from defaults:
   ```json
   {"passing_grade": "B", "iteration_cap": 3, "confirm_revisions": false}
   ```

4. **Update `confirm_revisions`** to the parsed boolean. Preserve all other fields unchanged.

5. **Write the updated config back** to `~/.claude/second-pass/config.json` as valid JSON (pretty-printed, 2-space indent).

6. **Confirm to the user** in a single line:
   - If true: `Second Pass confirm-revisions set to true. Revisions are re-judged in a loop (more confidence, more tokens).`
   - If false: `Second Pass confirm-revisions set to false. Revisions ship after one pass (default, cheaper).`

Do not ask the user questions. Do not list the rubric. Do not explain what Second Pass is. This is a config change — be terse and done.
