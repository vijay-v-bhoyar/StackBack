# Durable-handoff verification

Verified November 4, 2026 against a fresh isolated source copy using Node.js 26.4.0 and npm 11.17.0. Installation with scripts disabled, TypeScript checking, production build, 15 unit/domain tests (300 generated cases) and all 24 Chromium browser tests passed. The original 12 domain tests, 15 browser tests and seeds 11303/13003 were preserved unchanged.

## Authorship and actual use

Codex supplied the requirements and always-included project steering. Kiro IDE 1.4.86, Auto, used the built-in Spec workflow to read the scoped source and steering and write the design and tasks. The Default agent then wrote the four durability browser regressions and, after actual behavioral failures were reported, implemented `readStoredRun`, canonical import-size enforcement and transactional session-save protection in `src/domain.ts` and `src/storage.ts`.

Codex corrected three defects in the new tests: an initially below-limit compact fixture needed a legal 1,000-character note; the legacy record must be seeded once rather than on every navigation; and recovery must inspect the saved note rather than assume guide metadata is a heading. The initial test output was retained. All four corrected oracles failed against the unchanged earlier production build before Kiro implemented the fix. They pass against the integrated build. Kiro did not discover the original product defects and did not execute the commands.

Codex implemented the checkpoint UI and copy recovery, offline-cache verification/repair, linked-card overview and library-versus-session comparison, and repository-subpath support. Codex reviewed the integration, ran the checks and reconciled this task record. No Kiro hook, custom agent, MCP, power or standalone CLI use is claimed. Auto does not establish the underlying model identity or verified billing totals.

## What the checks establish

- A legal near-limit handoff remains resumable after an oversized note is rejected; the earlier saved note remains intact.
- Compact input whose canonical output exceeds 1 MiB is rejected before import.
- A legacy over-capacity stored run remains listed and recoverable by shortening its note.
- A stale tab cannot replace the newer saved record and can save a separate alternative without mutating the original.
- Additional browser tests verify real shell-cache repair/failure states, stack browsing without a recorded run, preserved snapshots alongside changed library content, and offline cold reload under `/StackBack/`.

Separate automated accessibility checks found no axe violations across ten views and no overflow/clipped controls in 30 viewport checks (1280, 640 and 320 CSS pixels). These are local synthetic checks. They do not establish human benefit, actual assistive-technology usability, narration quality, contest qualification or a submitted entry.
