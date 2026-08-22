---
id: adr-024
title: PASS/FAIL-result endpointien canvas-projektio
status: accepted
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-22T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - graph-node
  - canvas
version: 1
---

# PASS/FAIL-result endpointien canvas-projektio

## Konteksti

ADR-023:n kolmitasoinen canvas-sopimus piirsi PASS/FAIL-tuloksille näkyvät tekstit, yhteyspisteet ja endpoint-viivat Graph Engineering-, Graph Node- ja Job Node -canvaseille. Nämä elementit eivät ole authoroitavia nodeja eivätkä muuta runtime-reititystä, mutta ne lisäävät canvas-projektioon tulosrakenteen, jota operaattori ei käsittele topologiana.

## Päätös

Graph Engineering-, Graph Node- ja Job Node -canvasit eivät renderöi PASS/FAIL-tekstejä, result-yhteyspisteitä tai niihin päättyviä viivoja.

Canvas säilyttää nykyisen avaruusteeman, solmujen layoutin ja muut yhteydet. Graph- ja Graph Node -tasot säilyttävät candidate-jäsenyyttä kuvaavat spoket. Job Node säilyttää Work→Validation-validate-yhteyden ja Validation FAIL -retry→Work-yhteyden.

PASS/FAIL säilyy Validationin, orchestratorin, domainin, runtime-reitityksen ja inspectorin sopimuksissa. Muutos koskee vain authoring-canvasin visuaalista projektiota. ADR-024 supersedoi ADR-023:n vain tältä UI-projektion osalta; ADR-023:n domain-, routing-, persistence-, repair- ja canvas-scope-invariantit säilyvät.

## Päätösperusteet

- `QS-020` / `REQ-015`: canvasien pitää olla scopettuja, saavutettavia ja luettavia ilman tarpeettomia endpoint-elementtejä.
- Result-tulos ei ole authoroitava eikä valittava canvas-node.
- PASS/FAIL-semanticsin poistaminen domainista aiheuttaisi tarpeettoman API- ja runtime-muutoksen.

## Hylätyt vaihtoehdot

### PASS/FAIL-endpointtien säilyttäminen

Hylätty, koska result-endpointit lisäävät canvasille visuaalista kohinaa ilman authorointitoimintoa.

### PASS/FAIL:n poistaminen domainista

Hylätty, koska Validationin tulos- ja runtime-reititys tarvitsevat PASS/FAIL-sopimuksen edelleen.

## Seuraukset

- Kolme canonical authoring-canvasia näyttävät vain niiden käsiteltävät solmut ja kiinteät authorointi-/runtime-yhteydet.
- PASS/FAIL ei ole canvasilla valittava tai drill-down-kohde.
- Validation-, runtime- ja inspector-näkymät säilyttävät tarkan PASS/FAIL-tiedon.
- Canvasien visual QA varmistaa edelleen solmujen overlapin, narrow-viewportin vaakaylivuodon ja muun yhteysgeometrian.

## Evidenssi ja review trigger

Toteutuksen evidenssi muodostuu `frontend/tests/spaceEngineeringCanvas.test.tsx`-testeistä, lint/build/arc42-gateista sekä Graph Engineering-, Graph Node- ja Job Node -näkymien desktop/narrow-selain-QA:sta.

Päätös arvioidaan uudelleen, jos canvasille lisätään käyttäjän valittava result-inspector, result-kohtainen authorointi tai uusi hyväksytty tarve esittää Validation-tulos topologiana.
