---
id: adr-011
title: Canvas käyttää Approved/Rejected-transitioneita
status: proposed
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-18T21:21:24.000Z'
tags:
  - arkkitehtuuripäätös
  - canvas
  - transitionit
version: 1
---

# Canvas käyttää Approved/Rejected-transitioneita

## Konteksti

Käyttäjän pitää ymmärtää Loopin päätöspolut ennen Runia. Stepillä on kaksi domain-tulosta, mutta Runilla on useita operatiivisia tiloja. Canvas muuttuu epäselväksi, jos edgejen nimet tai kohteet johdetaan runtime-statuksista tai jos tekninen failure esitetään `Rejected`-päätöksenä.

ADR-004 määrittää jo kiinteät `approved`- ja `rejected`-Transitionit. Tämä ehdotus tekee niiden Canvas- ja editorisemantiikasta eksplisiittisen sekä sitoo sen ADR-010:n result/state-erotteluun.

## Päätös

Jos tämä ADR hyväksytään, jokainen suoritettava ja Human-Step näyttää Canvasilla kaksi nimettyä domain-Transitionia:

- `Approved` käyttää Stepin `approved`-kohdetta.
- `Rejected` käyttää Stepin `rejected`-kohdetta.

Node editorissa kummallakin Transitionilla on yksi target-select. Kohde voi olla mallin sallima paikallinen Step, terminaali tai sallittu toinen Loop. Canvasin edge-label on aina `Approved` tai `Rejected`; kohteen nimi ei korvaa tuloksen nimeä.

Runtime-status näytetään noden statusindikaattorina, Run-sheetissä ja tapahtumissa, ei uutena Transition-tyyppinä. Vain kanoninen `StepResult` aktivoi vastaavan edgen. Runtime failure, blocked, cancelled tai needs-input ei animoi kumpaakaan tulosedgeä eikä muodosta piilotettua Transitionia.

Human- ja agenttisuorituksen tulokset käyttävät samaa Transition-sopimusta. Oletuskohteet säilyvät `approved → completed` ja `rejected → blocked`, mutta käyttäjä voi valita muun sallitun kohteen.

## Seuraukset

- Loop on luettavissa ilman execution statusten tuntemusta.
- `Rejected` voi tarkoittaa tarkoituksellista rework-päätöstä eikä teknistä epäonnistumista.
- Canvas, Node editor, tallennettu Step ja tilakone käyttävät samoja result-ID:itä.
- Failure-terminaalin ja runtime failure -tilan esitystapa säilyy erillisenä tulosedgeistä.
- Testit voivat todentaa edge-labelin, targetin ja runtime-aktivoinnin toisistaan riippumatta.
- Tämä ehdotus täsmentää ADR-004:ää; se ei muuta hyväksytyn ADR:n tilaa ennen hyväksyntää.

## Toteutuksen lähteet

- `shared/domain/automation.ts`
- `backend/runtime/LoopRunEngine.ts`
- `frontend/src/workspace/automation/loops/LoopTransitionsEditor.tsx`
- `frontend/src/workspace/automation/loops/LoopCanvas.tsx`
- `frontend/src/workspace/automation/loops/loopEdgeStyle.ts`
- `.ballet/outputs/execution-composition/UI-DESIGN.md`
- `.ballet/outputs/execution-composition/TEST-PLAN.md`
