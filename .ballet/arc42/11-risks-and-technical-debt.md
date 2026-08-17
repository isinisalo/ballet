---
id: arc42-section-11
title: Riskit ja tekninen velka
status: accepted
createdAt: '2026-08-16'
updatedAt: '2026-08-17'
version: 3
tags:
  - arc42
  - risks
  - technical-debt
arc42Section: 11
---

# 11. Riskit ja tekninen velka

## Tarkoitus

Tämä osio ylläpitää arkkitehtuurin kannalta merkittävät riskit, teknisen velan ja evidenssivajeet. Jokaisella riskillä on havainto, vaikutus/todennäköisyys, vaste, trace ja tila. Riski sulkeutuu vain nimetyn evidenssin tai hyväksytyn päätöksen perusteella.

## Tila

RISK-001–RISK-010 ovat aiemman baselinen riskit. RISK-011 ja RISK-012 on lisätty nykyisen dokumentaatio-, lint- ja Run UI -evidenssin perusteella. `controlled` tarkoittaa, että arkkitehtuurivaste on olemassa; se ei tarkoita riskin mahdottomuutta.

## Riskirekisteri

| ID | Tyyppi | Finding | Vaikutus / todennäköisyys | Vaste ja trace | Tila |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | evidenssivaje | Uudella 6+1 Methodilla ei ole valmistunutta end-to-end-initiative-evidenssiä. | keskisuuri / korkea ennen pilottia | Aja rajattu pilotti, arvioi QS-006/EVID-006 ja vertaa METHOD-HEALTH-baselineen. | open |
| RISK-002 | dokumentaatiodrift | Aktiivisissa Goal-yhteenvedoissa ja tukidokumenteissa oli strict-v9-, Step/Transition-, vanha All Loops- ja 18 Work Loop Node -sanastoa strict-v10-toteutuksen jälkeen. Historialliset migration/initiative-tiedostot sisältävät tarkoituksella aikakautensa termejä. | keskisuuri / havaittu | Synkronoi vain aktiiviset kanoniset lähteet strict-v10-termeihin, säilytä historiallinen evidenssi ja tarkista rajatulla legacy-haulla sekä TEST-005:llä. | mitigated by active-source sync; monitor |
| RISK-003 | reititysambiguiteetti | Laaja repair-kuvaus voi sopia useaan target Loopiin. | korkea / mahdollinen | Capability-specific-kuvaus ja source allowlist; Orchestrator palauttaa `needs_input`, jos evidenssi ei erota targetia. QS-003. | controlled |
| RISK-004 | ulkoinen kirjoitus | Release/deploy/rollback voi ylittää käyttäjän nykyisen valtuutuksen. | korkea / mahdollinen | Release default flow’n ulkopuolella, exact Human Validation ja `needs_input` ennen hyväksymätöntä toimintoa. QS-007. | controlled |
| RISK-005 | State misuse | Agentti voi yrittää kopioida dokumentteja Stateen tai koodata continuation-päätöksen patchiin. | keskisuuri / mahdollinen | Rajattu `Arc42MethodStateV1`, strict patch evidence ja reviewer validation. | controlled; verify in pilot |
| RISK-006 | menetelmächurn | Scheduled learning voi kirjoittaa prosessia/dokumentteja model-preferenssin perusteella. | keskisuuri / mahdollinen | Primary-source-evidenssi, materiality threshold, no-change outcome ja ihmisarvio käyttäytymismuutoksille. QS-008. | controlled; verify in pilot |
| RISK-007 | provider capability | Valittu malli tai provider-profiili voi olla poissa käytöstä tai muuttua. | keskisuuri / mahdollinen | Eksplisiittinen preflight, nimetty profile ja 0 fallbackia; muutos arvioidaan ennen profile-mutaatiota. QS-011. | accepted operational risk |
| RISK-008 | prompt supply chain | Importoidut instructionit/skillit voivat vaikuttaa provider-suoritukseen. | korkea / mahdollinen | Strict local JSON, source/hash/diff/permission-preview, ei code/hooks/remote fetchiä ja eksplisiittinen install. QS-009. | controlled |
| RISK-009 | osittainen/stale install | Concurrent config/resource -muutos tai write failure voi jättää rikkinäisiä referenssejä. | korkea / mahdollinen | Shared mutation queue, current-state plan hash, commit-time re-plan, exclusive namespace, config-last write ja failure cleanup -testit. | controlled |
| RISK-010 | provenance drift | Tallennettu metadata voisi väittää asennetun Loopin olevan muuttumaton, vaikka sisältö on muuttunut. | keskisuuri / todennäköinen ajan myötä | Johda `exact`/`modified`/`missing-resources` nykyisestä Loop/resource-sisällöstä; älä persistoi statusta totuutena. | controlled |
| RISK-011 | ylläpidettävyysvelka | Paikallisen lint-baselinen 14 warningia ovat tunnettu tekninen velka core- ja testitiedostoissa; dokumentaation kasvu lisää lisäksi stale source anchor -riskiä. | keskisuuri / havaittu | Hyväksymisraja: lint error = 0 ja warning-määrä ≤ 14; uusi warning estää handoffin. Nimeä baseline EVIDENCEssä, pidä lähdeankkurit arkkitehtuuritasolla ja avaa erillinen velanpoistoaloite ennen tuotantoa. | open |
| RISK-012 | UI:n väärintulkinta | Run-kartan artwork, orbit, glow tai reittikorostus voidaan tulkita prosentiksi, ETA:ksi tai provider-tekstistä johdetuksi runtime-tilaksi. | korkea / mahdollinen operaattorivirhe | Mission / All Loops / live inspector johtavat semantiikan vain immutable snapshotista ja canonical persistencestä; ei keksittyä telemetriaa. QS-013/EVID-013 ja UI copy erottavat ornamentin faktasta. | controlled; monitor usability |

## Riskien arviointiperiaate

- **Vaikutus** arvioi turvallisuuden, datan, päätösvallan, hyväksymisen tai palautumisen vahingon.
- **Todennäköisyys** perustuu havaittuun evidenssiin tai eksplisiittiseen oletukseen; “mahdollinen” ei ole nolla.
- **Open** edellyttää omistettua seuraavaa tointa. **Controlled** edellyttää toteutettua estettä ja testiä/monitoria. **Accepted operational risk** edellyttää näkyvää rajausta, ei hiljaista sivuuttamista.
- Initiative-specific-riski pysyy BRIEF/PLAN/REVIEWssä, ellei se toistu tai ylitä initiative-rajaa.

## Teknisen velan priorisointi

RISK-011 ei valtuuta sivutehtävänä tehtävää laajaa refaktorointia. Warning-baseline jää näkyväksi, ja sen kasvu estetään nyt. Velan poistaminen suunnitellaan erillisenä bounded initiative -työnä, jotta muutoksen vaikutus runtimeen ja käyttäjän omaan työpuuhun voidaan arvioida. RISK-002 puolestaan korjataan tässä initiative-työssä, koska ristiriitainen kanoninen sanasto suoraan heikentää agenttien ja kehittäjien päätöksentekoa.

## Monitorit ja review-triggerit

| Riski | Monitori/evidenssi | Review-trigger |
| --- | --- | --- |
| RISK-001, RISK-005, RISK-006 | Ensimmäisen pilotin REVIEW ja METHOD-HEALTH | Ensimmäinen initiative valmistuu tai jää korjaussilmukkaan. |
| RISK-002 | `validate:arc42` ja aktiivisten lähteiden legacy-termihaku | Strict-schema/terminologia tai current summary muuttuu. |
| RISK-003, RISK-007 | Runtime/adapter failure ja `needs_input`-evidenssi | Ambiguous repair tai provider preflight -failure toistuu. |
| RISK-004 | Human Validation / ulkoisten komentojen audit | Release/deploy/rollback pyydetään. |
| RISK-008–RISK-010 | Loop module package/service/API/UI/smoke-testit | Package-skeema, registry-scope tai provenance muuttuu. |
| RISK-011 | `npm run lint`, warning-count ja source anchor -conformance | Warning-baseline kasvaa tai lähdepolku rikkoutuu. |
| RISK-012 | QS-013-testit ja usability-havainto | UI lisää progress/ETA/elapsed/state-ornamenttia tai käyttäjä raportoi väärintulkinnan. |

## Kanoniset lähteet

Tämä osio omistaa project-level-arkkitehtuuririskit. Initiative-kohtaiset riskit alkavat BRIEF/PLAN-tiedostoista ja nousevat tänne vain, kun vaikutus ylittää niiden rajan.

## Relevantit päätökset

`adr-005`, `adr-006`, `adr-008`, `adr-011`, `adr-015`, `adr-016` ja `adr-017`.

## Evidenssi

Migration-findingit, validoinnit, Root Run -outcomet, lint-outputit ja initiative-REVIEWt. RISK-002:n ja RISK-011:n lopputila päivitetään dokumentaatioinitiativen toteutuneen evidenssin perusteella.

## Avoimet kysymykset

- RISK-001, RISK-005 ja RISK-006 tarvitsevat ensimmäisen pilotin evidenssin.
- Milloin RISK-011:n warning-baseline poistetaan kokonaan ennen production-readiness-arviota?
- Tarvitaanko QS-013:n lisäksi käyttäjätesti RISK-012:n todellisen tulkintataajuuden mittaamiseen?

## Seuraava katselmointiperuste

Evaluate Loop päivittää tätä tiedostoa vain uuden materiaalisen riskin, velan, vanhentuneen päätöksen tai architecture drift -evidenssin perusteella; kosmeettinen uudelleenmuotoilu ei ole review-trigger.
