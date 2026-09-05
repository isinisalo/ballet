---
id: review-remediation-evidence-2026-09-05
title: Koodikatselmoinnin korjaukset ja validointi
status: accepted
createdAt: '2026-09-05'
updatedAt: '2026-09-05'
version: 1
tags: [arc42, evidence, review, maintenance]
---

# Koodikatselmoinnin korjaukset 2026-09-05

Scope: käyttäjän pyytämät katselmointilöydösten korjaukset ja paikalliset Conventional Commit -commitit. Lähtörevisio `1700e13b`. Hyväksytty runtime-domain ja julkiset API-reitit säilyvät.

| Löydös | Korjaus | Todentava lähde |
| --- | --- | --- |
| F01: Markdown-luonnos sai uuden hashin vanhalle sisällölle | Yhteinen `useMarkdownDraft` sitoo lähteen ja hashin; stale save estyy, lataus on eksplisiittinen, epäonnistuminen säilyttää luonnoksen | `frontend/tests/markdownConflicts.test.tsx` |
| F02: Refinementin Agent-TOML-preimage puuttui | Tarkat tavut snapshotista tai ehdotuksen immutable Git-commitista, hash tarkistetaan; puuttuva preimage estää hyväksynnän | `RefinementPreimages.test.ts`, `Api.integration.test.ts` |
| F03: SSE jäi vanhan serverin cursorin taakse | Yksi jaettu yhteys, uusi cursor ja resync jokaisella yhdistämisellä, tapahtumien lyhyt koonti | `frontend/tests/orchestrationInvalidations.test.tsx` |
| F04: toinen Action-tallennus käytti vanhoja Agent-hasheja | Editorin baseline omaksuu palvelimen palauttaman Action/Agent-parin | `frontend/tests/orchestrationConfigureUi.test.tsx` |
| F05: kaikki näkymät hakivat kaikkia aineistoja | Näkymä- ja tapahtumakohtaiset haut, kevyt Environment-lock-haku, yhteinen SSE, graafityötilojen lazy load | `frontend/tests/workspaceData.test.tsx`, selain-QA ja build |
| F06: Critic-lista menetti title/finding/severity-kentät, 500 muuttui puuttuvaksi tiedoksi | Nimetty shared DTO ja SQL-projektio; vain 404 tulkitaan puuttuvaksi entityksi | `Api.integration.test.ts`, `workspaceData.test.tsx` |
| F07: rinnakkainen versioluettelo väitti vanhat versiot oikeiksi | Poistettu `RuntimeSchemaInventory` ja sen kopiotesti; versioiden omistajat linkitetty ARCHITECTUREen | nykyinen `backend/orchestration/domain/schemas.test.ts`, cutover |
| F08: käytöstä jääneet näkymät ja test-only-helperit | Poistettu Direction/UseCases/Critic-workspacet, neljä käyttämätöntä UI-primitiviä, collection-overview ja vanhat helperit; nykyeditorin exact approval testattu | tuontiviitteet, build ja koko testisuite |
| F09: vanhat sopimukset ja testitulokset näyttivät aktiivisilta | Yksi lukupolku, versiomatriisi ja nykyinen STATUS; pairing/binding-historia erotettu; säilytetyt stable ID:t | arc42-linkki-, schema- ja jäljitettävyysvalidointi |
| F10: kirjoitusrutiinit ja suuri HTTP-fasadi | Yksi atominen tiedostokirjoittaja; authoring ja read-only kyselyt erotettu; editorien tila irti renderöinnistä | repository/API/UI-regressiotestit, lint/build |
| F11: virheellinen Run-alivalinta näytti tyhjää | Eksplisiittinen virhe ja paluu Run-näkymään | `frontend/tests/orchestrationGovernanceUi.test.tsx` |

Red-to-green: ennen toteutusta uudet testit toistivat stale Markdown -tallennuksen, toisen Action-tallennuksen vanhat hashit, Critic-listan puuttuvat kentät, reconnectin vanhan cursorin, tarpeettomat haut, 404/500-sekoittumisen ja virheellisen Run-alivalinnan. Korjauksen jälkeen samat testit läpäisevät. Git-preimagen testi tarkistaa aidon alkuperäisen TOMLin sekä hash-mismatchin 409-vastauksen ilman approval-siirtymää.

Selaimen loppu-QA paljasti lisäksi turhan dirty-varoituksen pelkästä editorin klikkauksesta sekä narrow-toolbarin sivuun jäävän save-painikkeen. `workspaceDraftGuard.test.tsx` toisti ensimmäisen virheen ennen korjausta ja tarkistaa myös luonnoksen säilymisen refresh-virheessä sekä varoituksen poistumisen palautettaessa alkuperäinen teksti. Nykyinen toolbar pitää tunnisteen tiiviinä ja komennot näkyvissä DESIGN-sopimuksen mukaan.

Testien poistot koskivat käytöstä poistettua UI:ta, pelkästään testeissä kutsuttuja funktioita ja vanhojen vakioiden kopioita. Backendin hyväksyntä-, retry-, lock-, transaction- ja scheduler-kattavuus säilyy. Testimäärä ei yksin ole laatumittari.

## Viimeisin validointi

- Fact: koko testisuite 383/383, 50 tiedostoa; lint 0 virhettä / 0 varoitusta; TypeScript ja production build läpäisevät.
- Fact: workspace-päächunk 386.40 kB / gzip 114.28 kB; katselmoinnin lähtötilassa 659.76 kB / gzip 203.75 kB. Graafien koodi ladataan erikseen tarvittaessa, eikä buildissa ole kokovaroitusta.
- Fact: arc42 (12 osiota / 116 stable document ID:tä), cutover, DESIGN lint ja `git diff --check` läpäisevät. DESIGN lint: 0 virhettä / 0 varoitusta.
- Fact: `make latest` rakentaa, asentaa ja käynnistää paikallisen paketin; health `ok: true`, daemon `online`, Codex-provider `ready` ja 0 aktiivista taskia. Lopullinen archive SHA-256: `13fe314dd2c1d677e5b32828de23a93bfa00d8b2cc78051938226f0c7fe7fc81`.
- Fact: selaimen Loop Engineering ja Skills tarkistettu 1440×900 ja 390×844. Sivuttaisylivuoto 0; narrow zoom- ja save-kontrollit 40×44 px. Markdown Body saa näkyvän keyboard-fokuksen Frontmatterista Tabilla; klikkaus ja Tab eivät aiheuta poistumisdialogia. Selainkonsoli: 0 virhettä / 0 varoitusta. Skills tekee vain project/reference-index/skills-haut; ei governance- tai graafiresurssien hakua. SSE:n yksi yhteys ja restart todentuvat hook-testissä.
- Fact: kuvallinen evidenssi: [Loop desktop](../../../../output/playwright/review-fixes-loops-desktop.png), [Loop narrow](../../../../output/playwright/review-fixes-loops-narrow.png), [Skills desktop](../../../../output/playwright/review-fixes-skills-desktop.png), [Skills narrow](../../../../output/playwright/review-fixes-skills-narrow.png).

## Korjauscommitit

- `d7c7a0b3 fix(ui): preserve editor baselines across refreshes and saves`
- `9e7e5ea8 fix(reviews): verify immutable diff preimages and type critic summaries`
- `5368a6f9 fix(ui): resync shared events and load workspace data on demand`
- `013cf910 refactor: remove unreachable workspaces and duplicate contract tests`
- `cd673d03 refactor(backend): separate authoring and query controllers`
- `f16e4db6 refactor(ui): isolate editor state and lazy-load graph workspaces`
- `0429220b fix(ui): guard real drafts and keep narrow toolbar actions visible`
- Dokumentaation tiivistys ja tämä evidenssi ovat omassa `docs(architecture)`-commitissaan.

## Rajat

Pitkää oikean Codex-providerin Work/Validation-occurrencea ei ajettu tämän ylläpitokorjauksen osana. Ei pushia, mergeä tai ulkoista julkaisua. Vanhat initiative-evidenssit ja Git-historia säilyvät; tämä tiedosto omistaa vain yllä olevan rajatun muutoksen tulokset.
