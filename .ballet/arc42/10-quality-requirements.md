---
id: arc42-section-10
title: Laatuvaatimukset
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-29'
version: 27
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
| QS-033 | goal-023 / REQ-023 | ihminen authoroi projektidokumenttia tai Environmentia | desktop/narrow, keyboard ja dirty draft | Markdown workbench and Loop Engineering | canonical Markdown säilyy ja valittu entity/route palautuu | round-trip/unknown-frontmatter/dirty-guard/routing/a11y/browser testit; 0 page overflowta | 1 | EVID-033 | pending |
| QS-034 | goal-023 / REQ-023 | daemon paritetaan, claimataan tai restartataan | online/offline/replay/stale lease | paired daemon control plane | vain aito online-laite saa fenced taskin ja terminal outcome/finalization tapahtuu kerran | pairing/auth/HTTPS-loopback/heartbeat/lease/fencing/replay/restart negative tests | 1 | EVID-034 | pending |
| QS-035 | goal-023 / REQ-023 | Environment Run preflightaa Agentit | mixed device, dirty checkout, missing auth/model/policy | Agent binding and CLI adapters | kaikki Agentit resolveoituvat yhdelle exact-ready Computerille tai dispatch on 0 | binding schema, same-device matrix sekä Codex/Copilot capability/dispatch tests | 1 | EVID-035 | pending |
| QS-036 | goal-023 / REQ-023 | ihminen antaa Feedbackin ja aloittaa Refinementin | valid/invalid body sekä allowed/forbidden path | Feedback and Refinement v2 | vain category+comment hyväksytään ja proposal pysyy resource-allowlistissa | strict HTTP, provenance, path/symlink/preimage/hash/approval tests; forbidden write 0 | 1 | EVID-036 | pending |
| QS-037 | goal-023 / REQ-023 | strict v21/v17 cut rakennetaan | fresh local state and packaged startup | whole product | vain target versions/routes/entities jäävät ja Run Evidence finalisoituu | removal, full tests/lint/build/docs/design, release smoke, make latest, startup and clean tree | 1 | EVID-037 | pending |
<!-- quality-scenarios:end -->

Compile yksin ei täytä mitään skenaariota. Verdict edellyttää scenario-kohtaista test/evidence-ketjua ja rajoitteiden raportointia.
