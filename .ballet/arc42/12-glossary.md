---
id: arc42-section-12
title: Sanasto
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-19'
version: 6
tags:
  - arc42
  - glossary
arc42Section: 12
---

# 12. Sanasto

## Tarkoitus

Tämä osio määrittää project-, authoring-, runtime-, provider-, persistence-, module- ja UI-termit, joiden täsmällinen yhteinen merkitys vaikuttaa arkkitehtuuriin, toteutukseen tai handoffiin. Lähdekoodin nimet säilyvät englanniksi, vaikka selitys on suomeksi.

## Tila

Sanasto kuvaa toteutetun strict-v11 config/domain/snapshot/module/runtime-rajan ja Graph/Loop-authoring-mallin. Historiallinen Loop Engineer -termi sekä legacy `Step`, `Transition` ja vanha `StepResult` eivät ole aktiivisen runtime- tai UI-domainin termejä.

## Project ja authoring

| Termi | Määritelmä |
| --- | --- |
| Project truth | Versionhallittu, ihmis- ja agenttikatselmoitava tieto checkoutissa: Goalit, ADR:t, arc42, `.ballet/project.json`, instructionit, skillit, source ja design. Eri asia kuin machine-local runtime state. |
| Project Loop | `.ballet/project.json`:ssa materialisoitu strict-v11 `Loop`, joka sisältää `accepts`/`provides`-capabilityt, entry `WorkLoopNode` -viitteen, compositen ja sisäiset Edget. |
| Loop | Nimetty runtime- ja authoring-raja, joka koostuu `WorkLoopNode`-rakenteista ja jonka välillä `LoopEdge` määrittää flow/repair-yhteyksiä. |
| Work Loop Node | Yksi tavoite, joka koostuu täsmälleen yhdestä `WorkNode`- ja yhdestä `ValidationNode`-vaiheesta. |
| WorkNode | Rooli, joka tuottaa rajatun työn ja voi ehdottaa State patchia strict output -sopimuksella. |
| ValidationNode | Rooli, joka arvioi Work-tuloksen ja palauttaa PASS-, LOCAL_RETRY-, ORCHESTRATOR_REPAIR-, needs_input- tai terminal-failure-semantikan strict outputissa. |
| Edge | Valitun Loopin sisäinen, detail-tasolla omistettu yhteys composite-rakenteen ja terminal targetin välillä. |
| LoopEdge | Project-global yhteys Loopien välillä. `flow` määrittää normaalin Loop-jatkumon ja `repair` lähdekohtaisen repair allowlistin. |
| Context projection | Loop Engineerin read-only-taso, joka näyttää Project intention, Loop systemin ja observable outcomes lisäämättä runtime-entiteettejä. |
| Composition projection | Loop Engineerin taso, joka näyttää yhden black-box-solmun per Loop sekä täsmälleen project-global `LoopEdge` -topologian. |
| Detail projection | Valitun Loopin sisäinen authoring-taso, joka näyttää sen `WorkLoopNode`-rakenteet, `Edge`-yhteydet ja node-editorit. |
| Edge ownership | Sääntö, jonka mukaan composition omistaa `LoopEdge`:t ja detail omistaa valitun Loopin sisäiset `Edge`:t; tasot eivät kirjoita toistensa yhteyksiä. |
| ExecutionProfile | Project-local provider/model/reasoning/permission-kokoonpano, joka on erotettu Node-roolin primary instruction- ja skill-valinnoista. |
| Primary instruction | Yksi Node-roolille valittu pääohje, joka sijoitetaan compositioniin System-tekstin jälkeen. |
| Skill | Project-local resurssi, joka tuo rajatun workflow- tai domain-ohjeen execution compositioniin vakaassa järjestyksessä. |
| Resource closure | Kaikki target Loopin/Node-roolin deterministisesti tarvitsemat profiili-, instruction-, skill- ja schema-resurssit. |
| Strict-v10 | Poistettu project schema -versio, jota strict-v11 repository ei lue, muunna eikä oletusarvoista. Historialliset dokumentit voivat kuvata sen aikaista baselinea. |
| Strict-v11 | Nykyinen project config/domain/snapshot/module hard cut: project-global graph ja first-class Loop capability metadata ilman v10 readeria tai rinnakkaista topology-mallia. Orchestrator-owned dispatch ja Graph/Loop-UI valmistuvat myöhemmissä vaiheissa. |
| Graph | V11 `ProjectAutomationConfig`-aggregaatin project-global route-policy-projektio, joka omistaa flow- ja repair-allowlistat. Ei client state eikä erillinen runtime-entiteetti. |
| Loop capability metadata | V11:n koneellisesti validoitava, geneerinen kuvaus Loopin tarjoamista ja tarvitsemista capabilityistä; project-workflow'n nimiä ei kovakoodata platformiin. |
| Route candidate | Graphissa persisted source/target/kind/capability/description-yhteys, jonka Orchestrator voi valita vain immutable snapshotin allowlistista. |
| LoopNode | Graph Engineeringin näkymänode yhdelle `ProjectLoop`ille. Ei uusi runtime-entiteetti eikä `ProjectWorkLoopNode`. |

## Runtime ja control flow

| Termi | Määritelmä |
| --- | --- |
| Root Run | Yhden target Loopin immutable snapshotista käynnistyvä, omalla branch/worktreellä eristetty suorituskokonaisuus ja State-omistaja. |
| Immutable snapshot | Root Runin alussa jäädytetty reachable automation, resource closure ja display/runtime metadata, jota checkoutin myöhempi muutos ei muuta. |
| State | Root Runin omistama, rajattu canonical JSON -koordinaatioarvo; ei dokumenttien, diffien tai runtime-lokien kopio. |
| `Arc42MethodStateV1` | Project-local arc42-menetelmän versionoitu State-sopimus, joka säilyttää nykytilan ja vakaat viitteet ilman pitkäikäisen dokumentaation kopiointia. |
| State patch | Work/Validation-outcomen schema-validi ehdotus State-muutokseksi, jonka runtime soveltaa vain current revision -ehdon ja sallittujen polkujen mukaisesti. |
| State revision | Immutable patchin jälkeinen State, jolla on monotoninen revision-numero, hash ja outcome/control-evidenssi. |
| Outcome | Roolikohtaisen strict output -skeeman läpäissyt tulos, jonka runtime voi commitoida; providerin vapaa teksti ei ole outcome. |
| Attempt | Rajatun Work/Validation-suorituksen laskuri, jota runtime kasvattaa eikä UI päättele lokista. |
| Local retry | Validationin rajattu pyyntö ajaa sama Work-vaihe uudelleen nykyisellä Statella ilman user-authored retry-edgeä. |
| Repair Request | Immutable Validation-finding, joka kuvaa tarvittavan capabilityn/outcomen valitsematta target Loopia. |
| Repair allowlist | Lähde-Loopin `repair` LoopEdgeistä muodostuva sallittu Orchestrator-target-joukko. |
| Repair frame | Persistoitu call-frame, joka säilyttää caller Loopin/Validationin ja mahdollistaa LIFO-returnin repair-targetista. |
| Continuation | Runtime-owned paluuosoite tai seuraava control-flow-askel; agentti tai State patch ei valitse sitä. |
| Flow dispatch | V11-targetin Orchestrator-valinta completed top-level Loopin outgoing flow candidateista. Nolla candidatea päättää Root Runin; flow ei luo repair-framea. |
| LIFO return | Sisäkkäisen repairin paluu viimeksi avattuun frameen ja samaan caller Validationiin. |
| `needs_input` | Pysähtymistila, jossa puuttuva WHAT/WHY, prioriteetti, merkittävä päätös tai ambiguous repair-target vaatii ihmisen valinnan. |
| Finalization | Root Runin terminal-tilan, viimeisen canonical control-faktan ja worktree-evidenssin commitointi; ei automaattinen merge/push. |
| Cancellation barrier | Persistoitu raja, jonka jälkeen saapuva provider-payload ei saa muuttaa outcomea, Statea tai continuationia. |
| Reconciliation | Startup-prosessi, joka yhdistää commitoidun Root Run-, task-, queue- ja State-tilan ilman replayta tai duplikaattivaikutusta. |
| Interrupted task | Ennen restartia running-tilassa ollut provider-tehtävä, joka merkitään keskeytyneeksi eikä ajeta automaattisesti uudelleen. |
| Scheduled Root Run | Project-local schedule-triggerin käynnistämä tavallinen Root Run, jolla on samat snapshot-, permission- ja persistence-invariantit. |

## Provider ja execution

| Termi | Määritelmä |
| --- | --- |
| Execution composition | Tavutasoinen kokonaisuus järjestyksessä System → primary instruction → vakaasti järjestetyt skillit → Task Envelope → role/output schema. |
| Task Envelope | Runtime-tehtävän rajattu payload, joka kuvaa tehtävän, nykytilan/viitteet, sallitut resurssit ja odotetun tulosmuodon providerille. |
| Composition hash | Exact composition -sisällöstä laskettu tunniste, jolla saman inputin determinismi ja provenance voidaan todentaa. |
| Provider adapter | Portti, joka mapittaa canonical execution taskin Codex- tai Copilot-protokollaan ja normalisoi tapahtumat/outcomen muuttamatta runtime-semanticsia. |
| Codex app-server adapter | Codex-providerin toteutus provider adapter -portille. |
| Copilot SDK adapter | GitHub Copilot -providerin toteutus samalle portille. |
| Provider FIFO lane | Yhden providerin persisted/managed jonotuskaista, joka säilyttää tehtävien järjestyksen; eri provider-kaistat voivat edetä rinnakkain. |
| Preflight | Ennen jonotusta tehtävä profile-, resource-, permission-, schema- ja adapter-capability-validointi. |
| No fallback | Invariantti, jonka mukaan puuttuva tai invalidi model/profile/provider/resource pysäyttää tehtävän eikä vaihdu hiljaisesti vaihtoehtoon. |
| Strict output schema | Roolikohtainen koneellisesti validoitava tulosmuoto, jonka läpäisy tarvitaan ennen canonical outcomea. |
| Normalized event | Provider-kohtaisesta protokollasta yhteiseen runtime/UI-tapahtumamuotoon mapattu havainto; se ei itsessään päätä control flow’ta. |

## Persistence ja deployment

| Termi | Määritelmä |
| --- | --- |
| Machine-local runtime state | `.git/ballet`-hakemiston SQLite-, worktree- ja lifecycle-data, jota ei versionhallita project truthina. |
| Canonical persistence | SQLiteen atomisesti commitoitu Root Run-, task-, outcome-, State- ja control-flow-totuus, josta runtime read -projektio johdetaan. |
| Runtime read model | Storeista johdettu, shared DTO:n mukainen canonical UI-projektio; selain ei kokoa vaihtoehtoista statusta provider-tekstistä. |
| Atomic revision | Transaktio, jossa State/outcome/control-flow-vaikutus näkyy kokonaan tai ei lainkaan. |
| Checkout identity | Täsmällinen repository/checkout-raja, joka erottaa palvelun, tietokannan ja lifecycle-kontekstin toisista checkouteista. |
| Root Run worktree | `.git/ballet/worktrees/<root-run-id>`-työalue ja dedicated branch, jossa Node-kirjoitukset tapahtuvat. |
| Active checkout | Käyttäjän varsinainen Git-working tree, jota Node-suoritus ei muokkaa. |
| Loopback API | Vain paikalliseen loopback-osoitteeseen bindattu HTTP-rajapinta React UI:lle ja local clientille. |
| launchd lifecycle | macOS:n checkout-kohtaisen Ballet-palveluprosessin install/start/stop/status-hallinta. |
| Verified distribution | macOS arm64/x64 -bundle, jonka sisältö/provenance tarkistetaan ennen valtuutettua aktivointia. |

## Loop module

| Termi | Määritelmä |
| --- | --- |
| Loop Module Package | Siirrettävä strict yhden Loopin authoring JSON, joka inspectoidaan ja materialisoidaan ennen runtimea; ei live runtime source. |
| Inspect | Paketin koko-, UTF-8-, schema-, canonicalization-, hash-, trust- ja issue-tarkistus ilman project-mutaatiota. |
| Install plan | Current project stateen sidottu deterministic ehdotus namespacesta, profile mappingista, resurssikirjoituksista, Loopista ja recommended connections -tiedosta. |
| Materialisointi | Pakettidatan kirjoittaminen olemassa oleviksi project-local Loop-, profile-, instruction- ja skill-primitiveiksi. |
| Config-last commit | Mutaatioperiaate, jossa uudet resurssit/provenance kirjoitetaan ennen project configia, jotta config ei viittaa puuttuvaan sisältöön. |
| Installed Loop | Materialisoitu strict-v11 Project Loop capabilityineen ja sen project resources sekä non-runtime provenance/ownership metadata. |
| Profile slot | Paketin paikallinen execution-vaatimus, joka mapitetaan installissa olemassa olevaan yhteensopivaan `ExecutionProfile`:en. |
| Recommended connection | Paketin neuvoa antava cross-Loop-yhteys, jota ei materialisoida automaattisesti authoritative `LoopEdge`:ksi. |
| Canonical export | Loopin resource closuresta vakaasti järjestetty JSON ja SHA-256, joka ei sisällä runtime-tilaa tai jaon ulkopuolista dataa. |
| Provenance status | Nykyisestä Loop/resource-sisällöstä johdettu `exact`, `modified` tai `missing-resources`; ei persistentoitu authority field. |
| Shared resource | Resurssi, johon viittaa useampi project-kohde ja jota module removal ei saa poistaa omistajuusarvauksen perusteella. |

## UI ja operointi

| Termi | Määritelmä |
| --- | --- |
| Loop Engineer | Historiallinen ADR-017:n authoring workspace -nimi; superseded aktiivisessa UI:ssa Graph Engineeringillä ja Loop Engineeringillä. |
| Graph Engineering | Default authoring-näkymä: kaikki `ProjectLoop`→`LoopNode`-projektiot ja persisted project-global route-policy ilman sisäisiä Work/Validation-nodeja. Orchestrator-editori on inspectorissa; erillinen control-node on pending. |
| Loop Engineering | Selected-Loop-only authoring-näkymä: valitun Loopin `ProjectWorkLoopNode`-kompositio, sisäiset Edget ja terminal targetit ilman project-global routeja tai Orchestrator-controlia. |
| Mission | Run mission control -välilehti, joka korostaa nykyisen tavoitteen, aktiivisen canonical-polun ja operaattorin seuraavan merkityksellisen havainnon. |
| All Loops | Run-näkymä immutable snapshotin koko Loop-topologiasta; ei authoring-editori eikä legacy-nimitys yhdelle konfiguraatiolistalle. |
| Live inspector | Canonical Run/read-model-dataan sidottu paneeli position-, role-, profile-, attempt-, revision-, repair-, return- ja finalization-tiedoille. |
| Active route | Snapshotin ja commitoidun control flow’n perusteella korostettu kuljettu/aktiivinen reitti. |
| Decorative visualization | Artwork, orbit, glow, väri tai liike, joka tukee lukemista mutta ei ole prosentti, ETA, elapsed-aika tai uusi runtime-state. |
| Human Node response | Operaattorin schema-validi Work- tai Validation-vastaus, joka kulkee saman application/runtime-rajan kautta kuin provider-outcome. |
| Canonical projection | UI-esitys, jonka jokainen semanttinen kenttä on jäljitettävissä project truthiin, immutable snapshottiin tai canonical persistenceen. |

## Menetelmä ja evidenssi

| Termi | Määritelmä |
| --- | --- |
| arc42 Template | `.ballet/arc42/`-hakemiston 12-osioinen versionhallittu arkkitehtuurin tietorakenne. |
| arc42 Method | Kuusi toistuvaa arkkitehtuuriaktiviteettia, jotka Balletissa on toteutettu project-local Loopseina jatkuvalla feedbackilla. |
| 6+1 | Kuusi arc42-aktiviteetti-Loopia sekä niitä tukeva continuous-learning-Loop. |
| Initiative | Rajattu muutos, jolla on BRIEF-, PLAN-, EVIDENCE- ja REVIEW-artefaktit. |
| Stable ID | Sisältöpäivityksissä säilyvä tunniste, jolla Goal/REQ/QS/ADR/CON/BB/RT/DEP/TEST/EVID-ketju pysyy ratkaistavana. |
| Trace chain | Goal/REQ → QS → ADR/CON → BB/RT/DEP → TEST/monitor → EVID -suhdeketju. |
| Handoff | Tiivis pysyvä kuvaus nykytilasta, evidenssistä, löydöksistä, avoimista kysymyksistä ja yhdestä seuraavasta hyväksytystä toimesta. |
| Fact | Kanonisesta lähteestä tai evidenssistä suoraan todennettu tieto. |
| Decision | Goalin/ADR:n tai eksplisiittisen ihmisvaltuutuksen omistama hyväksytty valinta. |
| Assumption | Todentamaton lähtökohta, jolla on omistaja ja review-trigger. |
| Hypothesis | Ehdotettu kausaalinen parannus, jolla on baseline ja mitattava odotus. |
| Finding | Evidenssiin perustuva havainto, joka ei keksi intentiota. |
| Open question | Puuttuva tieto, joka voi vaatia `needs_input`-tilan. |
| Conformance review | Rajatun diffi-/toteutusmuutoksen vertailu hyväksyttyyn arkkitehtuuriin muuttamatta arvioitavaa implementationia. |
| External write | Push, merge, release, deploy, rollback, viesti tai muu mutaatio hyväksytyn Root Run -worktreen ulkopuolelle. |

## Kanoniset lähteet

Hyväksytyt Goalit/ADR:t, shared domain -terminologia ja runtime-sopimukset menevät tämän yhteenvedon edelle ristiriidassa; ristiriita korjataan sitten sanastoon, ei jätetä rinnakkaiseksi tulkinnaksi.

## Relevantit päätökset

`adr-002`, `adr-005`, `adr-007`, `adr-011`, `adr-013`, `adr-015`, `adr-016`, `adr-017` ja `adr-018`.

## Evidenssi

Termit esiintyvät project configissa, source/shared contracts -rajapinnoissa, instructioneissa, skilleissä ja State-sopimuksessa. Legacy-termihaku tarkistaa aktiivisten lähteiden strict-v11-yhdenmukaisuuden muuttamatta historiallista evidenssiä.

## Avoimet kysymykset

- Termi lisätään vain, jos epäyhtenäinen tulkinta vaikuttaa arkkitehtuuriin, runtimeen, käyttöliittymään tai handoffiin.

## Seuraava katselmointiperuste

Katselmoi osio, kun uusi vakaa domain-termi hyväksytään tai evaluation löytää käytännössä haitallisen ambiguiteetin.
