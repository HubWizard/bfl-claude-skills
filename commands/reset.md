---
description: Reset Second Pass settings to defaults — passing grade B, iteration cap 3, confirm revisions off. Overwrites any custom config.
---

# Reset Second Pass settings to defaults

The user wants to reset all Second Pass settings to defaults.

Perform these steps:

1. **Ensure the config directory exists**: `~/.claude/second-pass/`. Create it if missing.

2. **Overwrite `~/.claude/second-pass/config.json`** with the default config (pretty-printed, 2-space indent):
   ```json
   {
     "passing_grade": "B",
     "iteration_cap": 3,
     "confirm_revisions": false
   }
   ```
   
   Do not merge with existing config — this command is a full reset.

3. **Confirm to the user** in a single line:
   ```
   Second Pass settings reset. Bar: B. Cap: 3. Confirm revisions: off.
   ```

Do not ask for confirmation before overwriting. Do not explain what Second Pass is. Do not list alternative commands. This is a reset — be terse and done.
