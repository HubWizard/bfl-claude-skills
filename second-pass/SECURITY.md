# Security

Second Pass is a Claude Code skill. It does not handle credentials, network requests, or file mutations beyond reading skill descriptions and writing config to `~/.claude/second-pass/config.json`.

## Reporting a vulnerability

If you find a security issue (config injection, privilege issue, anything that exfiltrates data, anything that could be exploited via a crafted skill description that Claude reads), please report it privately rather than opening a public issue:

- Open a private security advisory via the GitHub Security tab on this repo, or
- Email the address listed in the LICENSE copyright holder's GitHub profile

Please include:
- A description of the issue
- Steps to reproduce
- A proof-of-concept if available
- Your assessment of impact

Expect an initial response within 7 days. Public disclosure will be coordinated after a fix is available.

## Scope

In scope:
- The skill content under `agents/`, `commands/`, `examples/`
- Config file handling at `~/.claude/second-pass/config.json`
- Skill description parsing (since the judge reads arbitrary `SKILL.md` content)

Out of scope:
- Issues in Claude Code itself — report to Anthropic
- Issues in skills graded by Second Pass — report to those skills' maintainers
- Issues caused by user-modified configs that bypass the slash command validators
