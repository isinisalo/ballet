---
id: adr-011
title: arc42 Template ja jatkuva Ballet Method
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - arkkitehtuuripäätös
  - arc42
  - jatkuva-kehitys
version: 1
---

# arc42 Template ja jatkuva Ballet Method

## Konteksti

Balletin hyväksytyt Goalit ja ADR:t kuvaavat tuotteen intentiota ja keskeisiä ratkaisuja, mutta repositoryn oma blueprint–milestone–delivery-automaatio hajauttaa suunnittelun, toteutuksen ja evidenssin erillisiin artifactteihin. arc42 erottaa versionhallittavan Template-rakenteen kuudesta jatkuvasta, toisiinsa palautetta antavasta arkkitehtuuriaktiviteetista ja jatkuvasta oppimisesta.

## Päätös

### Kanoniset polut

- Ihmisen ja agentin arkkitehtuurin entrypoint on `ARCHITECTURE.md`.
- Kanoninen projektitason arkkitehtuuritieto on `.ballet/arc42/`-hakemistossa: osiot `01`–`12`, `README.md`, `STATUS.md`, `TRACEABILITY.md`, `METHOD-HEALTH.md` ja `STATE-CONTRACT.md`.
- Aloitekohtainen tieto on `.ballet/arc42/initiatives/<initiative-id>/{BRIEF,PLAN,EVIDENCE,REVIEW}.md`.
- Hyväksytyt WHAT/WHY-päätökset säilyvät `.ballet/goals/`-tiedostoissa ja arkkitehtuuripäätökset `.ballet/adr/`-tiedostoissa. arc42-osio 9 indeksoi ADR:t eikä kopioi niiden päätöstekstiä.
- `DESIGN.md` säilyy UI-design-järjestelmän kanonisena lähteenä ja arc42-osio 8 viittaa siihen.

### 6+1 Loop -malli

Kuusi arc42-aktiviteettia ovat `arc42-clarify-requirements`, `arc42-design-structures`, `arc42-design-concepts`, `arc42-communicate-document`, `arc42-accompany-implementation` ja `arc42-analyze-evaluate`. `arc42-continuous-learning` on niitä tukeva seitsemäs Loop. `release-validation` säilyy erillisenä tukilooppina eikä kuulu oletus-flow'hun.

Oletus-flow on clarify → structures → concepts → communicate → implementation → evaluate → completed. Tämä on käyttömukava aloitusjärjestys, ei vesiputous: Validation voi pyytää capability-pohjaisen repairin source-Loopin allowlistista.

### Yhteinen State-sopimus

Kaikki arc42-Loopit käyttävät rakenteellisesti samaa `Arc42MethodStateV1`-initial-arvoa. State sisältää vain initiative-, architecture-, delivery-, release-, evaluation- ja handoff-alueiden rajatun työtilan. Dokumenttien täysi sisältö ei kuulu Stateen.

Work completed ja Validation OK saavat ehdottaa vain ADR-015:n strictiä `add | remove | replace` JSON Patch -osajoukkoa. Patch-evidenssin pitää nimetä muuttuneet artifact-polut, vakaat tunnisteet ja ajetut checkit. Runtime validoi ja committoi patchin atomisesti.

### Flow ja repair

Normaali eteneminen käyttää `flow`-LoopEdgejä. Repair käyttää source-Loop-kohtaista `repair`-allowlistia. Validation kuvaa tarvittavan capabilityn tai outcomen, ei target Loopia. Orchestrator voi ehdottaa vain Task Envelopen allowlistissa olevaa targetia; platform ratkaisee Edgen, framen ja continuationin. Repairin jälkeen palataan aina pyynnön tehneeseen Validation Nodeen uusimmalla State-revisiolla.

Jos useampi target sopii eikä evidenssi erota niitä, Orchestrator palauttaa `needs_input`. Ensimmäistä targetia ei käytetä fallbackina.

### Ihmishyväksynnän rajat

Eksplisiittinen ihminen tarvitaan, kun päätetään uusi tai muuttuva WHAT/WHY, top-laatutavoitteen prioriteetti tai hyväksymismitta, hyväksytään uusi merkittävä ADR, hyväksytään toteutus ennen releasea, sallitaan release/deploy/rollback tai muu ulkoinen kirjoitus tai muutetaan Loop-topologiaa, network accessia, permissioneita tai automaation omaa instruction-/skill-käyttäytymistä. Mekaaninen, semantiikkaa muuttamaton dokumenttilinkki, indeksi, formaatti, lint tai deterministinen testi ei vaadi omaa ihmisporttia.

### Jatkuva oppiminen ja menetelmäterveys

Continuous learning saa käyttää verkkoa vain eksplisiittisessä research-nodessa ja vain authoritative/primary sources -lähteisiin. Havainto kirjataan vaikutuksineen, lähteineen, QS/RISK/ADR/BB-linkkeineen ja odotettuine mitattavine parannuksineen. Materiaalinen havainto reititetään oikeaan arc42-aktiviteettiin; ei-materiaalinen tulos ei tuota dokumenttichurnia.

Menetelmämuutos vaatii baseline-mitan, hypoteesin, odotetun tuloksen, eksplisiittisen hyväksynnän ja myöhemmän evalin. `METHOD-HEALTH.md` seuraa validation-faileja, retryjä, repair-reittejä, avoimia kysymyksiä, dokumenttidriftiä, architecture driftiä, evidenssivajeita ja manuaalisia interventioita.

### Aiemmat päätökset

Tämä päätös ei korvaa aiempien Goalien tai ADR:ien semanttisia päätöksiä. Ne säilyvät kanonisina lähteinä. Erityisesti ADR-012:n ExecutionProfile-raja, ADR-013:n instruction/task/skill/Loop-vastuunjako, ADR-014:n project-local workflow ja ADR-015:n State-, Validation-, repair- ja continuation-sopimus pysyvät voimassa.

## Seuraukset

- Repositoryllä on yksi aktiivinen arkkitehtuurin source of truth ja aloitekohtainen, jäljitettävä handoff.
- Vanhojen output-artifactien relevantti tieto siirretään arc42-osioihin tai initiative-templateihin; vanhat polut jäävät vain superseded-osoittimiksi, kun linkit sitä vaativat.
- Platform-koodi ei saa arc42-loop-ID:itä tai artifact-polkuja.
- Strict-v10:n nykyiset geneeriset primitiivit riittävät; uutta platform-primitiiviä ei tarvita.
- Release/deploy jää ulkoiseksi, ihmisvaltuutetuksi toiminnoksi eikä sitä ketjuteta jokaiseen kehitysajoon.

## Lähteet ja evidenssi

- [arc42 method](https://arc42.org/method/)
- [arc42 template sections](https://docs.arc42.org/home/)
- [OpenAI GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- `goal-009`
- `adr-012`, `adr-013`, `adr-014`, `adr-015`
- `.ballet/arc42/migration/ASSESSMENT.md`

## Uudelleenarviointi

Päätös arvioidaan ensimmäisen läpiviedyn initiativen jälkeen, jos mitattu evidenssi osoittaa epäselvän reitityksen, toistuvan dokumenttidriftin, tarpeettoman ihmisportin tai State-sopimuksen rakenteellisen puutteen. Semanttinen muutos vaatii uuden ADR:n.
