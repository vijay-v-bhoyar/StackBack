---
inclusion: always
---
# StackBack development contract

Build a deterministic offline linked-card guide application. Keep schema version 1, existing limits, immutable run snapshots, complete correction history, original tests/seeds and no runtime AI/backend/accounts/dependencies.

Every persisted session must remain resumable. New session writes must satisfy the canonical portable-file limit before a transaction. Compare the complete expected saved session in the same IndexedDB transaction before replacing it; timestamps alone are not concurrency tokens. Preserve legacy locally stored over-capacity sessions for recovery, without accepting over-capacity imports or new writes. Unsaved/conflicting work must remain available without overwriting the newer checkpoint.

Use spec-driven changes and independent positive/negative browser regression oracles. Preserve failing examples. Write tests before implementation; Codex runs the commands and reports actual results. Do not claim tests passed unless execution evidence was provided.

This bounded IDE workflow uses built-in file tools only. Never invoke shell, terminal, runCommand, network, MCP, package installation, provider setup, security/permission changes or publication. Read only the task's explicit public-source allowlist. Do not inspect docs/, assets/, .devpost-hackathon-state.json, devpost-submission.md, credentials, browser/profile files or other projects. A missing permitted folder or inability to write is a reason to report the proposed content, not run a command.
