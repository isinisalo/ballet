# Managed project -lähteiden ohjeet

Nämä ohjeet koskevat `.ballet/`-hakemistoa juuren `AGENTS.md`-ohjeiden lisäksi.

## Source plane

- `.ballet/source-plane.yaml` on hakemistojen, scopejen, statusten ja precedence-sääntöjen koneellinen kartta.
- `.ballet/goals/`, `.ballet/adr/` ja `.ballet/specifications/` ovat human-owned sourceja. Vain hyväksytty status on blueprintin auktoritatiivinen WHAT/WHY- tai scoped HOW -lähde.
- `.ballet/proposals/` sisältää agentin ehdotuksia ja päätöspyyntöjä, jotka odottavat ihmisen päätöstä. Agentti ei saa muuttaa niitä hyväksytyksi sourceksi.
- `.ballet/outputs/` sisältää hyväksytyistä sourceista johdettuja artifacteja. Artifact ei saa toimia oman päätöksensä lähteenä eikä viitata hyväksymättömään sourceen.
- `.ballet/project.json` ja `.ballet/instructions/` ohjaavat orchestratorin toimitusketjua. Ne eivät muuta managed-productin WHAT/WHY:tä.
- Juuren `DESIGN.md` kuvaa tässä repossa Ballet-orchestratorin komentokeskusta. Sitä ei saa käyttää yritysseurantatuotteen UI-päätöksenä ilman eksplisiittistä, samaan scopeen kuuluvaa sourcea.
- `managed-product`-scopen `code_paths` on tällä hetkellä tyhjä. Implementation- ja release-Stepien pitää palauttaa `blocked`, kunnes tämä konfiguraatio ajetaan varsinaisessa tuoterepossa tai source planeen on määritetty todelliset koodi- ja sopimuspolut.

## Kirjoitus- ja hyväksyntärajat

- Säilytä hyväksyttyjen Goal-, ADR- ja muiden sourcejen semanttinen sisältö. Korjaa vain yksiselitteinen metadata- tai canonical path -virhe ja kirjaa korjaus raporttiin.
- Kirjaa puuttuva päätös `specification_gaps`- ja tarvittaessa `decision_requests`-artifactiin. Älä täytä aukkoa agentin oletuksella.
- Human gate -vastaus saa edetä blueprintiin vasta, kun päätös on kirjoitettu hyväksyttyyn sourceen ja source snapshot on muodostettu uudelleen.
- Älä kirjoita GitHubiin, julkaise, deployaa tai käytä cloud-credentialeja `.ballet`-artifactin perusteella ilman erillistä hyväksyntää.

## Validointi

Aja `.ballet`-source-, proposal-, output-, Loop- tai agenttisopimuksen muutoksen jälkeen `npm run test`, `npm run lint`, `npm run build` ja `git diff --check`. Artifact-muutoksessa todenna lisäksi projektin skillien kuvaamat rakenne-, scope-, authority-, viite-, hash-, coverage- ja gate-invariantit suoraan persistoiduista tiedostoista ja raportoi tulokset.
