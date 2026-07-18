---
title: Loop Engineer Delivery Chain
createdAt: 2026-07-15
updatedAt: 2026-07-18
tags:
  - ballet
  - loop-engineering
  - source-contract
  - delivery-chain
---

# Yhtenäinen Loop Engineer -ketju

Ihminen omistaa hyväksytyissä source plane -lähteissä WHAT- ja WHY-päätökset. Agentit inventoivat, validoivat ja johtavat HOW-artifactit niiden sisällä. Runtime-input, gate-vastaus, issue, agenttiehdotus, summary tai aiempi generated artifact ei ole source authority.

Lue aina `.ballet/source-plane.yaml`, lähimmät `AGENTS.md`-ohjeet ja `.agents/skills/_shared/blueprint-governance.md`. Pidä `orchestrator`- ja `managed-product`-scopet erillään: hallitun tuotteen Python/AWS-ADR:t eivät ohjaa Balletin TypeScript-runtimea, eikä orchestratorin root `DESIGN.md` ohjaa hallitun tuotteen UI:ta ilman eksplisiittistä saman scopen source-sidosta.

Blueprint-design käyttää aina source-plane-contractin eksplisiittistä `blueprint_scope`-valintaa. Nykyinen valinta on `managed-product`; inventaario, snapshot, kaikki 13 juuritason blueprint-artifactia, viitteet, review ja gate-paketti pysyvät tässä samassa scopessa, kunnes ihminen muuttaa valinnan source-plane-contractissa.

`managed-product`-scopen `code_paths` on tällä hetkellä tyhjä. Implementation- ja release-Stepien pitää palauttaa `blocked`, kunnes tämä konfiguraatio ajetaan varsinaisen tuotteen checkoutissa tai source planeen määritetään todelliset koodi- ja sopimuspolut.

## Neljä toisiinsa liittyvää Loopia

1. `blueprint-design`: source inventory → source validation → gap/conflict audit → conditional decision request → roadmap → domain map → C4 context/container → quality scenarios → threat model → UX information architecture → test strategy → traceability → independent verifier → human blueprint gate.
2. `milestone-planning`: local milestone manifest + draft-only issue slicing → implementation plan → test plan → human milestone gate.
3. `milestone-delivery`: implementation → independent acceptance evidence + staging report → human implementation gate.
4. `release-validation`: approved release → approved deploy → verification → human release gate.

Vain `blueprint-design` on manual root. Approved cross-Loop-siirtymät säilyvät saman root Runin ja worktreen sisällä. Downstream Loopia ei käynnistetä manuaalisesti.

## Blueprint-loop

| Step | Authority ja tuotos |
| --- | --- |
| `source-inventory` | Inventoi `blueprint_scope`-valinnan lähteet ja kirjoittaa ainoana tässä vaiheessa source snapshotin tarkalla Git HEAD SHA:lla, source-plane contract -hashilla ja raw-byte source SHA-256 -hasheilla. |
| `source-validation` | Validoi olemassa olevan snapshotin read-only-tilassa ja todistaa ID-, status-, scope-, path-, reference-, Git- ja hash-eheyden muuttamatta artifactia. |
| `gap-and-conflict-audit` | Kirjoittaa specification gaps -artifactin; kirjoittaa decision requests -artifactin vain blocking päätöspuutteesta ja palauttaa silloin `needs_input`. |
| `source-decision-gate` | Ihminen päivittää ja hyväksyy päätöksen sourceen ennen `approved`-vastausta; gate-vastaus ei itsessään ratkaise päätöstä. Approved palaa uuteen inventointiin, rejected päättää Runin blocked-tilaan. |
| `roadmap` | Johtaa source-backed vertikaaliset slicet ja niiden acceptance-, dependency-, risk- ja validation-viitteet. |
| `domain-map` | Johtaa domainit, vastuut ja suhteet. |
| `c4-context-container` | Johtaa actorit, systeemit, containerit ja suhteet; tuntematon teknologia jää `null`:ksi. |
| `quality-scenarios` | Muuttaa hyväksytyt quality-vaatimukset mitattaviksi skenaarioiksi keksimättä thresholdia. |
| `threat-model` | Johtaa assetit, trust boundaryt, uhkat, mitigoinnit, verifioinnin ja residual riskin ilman live-probausta. |
| `ux-information-architecture` | Johtaa saman scopen behavior- ja DESIGN-lähteistä actorit, journeyt, views ja tilat. |
| `test-strategy` | Sitoo acceptance- ja quality-vaatimukset testitasoihin ja vaadittavaan evidenssiin. |
| `traceability` | Laskee source → artifact → acceptance → test -ketjut ja jättää uncovered-kohdat eksplisiittisiksi. |
| `independent-blueprint-verifier` | Lukee lähteet/artifactit suoraan levyltä, todistaa riippumattomuuden, laskee hashit uudelleen ja kirjoittaa review'n sekä gate packetin. Ei korjaa tekijöiden artifactteja. |
| `blueprint-gate` | Ihminen hyväksyy täsmällisen hashatun packetin. Rejected käynnistää uuden source inventoryn. |

Verifierin `changes-requested`, blueprint-gaten rejection ja hyväksytty source-päätös palaavat uuteen `source-inventory`-Stepiin. Agentti ei poista, siirrä tai korvaa aiempia outputteja: stale tai toiseen snapshottiin sidottu artifact raportoidaan täsmällisellä polulla ja pysäyttää työn, kunnes sen käsittelyyn on eksplisiittinen, polkukohtainen lupa. Source-, päätös-, approval- tai independence-aukko on `blocked`/`needs_input`, ei piilotettu artifact-repair.

## Outcome- ja retry-sopimus

- `ready` ja verifierin `approved` etenevät normaaliin seuraavaan Stepiin.
- Blueprintin source-päätöksen `needs_input` siirtyy nimettyyn `source-decision-gate`en ja palaa hyväksytyn source-päivityksen jälkeen uuteen source-inventaarioon. Downstream-Stepien `needs_input` käyttää wait/resume-politiikkaa ja jatkaa samaa pyytänyttä Stepiä; se ei koskaan siirry final approval gateen eikä ohita artifact-ketjua.
- `changes-requested` saa käyttää vain eksplisiittistä saman scopen repair-kohdetta.
- `blocked` ja permanent `failed` päättävät Runin vastaavaan terminaliin.
- Vain eksplisiittisesti transient `failed` yritetään kerran uudelleen.
- Acceptance-verifier saa palauttaa toteutukseen enintään kolme kertaa, ja vain uuden evidenssin perusteella.
- Yhdellä artifact-polulla on yksi kirjoittaja. Enintään kolme read-only-auditia saa olla rinnakkain.

## Human blueprint gate ja handoff

`blueprint-gate-packet.yaml` sisältää vähintään exact source SHA:n, raw-byte artifact-hashit, uudet oletukset, avoimet päätökset, riskit, exact coveragen, verifier review -viitteen ja ehdotetut ulkoiset toimet `not_executed`-tilassa. Blocking gap, piilotettu oletus tai hyväksymätön lähde estää hyväksyttävän packetin.

Approved-vastauksen tulee sitoa jatko täsmälliseen packettiin:

```text
milestone_id: milestone-001
blueprint_gate_packet: .ballet/outputs/blueprint-gate-packet.yaml
blueprint_gate_packet_sha256: <64 lowercase hex characters>
source_sha: <40 or 64 lowercase hex characters>
```

Ballet core käsittelee cross-Loop-inputin opaque-datana eikä parsii tai valvo tämän projektin packet-kenttiä, polkuja tai hasheja. Vastaanottava milestone-agentti parsii dokumentoidun muodon, vaatii täsmälleen yhden kutakin kenttää, tarkistaa `milestone-NNN`-ID:n ja canonical packet-polun sekä laskee packetin ja kaikkien sen viittaamien artifactien raw-byte SHA-256 -hashit uudelleen. Myöhemmissä delivery- ja release-vaiheissa agentit todentavat milestone-manifestin packet ID/hash-, source SHA-, snapshot-, milestone- ja input-path-sidokset alkuperäiseen hyväksyntään projektin artifacteista; puuttuva tai ristiriitainen sidos pysäyttää Stepin.

## Projektikohtainen artifact-sopimus

Agentit todentavat projektin skillien ja artifact catalogin kuvaamat rakenne-, path-, scope-, authority-, viite-, hash-, coverage- ja gate-invariantit suoraan persistoiduista YAML-artifacteista ja niiden inputeista. Kaikki YAML-artifactit sisältävät `artifact_contract_version: 1`. `source_snapshot` on itsenäinen inventory eikä sisällä `input_files`-kenttää; kaikilla muilla generated artifacteilla se on pakollinen ja ei-tyhjä. Canonical-polut ovat:

- Blueprint: `source-snapshot.yaml`, `specification-gaps.yaml`, conditional `decision-requests.yaml`, `roadmap.yaml`, `domain-map.yaml`, `c4-context-container.yaml`, `quality-scenarios.yaml`, `threat-model.yaml`, `ux-information-architecture.yaml`, `test-strategy.yaml`, `traceability-manifest.yaml`, `blueprint-review.yaml` ja `blueprint-gate-packet.yaml` aktiivisessa `.ballet/outputs/`-hakemistossa.
- Milestone: `milestone-manifest.yaml`, `issue-drafts.yaml`, `implementation-plan.yaml`, `test-plan.yaml`, `acceptance-evidence.yaml` ja `staging-report.yaml` hakemistossa `.ballet/outputs/milestones/<milestone-id>/`.
- Release: `.ballet/outputs/releases/<version>/release-manifest.yaml`.

Markdown saa olla vain ihmisluettava renderöinti. Se ei korvaa YAML authority-, viite-, hash- tai evidenssisopimusta. Kirjoittava agentti ja myöhempi riippumaton verifieri tarkistavat artifactin projektikohtaiset invariantit ennen etenemistä ja raportoivat käytetyt inputit, hashit ja tarkistustulokset.

## Approval- ja turvallisuusrajat

Eksplisiittinen human approval vaaditaan ennen GitHub- tai muuta ulkoista kirjoitusta, releasea, deployta, cloud-toimea, credentialien käyttöä, production-dataa, destruktiivista toimea tai hyväksytyn lähdepäätöksen muutosta. Blueprint-paketissa ehdotettu toiminto ei ole vielä lupa suorittaa sitä. Älä koskaan tallenna salaisuutta artifactiin, runtime-summaryyn tai logiin.

Issue slicing tuottaa aina paikalliset `draft_only`-luonnokset; se ei hae eikä kirjoita GitHubia. Release-agentti pysähtyy ilman hyväksyttyä implementation-gatea sekä saman scopen release- ja environment-contracteja. Uutta provideria, ympäristöä, workflow'ta tai rollback-strategiaa ei keksitä.

## Pakollinen evidenssi

Jokainen Step raportoi input source/artifact -viitteet, kirjoitetut polut ja SHA-256:t, Git SHA:n silloin kun soveltuu, checkit/komennot tuloksineen, coverage/gapit/riskit, kaikki ulkoiset toimet ja outcome-perusteen. Pysähdy source-ristiriitaan, stale/unknown-viitteeseen, scope-vuotoon, hash-driftiin, puuttuvaan päätökseen/hyväksyntään, salaiseen tietoon tai toistuvaan muuttumattomaan evidenssiin.
