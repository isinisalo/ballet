---
id: goal-022
title: Ihmisen ohjaama Validation-led Environment orchestration
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags:
  - tavoite
  - environment
  - validation
  - human-approval
---

# Ihmisen ohjaama Validation-led Environment orchestration

## Tavoite

Ballet muuttaa ihmisen hyväksymät Use Caset, Goals/ADRs/Constraints-päätöskontekstin ja versionhallittavan Environment → State → Action -rakenteen deterministiseksi toteutukseksi. Validation Agent omistaa jokaisen Actionin precheckin, Work-delegoinnin, postwork-arvion ja näkyvän blocked-palautteen. Critic ja Refinement voivat ehdottaa muutoksia, mutta vain ihminen voi hyväksyä niiden vaikutukset.

## Käyttäjäarvo

- Ihminen päättää WHAT/WHY:n Goals/ADRs/Constraints- ja approved Use Case -ketjussa ennen suorittamista.
- Operaattori näkee Statejen exact orderin, Actionien exact priorityn, johdetut `done`/`blocked`-tilat ja sen, miksi seuraava State ei vielä etene.
- Validation voi tunnistaa valmiin työn ennen Workia, rajata dynaamisen Work-promptin ja estää laaduttoman tuloksen deterministic retry/block-portilla.
- Exhausted retry tuottaa atomisesti näkyvän Feedback-entryn eikä häviä provider-proosaan.
- Critic- ja Refinement-ehdotukset säilyvät immutableina, read-only-artefakteina ennen erillistä ihmisapprovalia.
- Hyväksytty refinement tuottaa todennettavan managed-worktree-commitin ja uuden immutable continuation-runin muuttamatta alkuperäistä Runia.

## Rajaus

Tavoite kattaa approved Use Caset, project-local päätöskontekstin, unique ordered States/Actions, Validation-first-loopin, runtime-statukset, Feedback Boxin, Critic-schedulen ja approvalin, exact diff/hash -Refinementin, shared Skill -impactin, immutable continuationin, Product Snapshotin, API/UI-approval-rajat ja strict no-legacy-cutoverin.

Standalone State/Action Run, autonominen ihmisapproval, runtime DB migration, compatibility reader, route alias, dual-write, providerin valitsema seuraava State/Action sekä automaattinen merge/push/release/deploy eivät kuulu tavoitteeseen.

## Mitattavat success criteria

1. Jokaisella Environmentin Statella on unique positiivinen integer `order` ja jokaisella Staten Actionilla unique positiivinen integer `priority`; dispatch-järjestys vastaa nousevaa järjestystä 100 %:ssa property-fixtureistä.
2. Seuraavan Staten ensimmäisiä execution taskeja on 0 ennen kuin edellisen Staten kaikki Actionit ovat runtime-statuksessa `done`.
3. `done` ja `blocked` tallennetaan configiin 0 kertaa; ne johdetaan runtime-statuksesta kaikissa API/UI-projektioissa.
4. Validation precheck tuottaa vain `done | delegate | blocked`; postwork vain `done | retry | blocked`; Work ei voi hyväksyä itseään, valita retryä tai reitittää seuraavaa Actionia.
5. Work-yritysten enimmäismäärä on täsmälleen `1 + maxRetries`; esimerkiksi 0→1, 2→3 ja 5→6 yritystä. Ylimääräisiä dispatcheja on 0.
6. Retry exhaustion committoi yhdessä SQLite-transaktiossa Action-statuksen `blocked` ja täsmälleen yhden Feedback-entryn; restart tai duplicate outcome ei lisää toista entryä.
7. Critic-proposal tuottaa ennen ihmisapprovalia Feedback-entryjä 0 ja repository-kirjoituksia 0; hyväksyntä lisää täsmälleen yhden lähteistetyn Feedback-entryn.
8. Refinement proposal tekee repository-kirjoituksia 0 ja nimeää 100 % muutetuista allowlist-poluista exact preimage SHA-256:lla sekä yhden exact diff SHA-256:n.
9. Stale preimage, muuttunut base commit, puuttuva shared Skill -impact tai väärä human approval revision tuottaa 0 tiedostomuutosta ja 0 continuation-runia.
10. Hyväksytty validi refinement tuottaa yhden managed-worktree-commitin ja yhden continuation-runin, jonka Snapshot v13 viittaa parent Runiin, proposaliin, approvaliin ja commit SHA:han; alkuperäinen snapshot muuttuu 0 tavua.
11. Product Snapshotin jokainen status, hash, approval, Feedback- ja evidence-viite voidaan johtaa canonical project/runtime-totuudesta; provider-proosasta keksittyjä kenttiä on 0.
12. Lopullisissa active source/config/API/UI/release-pinnoissa on 0 Reward-MDP-, Graph/GraphNode/ActionNode-, policy-, acceptance-ledger-, Graph Node Module- tai vNext-prefix-osumaa manifestin gateillä.
13. Target-UI:ssa page-level horizontal overflow, clipped core action ja pelkkään väriin nojaava status ovat 0 sekä 1440×900- että 390×844-viewporteissa; keyboard-polku kattaa kaikki hyväksyntäkomennot.

## Supersession

Phase 09 strict cutover on toteutettu. `goal-021` ja muut korvatun orchestration/UI-domainin Goalit ovat `superseded`; checkout-localisuus, provider-neutraalius, immutable evidence, worktree-eristys, design-tokenit ja external-write-ihmisraja säilyvät aktiivisina.

## Ihmispäätös

Projektin omistajan 2026-08-29 antama prompt-kokonaisuus hyväksyi WHAT/WHY:n, success criteria -suunnan, strict version cutin, 13 Use Casen semanttisen scope-rajan sekä `adr-034`:n päätösaiheen. Se valtuutti paikallisen toteutuksen ja verification-commitit, mutta ei mergeä, pushia, release-julkaisua tai deployta.
