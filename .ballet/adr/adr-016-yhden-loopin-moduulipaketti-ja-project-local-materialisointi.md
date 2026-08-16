---
id: adr-016
title: Yhden Loopin moduulipaketti ja project-local materialisointi
status: accepted
createdAt: '2026-08-16T00:00:00.000Z'
updatedAt: '2026-08-16T00:00:00.000Z'
tags:
  - arkkitehtuuripaatos
  - loop-moduulit
  - supply-chain
version: 1
---

# Yhden Loopin moduulipaketti ja project-local materialisointi

## Konteksti

ADR-014 rajasi ensimmäisestä authoring-mallista template packin, katalogin ja clone-to-project-toiminnon pois säilyttääkseen yhden versionhallittavan runtime-totuuden. Käyttäjän hyväksymä uusi tarve on jakaa yksi valmis Loop ymmärrettävänä, tarkastettavana artifactina ilman live-riippuvuutta Ballet-asennuksesta tai ulkoisesta registrystä.

Arkkitehtuuria ohjaavat `goal-002`, `goal-004`, `goal-007`, `goal-010`, QS-002, QS-004, QS-009, CON-001, CON-003 ja CON-007. Suurin riski on, että epäluotettu prompttisisältö, profile-oletus tai osittainen tiedostokirjoitus muuttaa suoritusta ilman käyttäjän tietoa.

## Vaihtoehdot

1. Live-linkitetty registry/template runtime-lähteenä. Hylätty: rikkoo immutable snapshot- ja repository-owned source-of-truth -rajan.
2. Kokonaisen projektigraafin paketti ExecutionProfileineen. Hylätty: siirtää projektin flow-, repair-, permission- ja machine-valinnat package-authorille.
3. Yhden Loopin portable authoring artifact, joka inspectoidaan ja materialisoidaan nykyisiin project-local primitiveihin. Valittu.

## Päätös

### Kolme eri elinkaarikäsitettä

- `LoopModulePackageV1` on siirrettävä, kanonisesti serialisoitava authoring artifact. Se ei ole runtime-entity.
- `Installed Loop` on strict-v10 `ProjectLoop` ja sen project-local instruction/skill-resurssit sekä erillinen provenance/ownership-merkintä.
- `Loop Run` on nykyinen immutable snapshotista luotu runtime-instanssi. Se ei tunne module ID:tä, katalogikategoriaa, package-lähdettä tai provenancea.

### Package-formaatti

Yksi UTF-8 JSON-envelope sisältää täsmälleen yhden module-local Loop-määrittelyn, manifestin, resurssit, profile-slotit, State-contractin, capabilityt, `recommendedConnections`-suhteet ja permission/network-yhteenvedon. Se kieltää Orchestratorin, project-global `loopEdges`-yhteydet, ExecutionProfilet, absoluuttiset polut, symlinkit, binäärit, salaisuudet, runtime-historian, `.git/ballet`-datan, script hookit ja post-install-komennot. Unknown-kentät, schema downgrade, invalid UTF-8, duplicate local ID:t ja rajat ylittävä sisältö hylätään.

Package käyttää vain module-local kebab-case-avaimia. Installer muodostaa project-validit globaalit ID:t deterministisesti module ID:n namespaceen ja tekee ristiriidat näkyviksi install planissa. Oletusasennus on aina `Install as new Loop`; se ei ylikirjoita olemassa olevaa Loopia tai resurssia.

### Profile-slot- ja permission-malli

Providerilla suoritettava module-node viittaa `profileSlot`-avaimeen, ei ExecutionProfile-ID:hen. Slot kuvaa sallitut providerit sekä `required | forbidden | optional` network-vaatimuksen. Installer mapittaa slotin olemassa olevaan project-local ExecutionProfileen ja ehdottaa vain yhteensopivia kandidaatteja.

Package ei saa pyytää ulkoisia kirjoituksia: `externalWrites` on literal `false`. Network-required ei mapitu network-off-profiiliin, eikä network-forbidden network-on-profiiliin. V1 ei päättele machine-local oikeuksia package-sisällöstä.

### Resource namespace ja ownership

Instructionit materialisoidaan `.ballet/instructions/modules/<module-id>/`-namespaceen ja saavat globaalin `project:module-<module-id>-<key>`-ID:n. Skillsit materialisoidaan `.agents/skills/modules/<module-id>/<key>/SKILL.md`-polkuun ja saavat vastaavan path-derived `project:modules/<module-id>/<key>`-ID:n. Install plan näyttää täsmälliset polut, hashit ja diff-yhteenvedon ennen kirjoitusta.

`.ballet/loop-modules/installed.json` sisältää vain source-, package hash-, installed loop-, resource ownership-, mapping- ja installed-at-provenancea. `exact | modified | missing-resources` lasketaan nykyisestä Loopista ja resursseista; tallennettu status ei ole totuuslähde.

### State-contract ja capabilityt

State-contractilla on vakaa ID, versio, description, initial-arvo ja yhteensopivuutta varten required top-level key -joukko. Install plan vertaa sitä muihin tunnetun provenance-ketjun State-contracteihin ja raportoi `compatible | incompatible | unknown`; se ei muuta strict-v10 `ProjectLoop`-skeemaa eikä runtime Statea.

`requires` kuvaa vain todellisen hard precondition -capabilityn. `provides` kuvaa Loopin tuottamat capabilityt. `recommendedConnections` on soft authoring-suositus `flow | repair`-yhteydelle; installer ei lisää project-global `loopEdges`-yhteyttä. Käyttäjä omistaa projektin varsinaisen flow- ja repair-graafin.

### Install-, export- ja remove-transaktio

Inspection ei kirjoita. Plan sisältää materialisoitavan Loopin, kaikki resource-polut ja hashit, ID-remappingin, profile-slot-mappingit/kandidaatit, permission/network- ja State-contract-yhteensopivuuden, konfliktit, provenance-lähteen ja exact diff summaryn.

Commit muodostaa planin uudelleen nykyisestä project state -tilasta saman project-config mutation queuen sisällä ja hylkää stale planin. Uudet module-owned resurssit ja provenance kirjoitetaan turvallisesti ensin ja `.ballet/project.json` viimeisenä atomisesti. Config-write-virhe siivoaa tämän yrityksen uudet resurssit ja provenance-merkinnän, joten config ei viittaa puuttuvaan resurssiin.

Export kerää valitun Loopin transitiivisesti viittaamat project instructionit ja skillsit, muuntaa ExecutionProfile-viitteet sloteiksi ja jättää profilet, credentialit, local state -arvot, absoluuttiset rootit ja console historian ulos. Kanoninen serialisointi ja SHA-256 tekevät artifactista todennettavan.

Install, export, adopt, update ja remove estetään relevantin Loopin aktiivisen Runin aikana. Remove poistaa vain provenancen omistaman resurssin, jota mikään muu composition ei viittaa; epäselvä tai jaettu omistajuus jää näkyväksi orphan-resurssiksi.

### Trust- ja approval-raja

Importoidut instructionit ja skillsit ovat suoritukseen vaikuttavaa epäluotettua prompttisisältöä. Ennen installia käyttäjälle näytetään lähde, package SHA-256, permission/network-yhteenveto, mappingit, konfliktit ja muuttuvat tiedostot. Selain lähettää package-JSONin, ei palvelinpolkua. API ei tee remote fetchiä.

Yksiselitteinen, yhteensopiva ja konfliktiton plan voidaan hyväksyä yhdellä vahvistuksella. Mapping-, conflict-, permission- tai State-contract-päätös vaatii previewn. Install commit on erillinen, eksplisiittinen hyväksyntä eikä inspection tai Add-painike anna ulkoisen kirjoituksen valtuutta.

## ADR-014-suhde

Tämä ADR osittain supersedoi ADR-014:n rajauksen, jonka mukaan V1:ssä ei ole template packia, katalogia tai clone-to-project-toimintoa. ADR-014:n copy-to-project-, repository-owned data- ja no-live-runtime-dependency-periaatteet säilyvät muuttumattomina. Runtime suorittaa edelleen vain materialisoitua project-local dataa.

## Seuraukset

- Project config pysyy strict v10:nä; provenance ei vaadi v11-migraatiota.
- Package-skeema pysyy erillään `ProjectLoop`-skeemasta ja tarvitsee oman versionoinnin.
- Katalogi voi listata vain paikallisia versionhallittavia packageja; remote registry ja automaattiset päivitykset ovat V1:n ulkopuolella.
- Turvallinen install vaatii tiedostojärjestelmätransaktion kompensaation ja nykytilaan sidotun plan hashin.
- Package-semanttiikan muuttaminen, remote source tai executable hook vaatii uuden ADR:n ja trust-mallin arvioinnin.

## Evidenssi ja review trigger

Toteutusankkurit ovat `shared/domain/loopModules.ts`, `shared/api/loop-module-schemas.ts`, `backend/loop-modules/`, module API, Loop Library -UI sekä `installable-loop-modules`-initiativien testit. Päätös arvioidaan uudelleen ennen remote registryä, automaattista päivitystä, package codea tai project config -version muutosta.
