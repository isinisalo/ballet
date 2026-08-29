---
id: adr-034
title: Environment State Action käyttää Validation-led deterministic orchestrationia
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags:
  - arkkitehtuuripaatos
  - environment
  - validation
  - human-approval
  - strict-cut
---

# Environment State Action käyttää Validation-led deterministic orchestrationia

## Konteksti

Strict-v19 käyttää kahta node-ID Reward-MDP-scopea: Graph-policy valitsee GraphNoden, local policy ActionNoden ja acceptance-ledger portittaa progressin. Malli on deterministisesti compiled, mutta tuoteintention selittämiseksi käyttäjän täytyy authoroida policy-matriiseja, outcome-branchien probability/reward-arvoja ja erillinen ledger. Work suoritetaan ennen Validationia, vaikka Validationin pitäisi omistaa se, tarvitaanko työtä ja täyttääkö tulos tavoitteen. Critic-, refinement- ja humans approval -elinkaarta ei ole aktiivisessa domainissa.

## Päätösajurit

- `goal-022`, `REQ-022` ja `QS-028`–`QS-032`.
- Human-directed development ja approved Use Cases ennen executionia.
- Deterministinen, helposti inspectoitava järjestys ilman reward/policy-mallia.
- Laadun omistava Validation-first-looppi ja täsmällinen retry-semanttiikka.
- Näkyvä blocked Feedback, mutta agentin proposal ei saa muuttua hyväksytyksi palautteeksi tai repository-muutokseksi itsestään.
- Immutable snapshot-, approval-, diff-, commit- ja continuation-audit trail.
- Strict buildattava cut ilman migration/read/alias/dual-write-polkuja.

## Päätös

### Canonical project domain

Canonical domain on `Environment → State → Action`. Environmentin State `order` ja Staten Action `priority` ovat positiivisia, scopessaan uniikkeja kokonaislukuja. Runtime dispatchaa ne deterministic ascending orderissa. State B ei dispatchaa ennen kuin State A:n jokainen Action on `done`; yksikin `blocked` portittaa Environmentin.

Project config säilyttää intention ja authoring-statuksen, ei runtime completionia. Runtime-status on source of truth. Actionin `done` ja `blocked` sekä Staten/Environmentin aggregaatit ovat pure projectioneita status-enumista ja lapsifaktoista.

### Validation-first execution

Validation Agent on Actionin main/controller. Precheck tapahtuu ennen Workia ja palauttaa vain `done | delegate | blocked`. `delegate` sisältää snapshotattuun kontekstiin sidotun dynaamisen Work-promptin. Work on subordinate execution role eikä voi hyväksyä itseään, valita retryä/next-targetia, kirjoittaa Feedbackia tai muuttaa Actionin runtime-statusta suoraan. Postwork Validation palauttaa vain `done | retry | blocked`.

`maxRetries` tarkoittaa ensimmäisen Work-yrityksen jälkeisiä lisäyrityksiä. Kokonaismäärä on `1 + maxRetries`. Provider failure/cancel/interruption on operatiivinen tila eikä semantic retry; vain validoitu postwork `retry` kuluttaa semantic retry -budjettia. Exhaustion committoi atomisesti `blocked` Actionin ja yhden Feedback-entryn.

### Human approval ja Feedback

Use Case approval, Critic proposal approval/rejection ja Refinement proposal approval/rejection ovat erillisiä typed domain-kommandoja, joilla on expected revision/hash. Agentti ei voi suorittaa niitä.

Critic proposal ei ole Feedback ennen hyväksyntää. Hyväksyntä appendaa täsmälleen yhden immutable, proposal-provenienssiin sidotun Feedback-entryn. Runtime-block tuottaa Feedback-entryn atomisesti ilman erillistä approvalia, koska se on factual gate eikä agentin parannusehdotus.

### Refinement ja continuation

Refinement proposal on read-only. Se sisältää base commitin, allowlist-polut, exact preimage SHA-256:t, exact unified diffin ja diff SHA-256:n sekä shared Skill -impact closuren. Proposal ei kirjoita tiedostoja. Human approval jää erilliseksi immutable faktaksi. Vain hyväksytty, yhä hash-validi proposal voidaan soveltaa deterministic platform-palvelulla managed worktreehen.

Apply tuottaa yhden commitin ja uuden immutable continuation-runin. Continuation Snapshot v13 viittaa parent Runiin, proposaliin, approvaliin ja commit SHA:han; alkuperäistä snapshotia tai Run historya ei mutatoida.

### Snapshot, Product Snapshot ja root boundary

Root Snapshot v13 jäädyttää approved Use Caset, Goals/ADRs/Constraints-viitteet, Environment/State/Action-konfiguraation, execution permissionit/resurssit, parent/refinement lineage -viitteet ja target contract -versiot. Product Snapshot on commit/artifact/evidence-projektio, ei rinnakkainen mutable truth store.

Vain Environment Run ja immutable continuation-run kuuluvat root-domainiin. Standalone State tai Action Runia ei ole.

### Strict cut ja infrastruktuuri

Project Config v20, Root Snapshot v13, Task Envelope/outcome v10, composition v11, ExecutionSpec v12 ja SQLite v16 muodostavat yhden strict cutin. Feedback, Critic ja Refinement ovat v1. Reward-MDP, Graph/GraphNode/ActionNode, policy decision/observation, acceptance ledger ja Graph Node Module poistuvat lopputilasta. V19/v15-dataa ei migroida, lueta, aliasoida tai dual-writeta.

Provider adapters, ExecutionProfiles, managed worktrees, resource composition, queue/events, strict SQLite wrapper, HTTP security, SSE, tracker outbox ja design tokens adaptoidaan. Existing dark cyber-industrial palette, Inter/Geist, spacing, radii, dense workbench ja responsive/a11y-periaatteet säilyvät. MDP-matrix, freeform Graph topology ja protected ActionNode-policy-flow supersedoidaan target workspaces/Validation-led flow -projektiolla.

## Transition-poikkeus

Phases 02–08 saavat käyttää eristettyä vNext namespacea/hakemistoa, `/api/vnext`-API:a ja `/vnext`-UI-routeja. VNext ja v19 eivät saa lukea tai kirjoittaa toistensa dataa; dual-writeä ei ole eikä väliaikainen pinta ole compatibility layer. Phase 09 poistaa vanhan canonical-polun ja canonicalisoi vNextin atomisesti. Lopullisessa branchissa ei ole vNext-prefixiä eikä vanhaa aktiivipolkua.

## Seuraukset

- Control owner on yksiselitteinen Validation + deterministic runtime order, ei probabilistinen policy.
- Human approvalit ovat auditoitavia domain-faktoja ja voidaan testata väärällä revision/hashilla.
- Project config yksinkertaistuu, mutta uusi Feedback/Critic/Refinement-persistence ja schedule recovery kasvattavat runtime-scopea.
- Refinement ei voi muuttaa käynnissä olevaa Runia; jokainen sovellettu muutos alkaa uudesta snapshotista.
- Strict cut vaatii koordinoidun code/config/DB/API/UI/test/release/doc-poiston; vaiheiden buildattavuus perustuu vain eristettyyn määräaikaiseen namespaceen.

## Hylätyt vaihtoehdot

- **Reward-MDP Statejen valintaan:** hylätty, koska accepted Use Case ja deterministic order omistavat seuraavan työn; reward/policy lisäisi control ownerin ilman käyttäjäarvoa.
- **GraphNode → State -uudelleennimeäminen:** hylätty, koska se säilyttäisi local policyn, outcome-branchit, standalone rootin ja väärän Work-first-semanttiikan.
- **Mutable in-place Run refinement:** hylätty, koska snapshot, approval ja audit trail eivät olisi immutableja eikä replay selittäisi käytettyä configia.
- **Agentin automaattinen Critic/Refinement approval:** hylätty, koska ehdottaja ei saa laajentaa omaa toimivaltaansa tai tehdä repository-writeä.
- **Configiin tallennetut `done`/`blocked`-liput:** hylätty kahden truth-store-lähteen ja stale authoring -riskin vuoksi.
- **Standalone Action Run:** hylätty, koska se ohittaisi Staten sibling-gaten, approved Use Casen ja Environment-snapshotin.
- **DB-migraatio:** hylätty pre-production strict-cut-politiikan, radically changed identities -mallin ja testattavan fail-closed-rajan vuoksi.

## Supersession

Phase 09:n canonical cutissa ADR-034 supersedoi:

- ADR-023:n Graph/GraphNode/ActionNode-domainin ja Graph/GraphNode root-rajat;
- ADR-025/027:n Action Node policy-flow -topologian ja terminal-marker-control-semanttiikan, mutta ei tummaa industrial palettea, mint/amber/error-signaaleja, a11y:tä tai responsive stabilityä;
- ADR-029:n GraphNode/ActionNode capability CRUD -spesifit osat, mutta ei dense capability-first-card-kieltä;
- ADR-031/032/033:n Reward-MDP-, Q/V-, policy-, acceptance-ledger-, matrix- ja global/local-control-päätökset;
- ADR-016:n Graph Node Module package/catalog/materialisointipäätöksen aktiivisesta tuotteesta.

ADR-002/005/006/007/008/011/012/013:n project/runtime truth-, provider-, worktree-, SQLite-, security-, architecture method-, ExecutionProfile- ja skill/resource-periaatteet säilyvät. Vanhat ADR:t säilyvät audit trailina.

## Evidenssi ja review trigger

Trace on `goal-022` / `REQ-022`, `QS-028`–`QS-032`, `adr-034` / `CON-015`, `BB-015`, `RT-026`–`RT-028`, `DEP-005`, `TEST-028`–`TEST-032`, `EVID-028`–`EVID-032` ja initiative `environment-state-action-orchestration`.

Uusi ADR vaaditaan, jos agentti saa hyväksyä Critic/Refinement-proposalin, State/Action standalone Run lisätään, runtime order muuttuu epädeterministiseksi, refinement saa kirjoittaa ennen approvalia, original Run snapshot mutatoidaan tai strict no-migration/no-alias-rajaa lievennetään.
