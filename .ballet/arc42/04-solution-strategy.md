---
id: arc42-section-04
title: Ratkaisustrategia
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-23'
version: 15
tags:
  - arc42
  - solution-strategy
arc42Section: 4
---

# 4. Ratkaisustrategia

## Tarkoitus

Tämä osio kokoaa aktiiviset perustavat ratkaisut, joilla Ballet vastaa hyväksyttyihin tavoitteisiin ja laatuvaatimuksiin. Aiemmat Loop/Workflow-, scoped orchestrator-, SSP- ja Repair-strategiat säilyvät niiden Goal-, ADR- ja initiative-tiedostoissa historiallisena audit trailina; niitä ei toisteta aktiivisena vaihtoehtoisena arkkitehtuurina.

## Aktiiviset strategiat

| ID | Strategia | Goal / REQ | QS | Päätös | Todennettava seuraus |
| --- | --- | --- | --- | --- | --- |
| STRAT-001 | Yksi checkout-local Node/TypeScript-palvelu, React UI ja shared strict contracts. | goal-001 / REQ-001 | QS-001 | adr-001, adr-003 | Palvelu ei tarvitse tiliä tai remote control planea; UI ja backend jakavat validoidut sopimukset. |
| STRAT-002 | Versionhallittu project truth erotetaan `.git/ballet` runtime-statesta. | goal-002, goal-006 / REQ-002, REQ-006 | QS-002, QS-012 | adr-002, adr-007 | Repository omistaa intentin; SQLite omistaa vain machine-local runtime-faktat. |
| STRAT-003 | Root Run käyttää immutable snapshotia ja erillistä Git-branch/worktree-paria. | goal-005 / REQ-005 | QS-004 | adr-006 | Active checkout ei muutu Node-suorituksessa eikä tulosta integroida automaattisesti. |
| STRAT-004 | Provider-neutral suoritus koostetaan eksplisiittisestä ExecutionProfilesta, instructionista, skilleistä, Task Envelope v9:stä ja role schema v9:stä. | goal-003 / REQ-003 | QS-011 | adr-005, adr-012, adr-013 | Sama snapshot tuottaa saman composition-hashin; provider-, model- tai resource-fallbackia ei ole. |
| STRAT-005 | GraphNode suorittaa ordered Action Nodet; Action Node omistaa Work→Validationin ja bounded `retry | escalate` -polun. | goal-004, goal-020 / REQ-004, REQ-020 | QS-003, QS-026 | adr-020 säilyvin osin, adr-031 | Runtime control flow perustuu immutableen Action Node -sopimukseen, ei providerin reittitekstiin. |
| STRAT-006 | arc42, Goals, ADR:t, initiatives ja traceability ovat project-local pitkäikäinen arkkitehtuuritotuus. | goal-009 / REQ-009 | QS-005, QS-006, QS-008 | adr-011 | Runtime ei kopioi dokumentteja, lokeja tai diffejä Stateen. |
| STRAT-007 | WHAT/WHY, merkittävä ADR ja ulkoinen kirjoitus pysähtyvät eksplisiittiseen ihmisrajaan. | goal-005, goal-009 / REQ-005, REQ-009 | QS-004, QS-006, QS-007 | adr-011, adr-031 | Puuttuva lupa tuottaa `needs_input`-tilan tai poistaa actionin `A(s)`:stä; reward ei korvaa valtuutusta. |
| STRAT-008 | Graph Node Module v6 materialisoidaan inspect→plan→commit-polulla project-local primitiveiksi. | goal-010 / REQ-010 | QS-009 | adr-016 säilyvin osin, adr-031 | Paketti ei ole runtime-riippuvuus eikä omista peer-targetteja, Reward-MDP:tä, local policya tai Repairia. |
| STRAT-009 | Capability-first Graph/GraphNode-authoring ja protected Action flow näyttävät vain canonical project/runtime-totuuden. | goal-007, goal-018 / REQ-007, REQ-018 | QS-013, QS-024 | adr-025, adr-027, adr-029 säilyvin osin | UI ei luo rinnakkaista topologyä, runtime statea tai numeerista LLM-progressia. |
| STRAT-013 | Yksi Graph-tason Reward-MDP snapshottaa acceptance/authorizationin, käyttää outcome-haaraista potential rewardia, compileeraa deterministic absorbing policyn kerran ja suorittaa GraphNode-optionin ordered Action Nodet. | goal-020 / REQ-020 | QS-026 | adr-031 | Sama input tuottaa saman policy-hashin/Q/V/actionin; unauthorized dispatch = 0; duplicate acceptance reward = 0; runtime solver-kutsuja = 0 decision epochissa. |

## Reward-MDP:n ratkaisu

Graphin yksi `reward_mdp_v3` omistaa `(S,A,P,R,γ)`:n ja `γ=0.99`:

```text
R(s,a,outcome,s′) = completionBonus
                    - actionCost
                    - outcomePenalty
                    + γΦ(s′) - Φ(s)

Φ(s) = 100 × (verifiedProgress(s) - 1)
```

Acceptance-ledgerin stable ID:t ja painot sekä erillinen authorization snapshot jäädytetään ennen Runia. Vain Validationin evidenssi saa muuttaa obligation-statusta. Compiler canonicalisoi modelin, tarkistaa exact PPM -summat, ratkaisee discounted value iterationin deterministisellä iteration boundilla ja stable tie-breakillä sekä hylkää nonterminal recurrent classin. Runtime tekee vain state projectionin, hard `A(s)` -leikkauksen ja compiled policy -lookupin.

## Keskeiset trade-offit

| Valinta | Saatu hyöty | Hyväksytty kustannus tai raja |
| --- | --- | --- |
| Checkout-local monoliitti | Pieni operointipinta ja selkeä trust boundary. | Ei keskitettyä monen checkoutin hallintaa. |
| SQLite runtime-totuutena | Atominen persistence ja restart-recovery ilman infrastruktuuria. | Ei jaettua HA-kantaa; schema v14 on hard cut. |
| Sekventiaalinen Action Node -suoritus | Yksiselitteinen State-, acceptance-, retry- ja outcome-järjestys. | Yhden GraphNode-optionin sisällä ei maksimoida rinnakkaisuutta. |
| Immutable snapshot ja compiled policy | Run on auditointikelpoinen ja koneen nopeudesta riippumaton. | Käynnissä oleva Run ei omaksu model/config-muutosta. |
| Symmetric `default_prior` | Malli on heti ohjauskelpoinen ilman keksittyä historiaa. | Priori on tarkoituksella heikko eikä kalibroitu väite. |
| Hard authorization | Forbidden action ei voi tulla valituksi rewardin kautta. | Puuttuva valtuutus voi jättää nonterminal stateen tyhjän `A(s)`:n ja estää ajon. |
| Strict v18 hard cut | Yksi domain-, API-, persistence- ja UI-totuus ilman compatibility-matriisia. | Project data, moduulit ja pre-production SQLite on vaihdettava yhdessä. |

## Platformin ja projektin raja

Platform toteuttaa vain geneeriset Graph-, GraphNode-, ActionNode-, Work-, Validation-, Reward-MDP-, acceptance-, authorization-, snapshot-, provider-, persistence-, tracker- ja module-primitivet. DESIGN/PLAN/BUILD/DEPLOY/VERIFY-nimet, arc42-menetelmä, release-säännöt, outcome-katalogit, probabilityt ja reward-parametrit ovat project-local-dataa.

## Kanoniset lähteet

`goal-020` omistaa aktiivisen WHAT/WHY:n ja `adr-031` päätöksen. `DESIGN.md` omistaa visuaalisen järjestelmän, shared contractit suoritettavan sopimuksen ja osiot 5/6/8 rakenteen, runtime-skenaariot ja poikkileikkaavat invariantit.

## Evidenssi ja avoin raja

`TEST-026` / `EVID-026` / `GRM-evid-004` todentavat strict contractin, compilerin, absorptionin, authorizationin, acceptance-ledgerin, ordered executionin, persistence/UI:n ja final portit. Tuotantokaltainen pilotti pysyy avoimena; symmetric priorista ei johdeta kalibrointiväitettä.

## Seuraava katselmointiperuste

Uusi ADR vaaditaan, jos reward- tai authorization-semantikka, online learning, POMDP, local solver, automaattinen external write tai control owner muuttuu.
