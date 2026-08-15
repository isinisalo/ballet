---
id: adr-013
title: Workflow-yksityiskohdat kuuluvat skillsiin
status: accepted
createdAt: '2026-07-18T21:21:24.000Z'
updatedAt: '2026-07-19T06:45:37.000Z'
tags:
  - arkkitehtuuripäätös
  - skills
  - workflow
version: 3
---

# Workflow-yksityiskohdat kuuluvat skillsiin

## Konteksti

System-ohjeen pitää toimia kaikissa Ballet-projekteissa. Primary instruction määrittelee yhden Stepin yleisen työskentelytavan, task description kertoo suoritettavan tavoitteen ja Loop omistaa järjestyksen sekä Transitionit. Projekti- tai workflow-kohtaiset menettelyt, kuten roadmapin tuottaminen, milestone-handoff, GitHub-issueiden käsittely, release tai deploy, eivät kuulu yleiseen System-kerrokseen.

Jos workflow-yksityiskohdat sijoitetaan Systemiin tai runtime-profileen, ne muuttuvat piilossa pakollisiksi ja vaikeasti versioitaviksi. Jos ne kopioidaan jokaiseen primary instructioniin, sama menettely hajaantuu useaan tiedostoon.

## Päätös

Uudelleenkäytettävä workflow-menettely mallinnetaan Stepille eksplisiittisesti valittuna skill-tiedostona.

- Pakollinen read-only `system:execution-contract-v1` sisältää vain instruction-auktoriteetin, tool- ja permission-rajojen noudattamisen, salaisuuksien käsittelyrajan, structured outcome -sopimuksen, kiellon palauttaa raakaa hidden chain-of-thoughtia sekä vaatimuksen raportoida ajetut tarkistukset ja artifact-viitteet.
- System ei sisällä roadmap-, milestone-, issue-, katselmointi-, staging-, release-, deploy- tai muuta projekti- tai ohjelmistokehityksen workflow-menettelyä.
- Primary instruction kuvaa Stepin yleisen roolin, työskentelytavan, laatukriteerit ja pysäytysehdot.
- Task description kuvaa tämän Loop-noden konkreettisen tehtävän.
- Skill kuvaa eksplisiittisesti valitun, uudelleenkäytettävän menettelyn, työkalun tai integraatiotavan.
- Loop ja sen `Approved`/`Rejected`-Transitionit omistavat workflow'n järjestyksen ja kontrollivirran.
- Vain Stepin `skillIds`-listassa olevat skillsit composedaan. Ambient- tai implisiittinen skill discovery ei kuulu Balletin hallitsemaan ensimmäiseen versioon.
- Skillit snapshottataan Root Runin alussa. Evidenssi säilyttää niiden originin, ID:n, Project-relative pathin ja exact source SHA-256:n sekä executioniin välitetyn exact promptin ja sen SHA-256:n ilman saman täyssisällön redundantteja kopioita.

Skillien composition order on kanoninen eikä UI:n valintajärjestys muodosta piilotettua precedenceä. Mahdolliset semanttiset ristiriidat eivät ratkea `last one wins` -säännöllä.

## Seuraukset

- Projektikohtainen toimitusmenettely voidaan muuttaa tai poistaa muuttamatta System-ohjetta.
- Sama primary instruction voidaan yhdistää eri workflow-skilleihin eri Stepeissä.
- Run-evidenssi kertoo täsmälleen, mikä workflow-menettely oli käytössä.
- Nykyiset Ballet-kohtaiset roadmap-, milestone- ja release-menettelyt luokitellaan Project-skills-tiedostoihin; niitä ei saa siirtää System-originiin.
- Skill-katalogi ja Node editor tarvitsevat eksplisiittisen monivalinnan sekä puuttuvien viitteiden fail-closed-validoinnin.
- Päätös riippuu ADR-012:n Step-owned skill-valinnoista ja täsmentää ADR-002:n project-owned skills -mallia.

## Toteutuksen lähteet

- `.ballet/instructions/loop-engineer-minimal.md`
- `.agents/skills/**/SKILL.md`
- `backend/documents/projectResourceCatalog.ts`
- `backend/runs/LoopExecutionSnapshot.ts`
- `backend/integration/LoopStepPrompt.ts`
- `.ballet/outputs/execution-composition/PROMPT-COMPOSITION.md`
- `.ballet/outputs/execution-composition/MIGRATION-PLAN.md`
