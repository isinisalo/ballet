---
id: arc42-section-10
title: Laatuvaatimukset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 26
tags: [arc42, quality, scenarios]
arc42Section: 10
---

# 10. Laatuvaatimukset

<!-- quality-scenarios:start -->
| ID | Source | Stimulus | Environment | Affected artifact | Expected response | Measurable response criterion | Priority | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QS-028 | goal-022 / REQ-022 | Environment Run käynnistetään validilla hyväksytyllä closurella | fresh SQLite v16 | ordering and Validation runtime | vain pienin eligible order/priority etenee ja jokainen Work käy Validationin kautta | exhaustive order fixtures, maxRetries 0/2/5, restart ja invalid-output testit ilman ennenaikaista dispatchia | 1 | EVID-028 | passed locally; real-provider occurrence is future evidence |
| QS-029 | goal-022 / REQ-022 | Action blokkaantuu tai Critic proposal päätetään | restart- ja replay-tilanteet | Feedback, schedule and approval stores | blocked+Feedback on atominen ja proposal muuttuu Feedbackiksi vain trusted human approvalilla | fault/replay/revision/DST/lease-testit tuottavat nolla duplikaattia tai pre-approval Feedbackiä | 1 | EVID-029 | passed locally |
| QS-030 | goal-022 / REQ-022 | Ihminen hyväksyy exact Refinement proposalin | muuttumaton tai stale Git base | refinement apply and continuation | sallitut muutokset tuottavat yhden worktree-commitin ja continuation-runin; stale input kirjoittaa nolla tiedostoa | path/symlink/preimage/hash/impact/race-testit ja parent snapshotin byte equality | 1 | EVID-030 | passed locally; real-provider continuation is future evidence |
| QS-031 | goal-022 / REQ-022 | Operaattori käyttää authoring-, run- ja review-workspaceja | 1440x900 ja 390x844, keyboard ja reduced motion | canonical UI | factual status, exact approval evidence ja kaikki ydintoiminnot ovat saavutettavia ilman page overflowta | component plus browser QA, zero console errors, keyboard deep-link/back-forward evidence | 1 | EVID-031 | passed canonical |
| QS-032 | goal-022 / REQ-022 | strict cutover buildataan ja käynnistetään | clean checkout and fresh machine state | whole product | vain target-versiot, canonical routet ja target domain jäävät aktiivisiksi | removal gate, full test/lint/build/docs/design, release smoke, make latest, startup and clean tree | 1 | EVID-032 | passed locally |
<!-- quality-scenarios:end -->

Compile yksin ei täytä mitään skenaariota. Verdict edellyttää scenario-kohtaista test/evidence-ketjua ja rajoitteiden raportointia.
