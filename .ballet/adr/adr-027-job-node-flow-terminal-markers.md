---
id: adr-027
title: Job Node -flow käyttää ID-kortteja ja kiinteitä terminaalimerkkejä
status: accepted
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-23T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - job-node
  - canvas
  - authoring
version: 2
---

# Job Node -flow käyttää ID-kortteja ja kiinteitä terminaalimerkkejä

> **Supersession notice (2026-08-23):** `adr-031` säilyttää labelit ja terminaalimerkit Action Node -flow'ssa. Historiallinen `Job Node` -nimi ei ole strict-v18 schema/API/runtime-termi.

## Konteksti

ADR-025:n Job Node -industrial flow on teknisesti toimiva, mutta sen read-only Graph Node Orchestrator-, Next job-, Done- ja retry-määräprojektiot tekevät authoring-flowsta tarpeettoman leveän ja yksityiskohtaisen. Projektin omistaja pyysi näkymään Work- ja Validation-nodejen exact ID:t sekä liitteen mukaiset kysymys- ja terminaalimerkit.

## Päätös

Job Node -canvas projisoi seuraavan authoring-flow'n:

`Start → Work ID → Validation ID → Pass?`

`Pass?` ja `Retry?` ovat samalla vaakatasolla. `Pass?` jatkuu `Continue`-ympyrään tai `Retry?`-päätökseen. `Continue` ja `Escalate` ovat samalla vaakatasolla. `Retry?` palaa bounded retry -sopimuksen mukaisesti suoraan Workiin, kun retry on käytettävissä, ja päättyy `Escalate`-ympyrään, kun retryraja on saavutettu. Liitteen mukainen `Retry count` on katkoviivainen, ei-interaktiivinen visuaalinen ghost-merkki, joka leijuu Retry?-päätöksen vasemmalla puolella; se ei ole domain-solmu eikä sisällä runtime-tilaa.

- Start, Escalate ja Continue käyttävät olemassa olevaa full-radius-tokenia ja ovat kiinteitä, ei-klikattavia merkkejä.
- Work- ja Validation-korteissa näkyy vain exact node ID; Work/Validation-rooli säilyy vain saavutettavassa aria-nimessä ja kortit säilyvät ainoina interaktiivisina canvas-kohteina.
- Pass? ja Retry? eivät näytä tulos- tai retry-määrädetailia. Branch-labelit ovat `No` Result→Retry-polulla ja `Yes` Retry→Work-paluuviivalla. Retry-paluuviiva reititetään Retry?-nodesta suoraan Work-noden sisääntuloon eikä Retry count -ghostin kautta.
- Retry count -ghost näyttää Job Node settings -näkymän `maxRetries`-arvon muodossa `Retry count X`; arvo on authoring-konfiguraatiosta projisoitu eikä persisted runtime-statea.
- Normal flow ja aktiivinen `Yes` Retry?→Work-paluuviiva käyttävät mintunvihreää flow-tokenia; retry-paluuviiva säilyy katkoviivaisena erottaakseen paluun päävirrasta. `No`-reitti säilyy Error-värisenä.
- Graph Node Orchestrator- ja Next job -elementtejä ei renderöidä. Graph Node Orchestrator omistaa edelleen runtime-reitityksen ja candidate-päätökset Graph Node -asetuksissa.
- `maxRetries = 0` poistaa aktiivisen retry-paluuviivan mutta ei muuta domain- tai runtime-sopimusta.

Päätös supersedoi ADR-025:n vain Job Node -canvasin näkyvien label-, terminal- ja parent-scope-reference-elementtien osalta. Work→Validation, bounded retry, runtime ownership, Graph/Graph Node -canvasit ja kaikki config-, API-, module-, snapshot- ja persistence-sopimukset säilyvät.

## Päätösperusteet

- `goal-015` / `QS-020`: Job Noden rakenne on ymmärrettävä desktop- ja narrow-viewportissa ilman tarpeetonta parent-scope-kohinaa.
- `CON-005`: UI käyttää exact ID -typografiaa, olemassa olevia tokeneita, saavutettavia interaktioita ja deterministic layoutia.
- `CON-011`: authoring-projektio ei muuta Work→Validation-, retry- tai Graph Node Orchestrator -runtime-invariantteja.

## Harkitut vaihtoehdot

### Säilytä ADR-025:n kaikki read-only-elementit

Hylätty, koska Orchestrator- ja Next job -elementit eivät lisää Job Node -authoringissa käyttäjän pyytämää paikallista tietoa ja kasvattavat narrow-layoutin leveyttä.

### Poista retry-visualisointi kokonaan

Hylätty, koska bounded retry on Job Noden säilyvä invariantti ja `Retry?`-päätös kuuluu flow'n ymmärrettävään authoring-projektioon.

### Tee Continue tai Escalate painikkeiksi

Hylätty, koska Job Node -canvas on authoring-projektio eikä runtime-control surface.

## Seuraukset

- Job Node -canvas on kapeampi ja käyttää vähemmän staattisia parent-scope-elementtejä.
- Retry count -ghost on visuaalinen ryhmittelymerkki eikä laajenna domainia.
- Inspector-, runtime-, routing-, snapshot-, module- ja persistence-koodi pysyy ennallaan.
- ADR-025 jää historialliseksi päätökseksi niiltä osin kuin tätä ADR:ää ei ole supersedoitu.

## Evidenssi ja review trigger

Evidenssi muodostuu `frontend/tests/jobFlowProjection.test.ts`, `frontend/tests/spaceEngineeringCanvas.test.tsx`, `frontend/tests/automationViewJobFlow.test.tsx` -testeistä, 1440×900/390×844 browser-QA:sta, `npm`-gateista, arc42/design-validoinnista sekä installed-app-smokesta. Päätös arvioidaan uudelleen ennen uuden Job Node -topologian, Next job -targetin, runtime-toimintojen tai retry-state-projektion lisäämistä.
