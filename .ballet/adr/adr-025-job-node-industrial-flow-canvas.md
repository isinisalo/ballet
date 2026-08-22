---
id: adr-025
title: Job Node authoring käyttää industrial flow -projektiota
status: accepted
createdAt: '2026-08-22T00:00:00.000Z'
updatedAt: '2026-08-22T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - job-node
  - canvas
  - authoring
version: 1
---

# Job Node authoring käyttää industrial flow -projektiota

## Konteksti

ADR-023 määritti kolmelle authoring-tasolle yhden avaruuscanvas-kielen ja ADR-024 poisti niiltä PASS/FAIL-result endpointit. Nykyinen Job Node -canvas näyttää Work- ja Validation-planeetat sekä validate/retryn, mutta ei tee yhdellä silmäyksellä näkyväksi Jobin entryä, tuloksen kahta haaraa, retryrajaa, Graph Node Orchestratorin continuation-vastuuta tai retryrajan jälkeistä eskalaatiota.

Projektin omistaja valitsi 2026-08-22 eksplisiittisesti vain Job Node -tasolle tumman industrial flow -projektion. Samalla hän rajasi `Next job` -elementin ei-klikattavaksi placeholderiksi, `Done`/`Escalate`-elementit kiinteiksi merkeiksi ja runtime-/candidate-sopimuksen muuttumattomaksi.

## Päätös

Graph Engineering ja Graph Node säilyttävät suojatun planet-artwork-, multi-ring-, spoke- ja pan/zoom-kielensä. Job Node käyttää samalla 24 px teknisellä gridillä determinististä industrial flow -projektiota:

`Start → Take action → Verify Result → Result`, josta FAIL johtaa retryrajan sisällä takaisin Take actioniin ja rajan jälkeen Escalateen, kun taas PASS johtaa read-only Graph Node Orchestrator -päätöskohtaan sekä `Next job`-placeholderiin tai `Done`-merkkiin.

- `Take action` projisoi Work Noden ja `Verify Result` Validation Noden. Vain nämä kaksi ovat valittavia ja avaavat nykyisen inspectorin/Sheetin.
- Rakenteellisesti keskeneräinen Work/Validation näkyy dashed ghost -korttina mutta säilyy valittavana korjaamista varten.
- `Next job` on aina dashed, `aria-disabled` ja ei-klikattava. Se ei tallenna targetia eikä muuta candidate-sääntöä.
- `Start`, `Done`, `Escalate`, Result/retry-junctionit ja Graph Node Orchestrator -viite ovat ei-klikattavia. Orchestrator-viite näyttää exact ID:n ja kertoo routing-asetusten omistuksen.
- Work/Validationin `nodeStyle` näkyy kortin compact artwork-embleeminä ja `nodeSize` kortin kokona, joten nykyinen appearance-data säilyy havaittavana.
- Normaali flow käyttää 1.5 px mint-yhteyttä, retry amber-dashed-yhteyttä ja FAIL error-semanttista yhteyttä. `maxRetries = 0` ei piirrä aktiivista retry-returnia.
- Narrow-viewport käyttää determinististä tiiviimpää layoutia ja olemassa olevaa inspector-Sheetiä ilman sivutason vaakaylivuotoa. Reduced motion säilyy.

Projektio on authoring-näkymä, ei runtime-ohjain. Graph Node Orchestrator valitsee PASS-continuationin edelleen immutable snapshotin candidate-enumista ja retryrajan jälkeinen FAIL siirtyy edelleen nykyiseen repair/escalation-polkuun. Config v14, Graph Node Module v4, snapshot/envelope/outcome v7, composition v8, ExecutionSpec v9 ja SQLite v10 eivät muutu.

## Päätösperusteet

- `goal-015` / `QS-020`: Job Noden rakenne ja inspector-valinnat on voitava ymmärtää desktop- ja narrow-viewportissa ilman keksittyä runtime-tilaa.
- `CON-005`: UI:n pitää olla dense, saavutettava, token-driven ja project/runtime-totuudelle rehellinen.
- `CON-011`: Work→Validation, bounded retry ja scoped orchestrator -vastuu säilyvät samoina, vaikka authoring-projektio muuttuu.

## Harkitut vaihtoehdot

### Säilytä Work/Validation-planeetat

Hylätty, koska ne eivät exposeeraa pyydettyä entry/result/retry/escalation/continuation-mentaalimallia riittävän suorasti.

### Tee Next job authoroitavaksi tässä muutoksessa

Hylätty, koska se muuttaisi candidate routing -sopimusta ja vaatisi erillisen domain-/runtime-päätöksen. Placeholder ei saa vihjata tallennetusta targetista.

### Tee Done ja Escalate runtime-painikkeiksi

Hylätty, koska canonical authoring-route ei ole Run control surface eikä inspector-valinta saa mutatoida suoritusta.

## Seuraukset

- Kolme canonical routea säilyvät, mutta vain kaksi ylintä tasoa käyttää planet/multi-ring-projektiota.
- Job-canvas saa oman pure projection/layout -moduulin ja alle 150-rivisen React-renderöinnin. Graph-tasojen `SpaceEngineeringCanvas` ei tunne Job-flow'ta.
- ADR-025 supersedoi ADR-023:n yhteisen kolmen tason planet-kielen ja ADR-024:n Job-tason result-tekstikiellon vain Job-canvasin osalta. ADR-024 jää voimaan Graph Engineering- ja Graph Node -canvaseilla.
- Domain-, runtime-, API-, persistence-, module- ja project config -sopimukset säilyvät muuttumattomina.

## Evidenssi ja review trigger

Päätös linkittyy `goal-015` / `REQ-015`, `QS-020`, `CON-005`, `CON-011`, `BB-001`, `TEST-020`, `EVID-020` sekä initiativeen `job-node-industrial-flow-canvas`. Evidenssi kattaa pure projection-, component/integration-, full gate- ja 1440×900/390×844-browser-QA:n.

Päätös arvioidaan uudelleen ennen `Next job` -targetin authorointia, Done/Escalate-runtime-toimintoa, Job-tason freeform-topologiaa tai sellaista appearance-poistoa, joka muuttaisi config/module-sopimusta.
