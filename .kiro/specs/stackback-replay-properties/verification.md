# Replay-property verification and authorship

Kiro IDE 1.4.86 (Auto, Default agent) authored requirements.md, design.md, the original tasks.md and the mixed-history test block in src/domain.test.ts. Codex authored this verification note, reviewed the output, updated task execution statuses and reference-model details, and ran the checks. Codex implemented the application separately. The requirements/design retain their generation-time history notes.

## Generator and invariant coverage

The initial generator produced an unreachable card. The minimized counterexample was [[1,2],[]], seed13003, shrink path0:0:1:1; the product validation guard correctly rejected it. Kiro corrected the generator after receiving that case. The corrected generator uses a single start card, layered fan-out and a mandatory choose/back/alternate-choice prefix. The independent reference model checks full event semantics, active path, immutable guide snapshots and portable round trips. The existing validation guard, tests and seed11303 were preserved. No application bug was identified by this Kiro test iteration.

## Reproduce

Follow the prerequisites in the root README, then run:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The current source was verified with12 domain tests, including100 generated forward-path cases and200 mixed-history cases, plus15 browser tests. Typecheck and production build passed. The replay-property contribution itself changed tests/specification only; subsequent application work is separate. Local synthetic checks do not establish universal correctness, hosted availability, screen-reader usability, human benefit or beta readiness.

No Kiro hook, custom agent, MCP, power or standalone CLI contribution is claimed. The underlying Auto model and billing cost were not independently measured.
