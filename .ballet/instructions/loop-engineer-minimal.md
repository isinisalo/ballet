---
title: Loop Engineer Delivery Chain
createdAt: 2026-07-15
updatedAt: 2026-07-18
tags:
  - ballet
  - loop-engineering
  - delivery-chain
---

# Yhtenäinen Loop Engineer -ketju

Ihminen omistaa Goal- ja ADR-dokumenttien WHAT- ja WHY-päätökset. Agentit ratkaisevat HOW-toteutuksen niiden sisällä. Uutta tuotepäätöstä, scopea tai arkkitehtuuria vaativa työ blokataan ja palautetaan ihmiselle.

## Neljä toisiinsa liittyvää Loopia

1. `blueprint-design`: `roadmap` → `data-model` → `ui-design` → `ui-mocks` → `c4-models` → human `blueprint-gate`.
2. `milestone-planning`: `plan-milestone-issues` → `implementation-plan` → `test-plan` → human `milestone-gate`.
3. `milestone-delivery`: `implement-milestone` → `run-acceptance-tests` → human `implementation-gate`.
4. `release-validation`: `make-git-release` → `deploy-release` → `verify-release` → human `release-gate`.

Jokainen human `approved` -päätös käynnistää seuraavan Loopin saman root Runin ja worktreen sisällä. Human `rejected` säilyy ihmisen päätöksenä ja palautuu saman Loopin korjausvaiheeseen. `release-gate` palautuu `verify-release`-Stepiin eikä luo uutta Git-tagia.

## Node-tyylit

- `sol`: roadmap, data model, UI design, UI mocks ja C4-mallit.
- `luna`: milestone- ja testisuunnittelu sekä kaikki human gatet.
- `terra`: toteutus, acceptance-testit ja release.

Suunnittelunodeilla on `large`, toteutus- ja validointinodeilla `medium` ja human gateilla `tiny`-koko. Node-tyylit tulevat projektin olemassa olevasta Loop-katalogista; uusia värejä tai visuaalisia sääntöjä ei lisätä.

## Human gate -siirtymät

- `blueprint-gate.approved` → `{ "loop": "milestone-planning" }`
- `blueprint-gate.rejected` → `roadmap`
- `milestone-gate.approved` → `{ "loop": "milestone-delivery" }`
- `milestone-gate.rejected` → `plan-milestone-issues`
- `implementation-gate.approved` → `{ "loop": "release-validation" }`
- `implementation-gate.rejected` → `implement-milestone`
- `release-gate.approved` → `completed`
- `release-gate.rejected` → `verify-release`

Agentti-outcomet reititetään sellaisinaan: `ready` ja verifierin `approved` etenevät normaaliin seuraavaan Stepiin, `changes-requested` saa palata vain nimettyyn saman scopen repair-Stepiin, ja `needs_input` siirtyy nimettyyn human gateen. `blocked` päättää Runin blocked-tilaan ja `failed` failed-tilaan; kumpikaan ei saa käynnistää implementation-retryä. Vain eksplisiittisesti `transient`-luokiteltu `failed` voidaan yrittää kerran uudelleen. `run-acceptance-tests.changes-requested` palaa `implement-milestone`-Stepiin enintään kolmen repair-kierroksen ajan.

## Handoff

`blueprint-gate`-approved-vastauksessa pitää olla vähintään:

```text
milestone_id: milestone-001
github_issue: owner/repository#123
```

`milestone_id` on muotoa `milestone-NNN`. `github_issue`-rivi on toistettava ja muotoa `owner/repository#number`. Handoff-parseri vaatii täsmälleen yhden milestone-ID:n ja vähintään yhden yksikäsitteisen GitHub-issue-tunnisteen. Myöhemmät human-palautteet saavat olla vapaamuotoisia; ensimmäinen handoff säilyy accumulated Run-inputissa.

Downstream Looppeja ei saa käynnistää manuaalisesti. Vain `blueprint-design` on kelvollinen manual root. Handoffin syntaksi validoidaan ennen cross-Loop-siirtymää; GitHub-issueiden olemassaolo ja sisältö validoidaan milestone-agentissa.

## Artifact-sopimus

- `.ballet/outputs/ROADMAP.md`: MVP, inkrementit, riippuvuudet, riskit, validointipisteet ja Goal/ADR-viitteet.
- `.ballet/outputs/DATA-MODEL.md`: domain-, data- ja integraatiomalli.
- `.ballet/outputs/UI-DESIGN.md`: näkymät, tilat, komponentit, saavutettavuus ja responsiivisuus.
- `.ballet/outputs/UI-MOCKS.md`: tarkistettavat näkymä- ja tilamockit.
- `.ballet/outputs/C4.md`: context-, container- ja component-mallit.
- `.ballet/outputs/milestones/<milestone-id>/MILESTONE.md`: rajaus ja GitHub-issue snapshotit.
- `.ballet/outputs/milestones/<milestone-id>/IMPLEMENTATION-PLAN.md`: toteutuksen järjestys, scope ja riippuvuudet.
- `.ballet/outputs/milestones/<milestone-id>/TEST-PLAN.md`: testit ja acceptance-evidenssi.
- `.ballet/outputs/milestones/<milestone-id>/ACCEPTANCE.md`: ajetut acceptance-testit ja tulokset.
- Release-agentin release-artifact: Git-versio, CI/CD-run, ympäristö, verifiointi ja rollback.

Artifactit ja summaryt kirjoitetaan suomeksi. Teknisiä tunnisteita ei käännetä. Agentit eivät kirjoita salaisuuksia artifacteihin, eivätkä välitä raakaa reasoning-sisältöä.

## Release-käytäntö

`release-agent` käyttää vain repositorion olemassa olevia release- ja CI/CD-komentoja tai workflow’ta. Se ei keksi uutta deploy-provideria, ympäristöä tai komentoa. Puuttuva release-sopimus, hyväksyntä, oikeus tai turvallinen rollback palauttaa `blocked`-outcomen ennen ulkoista kirjoitusta. Human `release-gate` hyväksyy jo verifioidun julkaisun; rejection palaa vain verifiointiin.

## Validointi

Loop-konfiguraation muutoksen jälkeen aja `npm run test`, `npm run lint` ja `npm run build`. UI- tai tyylimuutos noudattaa juuren `AGENTS.md`- ja `DESIGN.md`-ohjeita.
