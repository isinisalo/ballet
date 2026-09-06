---
name: test-evidence-verification
description: Turn requirements into executable checks and retain truthful, reviewable acceptance evidence.
category: verification
---

# Test and evidence verification

1. Link the requirement or User Story to a concrete invariant and the smallest suitable unit, integration, browser or smoke test.
2. Cover both successful behavior and the failure mode that would violate the contract.
3. Run the exact repository commands required by applicable `AGENTS.md`; never skip a failing check or relabel it as passed.
4. Record command, test file and exact test name plus relevant artifact or screenshot reference.
5. Distinguish deterministic local evidence from provider, platform, visual-human or external operational evidence.
6. Update accepted evidence only after the named command succeeds on the reviewed revision.
