---
title: Loop Engineer Minimal
createdAt: 2026-07-06
updatedAt: 2026-07-11
tags:
  - ballet
  - loop-engineering
  - governance
---

# Loop Engineer Minimal

Ihminen kirjoittaa Goal- ja ADR-dokumentteihin WHAT- ja WHY-päätökset. Agentit päättävät HOW-toteutuksen näiden rajojen sisällä. Uutta WHAT/WHY- tai arkkitehtuuripäätöstä vaativa työ blokataan ja palautetaan ihmiselle; agentit eivät muuta Goal- tai ADR-dokumentteja.

## Neljä Loopia

1. `delivery-planning`: `create-roadmap` → `create-work-breakdown` → human `planning-gate`. Agentin rejection blokkaa Runin. Human rejection palauttaa palautteen kanssa `create-roadmap`-Stepiin, ja approval päättää Runin.
2. `ui-design`: taskikohtainen `design-task-ui`. Ready päättää Runin, muu outcome blokkaa sen. Käynnistä tämä Loop vain taskille, jonka `UI-tarve` edellyttää suunnittelua.
3. `implementation`: `implement-task` → `verify-task` → human `code-gate`. Verifierin saman taskin `changes-requested` palautuu implementointiin. Verifierin `blocked`-palaute saa implementerin lopettamaan scopea laajentamatta. Human rejection palautuu implementointiin; approval valtuuttaa ja käynnistää `dev-deployment`-Loopin.
4. `dev-deployment`: `deploy-and-validate-dev` tarkistaa valmiuden, deployaa vain deviin, validoi julkaisun ja rollbackaa epäonnistumisen. Approval päättää rootin onnistuneena, rejection epäonnistuneena.

All-approved-happy path sisältää `delivery-planning`-Loopissa 3 transitionia, `ui-design`-Loopissa 1 transitionin ja `implementation` → `dev-deployment` -ketjussa 4 transitionia.

## Human gatet

- `planning-gate` hyväksyy ROADMAP-, MILESTONES- ja TASKS-artifactit toteutuksen lähtökohdaksi.
- `code-gate` hyväksyy tarkastetun yhden taskin toteutuksen ja valtuuttaa ulkoiset dev-deployment-kirjoitukset.

Human-vastaus sisältää `approved`- tai `rejected`-tuloksen sekä palautetekstin. Agentti ei käynnistä seuraavaa Stepiä tai Loopia itse; Run-moottori soveltaa outcomea vastaavaan transitioniin.

## Run-input

`ui-design`- ja `implementation`-Runin inputissa pitää olla täsmälleen yksi oma rivi seuraavassa muodossa:

```text
task_id: task-NNN
```

ID:n pitää olla deklaroitu `.ballet/outputs/TASKS.md`-tiedostossa täsmälleen kerran otsikolla `## task-NNN — <nimi>`; muualla esiintyvä task-ID on vain ristiviite. Puuttuva, moninkertainen, vääränmuotoinen tai tuntematon ID blokataan backendissä ennen agenttitaskin luontia. Yksi implementation-root toteuttaa vain tämän yhden taskin. `dev-deployment` ei ole itsenäisesti käynnistettävä root, vaan se syntyy vain hyväksytyn `code-gate`-transition kautta ja käyttää saman rootin taskia.

## Runtime-handoff

Loop-agentin user-prompt on sisäinen JSON-envelope, jossa ovat nykyisen immutable snapshotin `loop_id`, `step_id` ja Step-kuvaus, kumulatiivinen Run-input sekä enintään kolme uusinta valmistunutta Stepiä koko rootista. Recent history välittää tiiviin human-palautteen, agent outcomen, olennaiset checkit, turvalliset artifact-viitteet ja errorin myös cross-loop-siirtymän yli.

Run-input rajataan promptissa 20 000 merkkiin säilyttämällä alku ja loppu. Recent history rajataan 8 KiB:iin. Raakaa diffiä, pitkiä lokeja tai reasoning-sisältöä ei välitetä seuraavan agentin promptiin; lähdekoodi ja diff tarkastetaan yhteisestä worktreestä.

## Artifact-sopimus

- `.ballet/outputs/ROADMAP.md`: toimitusjärjestys, MVP, inkrementit, riskit, riippuvuudet, validointipisteet sekä Goal/ADR-viitteet.
- `.ballet/outputs/MILESTONES.md`: milestonejen rajaus, lopputulos, järjestys ja validointitapa sekä Goal/ADR-jäljitettävyys.
- `.ballet/outputs/TASKS.md`: pysyvät, yksikäsitteisinä `## task-NNN — <nimi>` -otsikkoina deklaroidut ID:t sekä jokaiselle taskille Goal/ADR-viitteet, scope, acceptance criteria, tarkistukset, UI-tarve ja deploy-vaikutus.
- `.ballet/outputs/ui/<task-id>.md`: yhden UI-taskin käyttäjäpolut, näkymät, tilat, saavutettavuus, responsiivisuus ja UI acceptance criteriat.
- `.ballet/outputs/deployments/<task-id>.md`: dev-julkaisun versio, ympäristö, komennot, checkit, tulos ja mahdollinen rollback.

Erillisiä Project Brief-, Technical Plan- tai Traceability Matrix -artifacteja ei käytetä. Jäljitettävyys tallennetaan suoraan ROADMAP-, MILESTONES- ja TASKS-artifacteihin. Artifactit ja agenttien summaryt kirjoitetaan suomeksi; koodi ja tekniset tunnisteet säilytetään alkuperäisessä muodossa.

## Outcomes ja rework

Run-moottori tulkitsee `ready`- ja `approved`-outcomet Stepin approved-transitioniksi sekä `changes-requested`-, `blocked`- ja `failed`-outcomet rejected-transitioniksi. Korjattava verifier-palaute pysyy saman taskin implementation-Loopissa. Uutta task-scopea, Goal-päätöstä tai ADR-päätöstä vaativa puute blokataan.

## Käyttöjärjestys

1. Aja `delivery-planning` ja hyväksy `planning-gate`.
2. Mergeä onnistuneen `ballet/run/*`-branchin artifactit lähdehaaraan.
3. Aja tarvittaessa `ui-design` yhdelle taskille ja mergeä sen artifact ennen toteutusta.
4. Aja `implementation` samalla task-ID:llä. Hyväksy `code-gate` vasta review- ja testievidenssin jälkeen; dev-deployment jatkuu linkitettynä samassa rootissa.

Itsenäisten suunnittelu- ja UI-Runien brancheja ei mergetä automaattisesti. Käyttöönotossa irrota poistettujen `brief-agent`-, `loop-critic-agent`-, `technical-plan-agent`- ja `failure-router-agent`-ID:iden mahdolliset runtime attachmentit, jotta control planeen ei jää orphan-konfiguraatiota.
