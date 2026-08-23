---
id: ballet-architecture-entrypoint
title: Balletin arkkitehtuurin aloituspiste
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 23
tags:
  - architecture
  - arc42
  - entrypoint
---

# Balletin arkkitehtuuri

## Tarkoitus

Tämä on ihmisten ja AI-agenttien yhteinen aloituspiste Balletin versionhallittuun arkkitehtuuriin. Pitkäikäinen project truth on Goal/ADR/arc42/initiative-ketjussa; runtime truth on immutable Root Snapshotissa ja SQLite-faktoissa. Project-local-menetelmää ei päätellä platform-koodista eikä runtime-lokeja kopioida dokumentaatioksi.

## Aktiivinen nykytila

- `goal-020` ja `adr-031` omistavat Graph Engineerin yhden Graph-tason discounted Reward-MDP:n `(S,A,P,R,γ)`, `γ=0.99`.
- GraphNode on MDP:n ajallisesti laajennettu action-optio. GraphNodella ei ole local solveria, orchestratoria tai Repair Nodea; sen aggregate Action Nodet suoritetaan array-järjestyksessä.
- Validation päivittää evidenssipohjaista immutable-ID/paino acceptance-ledgeriä ja palauttaa semantic outcome-ID:n. Bounded FAIL on `retry | escalate`.
- Reward on `completionBonus − actionCost − outcomePenalty + γΦ(s′) − Φ(s)`. Kaikki rewardit ovat integer-mikroyksikköjä ja probabilityt integer-ppm:iä.
- Transitionit mallintavat `P(outcome,s′|s,a)`:n. Authoroimattoman tiedon läpinäkyvä prior on exact-ppm symmetric Dirichlet(1), provenance `default_prior`; runtime ei opi siitä online.
- Policy compileutuu kerran immutable Root Snapshotiin deterministic iteration boundilla, stable tie-breakillä ja absorption-checkillä. Runtime projisoi Staten, muodostaa hard `A(s)`:n ja tekee policy-lookupin.
- Authorization tulee erillisestä immutable snapshotista. Unauthorized action ei kuulu `A(s)`:ään eikä project State voi antaa sille lupaa.
- Aktiivinen strict cut on Project Config v18, Decision Model v3, Graph Node Module v6, Root Snapshot v11, Task Envelope/Outcome v9, composition v10, ExecutionSpec v11, policy observation v4 ja SQLite v14. Legacy-readeria, migraatiota, aliasia tai dual-writeä ei ole.
- Repositoryn project-local default sisältää DESIGN/PLAN/BUILD/DEPLOY/VERIFY-GraphNodet, 17 ordered Action Nodea ja DONE-terminalin. Platform tuntee vain geneeriset primitivit.
- UI säilyttää capability-first Graph/GraphNode-kortit ja ADR-025/027:n protected Action Node industrial flow'n. ADR-032:n Graph Decision Model näyttää projected state-, acceptance-, option-, transition-impact-, prior- ja Q/V-evidenssin visuaalisena dashboardina ihmisyksiköissä; exact micros/ppm säilyvät accessible detailissä ja sopimuksissa. Local Decision Model/Repair UI:ta ei ole.
- Release, deploy, rollback, merge, push ja muu ulkoinen kirjoitus vaativat täsmällisen ihmisvaltuutuksen.

## Supersession

`goal-020` supersedoi goalit 016, 017 ja 019. `adr-031` supersedoi ADR:t 026, 028 ja 030 kokonaan, ADR-023:n scoped routing/orchestrator/Repair-osat sekä ADR-029:n local-policy/Repair-osat. `adr-032` supersedoi ADR-029:n Graph Decision Model -osion form/matrix/table-projektion muuttamatta capability-first-kortteja tai ADR-031:n runtime-semanttiikkaa. Vanhat tiedostot säilyvät historiallisena audit trailina, eivät aktiivisena nykytilana. ADR-025/027:n Action Node -flow ja ADR-029:n muut capability-first-osat säilyvät.

## Kanoniset lähteet

- [arc42-indeksi](.ballet/arc42/README.md)
- [status ja handoff](.ballet/arc42/STATUS.md)
- [traceability](.ballet/arc42/TRACEABILITY.md)
- [method health](.ballet/arc42/METHOD-HEALTH.md)
- [State-sopimus](.ballet/arc42/STATE-CONTRACT.md)
- [Goal-yhteenveto](.ballet/goals/summary.md)
- [ADR-indeksi](.ballet/arc42/09-architecture-decisions.md)
- [UI-designjärjestelmä](DESIGN.md)
- [Reward-MDP initiative](.ballet/arc42/initiatives/graph-reward-mdp/BRIEF.md)

## Omistajuus

1. Goalit omistavat WHAT/WHY:n.
2. ADR:t omistavat riskialttiit ja vaikeasti peruttavat päätökset sekä supersessionin.
3. arc42-osiot 1–12 omistavat pitkäikäiset näkymät, konseptit, laadun ja riskit.
4. Initiative BRIEF/PLAN/EVIDENCE/REVIEW omistaa rajatun muutoksen sopimuksen ja todellisen näytön.
5. `DESIGN.md` omistaa visuaalisen järjestelmän; `.ballet/project.json` project-local automaatiodatan.
6. `.git/ballet` omistaa machine-local runtime-tilan, ei arkkitehtuuritekstiä.

## Evidenssi ja avoin riski

`npm run validate:arc42` tarkistaa dokumentti-, trace-, resource- ja strict-v18 Reward-MDP -sopimuksen. Testit, lint, build, module-smoket, platform boundary, `make latest` ja käynnistyssmoke muodostavat teknisen acceptance-portin. Tuotantokaltaista Reward-MDP Root Run -pilottia ei ole suoritettu; sitä ei saa päätellä hermetic testeistä.

## Seuraava katselmointiperuste

Katselmoi entrypoint, kun accepted Goal/ADR, strict version matrix, deployment boundary tai persistent handoff muuttuu.
