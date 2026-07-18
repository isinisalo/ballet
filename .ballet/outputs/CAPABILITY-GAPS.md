# Ballet capability gaps

Tämä raportti erottaa geneeriset Ballet-runtime-capabilityt tämän projektin omista workflow-valinnoista. Evalit eivät muuttaneet platform-koodia eivätkä tehneet ulkoisia kirjoituksia.

## GAP-APPROVAL-ASSERTION: typed, subject-bound human approval

**Tila:** avoin geneerinen capability gap.

Ballet välittää human Stepin vastauksen seuraavalle Loopille opaque stringinä. Runtime ei validoi vastauksen schemaa, approval subjectia, scopea, artifact-polkuja, raw-byte SHA-256 -hasheja tai Git SHA:ta ennen transitionia.

Project-local kompensaatio:

- Blueprint-, milestone- ja implementation-gateille on dokumentoitu täsmälliset claim-sopimukset.
- Vastaanottavat project-local validatorit parsivat claimin ja laskevat viitatut hashit uudelleen.
- Stale tai puuttuva claim palauttaa fixture-agentilta `blocked` ennen seuraavaa vaikutusta.

Kompensaatio ei tee claimista runtime-tason invarianttia: väärin toteutettu tai ohjeen ohittava agentti voisi käsitellä opaque inputin väärin.

Unrelated workflow -käyttötapaukset:

1. Lakiasiakirjan allekirjoitus on sallittava vain tietyn dokumenttiversion SHA-256:lle ja nimetylle sopimusosapuolijoukolle.
2. Data-importin aktivointi on sallittava vain tietyn dataset-snapshotin checksumille, skeemaversiolle ja kohdeympäristölle.

Tarvittava geneerinen primitive on human Stepin konfiguroitava response-schema ja runtime-validointi, joka sitoo hyväksynnän immutable subject-claimiin ennen transitionia.

## GAP-LOOP-ENTRY: transition-only Loop entry policy

**Tila:** avoin geneerinen capability gap.

Projektiohje määrittelee vain `blueprint-design`-Loopin manuaaliseksi rootiksi, mutta Ballet voi käynnistää myös downstream-Loopin suoraan Loop-ID:llä. Konfiguraatiossa ei ole `manual`, `transition_only` tai vastaavaa entry policyä.

Project-local kompensaatio:

- Jokainen downstream-agentti tarkistaa vaaditun upstream-claimin ja palauttaa `blocked`, jos claim puuttuu.
- `RELEASE-WITHOUT-APPROVAL`-eval käynnistää release-Loopin tarkoituksella suoraan ja todistaa agenttitason stopin.

Unrelated workflow -käyttötapaukset:

1. Incident containment -Loopin saa käynnistää vasta triage-Loopin tuottamasta hyväksytystä incident-claimista, ei manuaalisesti.
2. Refund execution -Loopin saa käynnistää vain fraud-review-Loopin dual-control-päätöksestä, ei suoraan käyttöliittymästä.

Tarvittava geneerinen primitive on Loop-kohtainen entry policy, jonka runtime tarkistaa kaikissa start-polkuissa.

## GAP-CONDITIONAL-EFFECTS: approval-bound external effect authorization

**Tila:** avoin geneerinen capability gap.

Agentin runtime-policy voi sallia tai estää verkon, mutta Ballet ei myönnä yksittäistä write-työkalua tai verkkovaikutusta ehdollisesti validoidun approval-claimin perusteella eikä interceptoi vaikutusta ennen suoritusta. Prompt- ja validator-säännöt ovat hyödyllisiä, mutta eivät provider-tason effect guard.

Project-local kompensaatio:

- Eval-fixtureiden jokainen external action on `not_executed`.
- Release-validatorin `authorization: allowed` tarkoittaa vain, että mock-polku saa edetä seuraavaan Step-/gate-tilaan; se ei suorita tagia, deployta tai cloud-toimea.
- Release-agentin ohje kieltää ulkoisen toimen ennen hashattua claimia ja hyväksyttyjä contracteja.

Unrelated workflow -käyttötapaukset:

1. Tietokantamigraatiotyökalu pitää vapauttaa vain nimetyn change-approvalin, migration-hashin ja maintenance window -claimin jälkeen.
2. Maksu- tai CRM-muutos pitää vapauttaa vain dual-control-approvalin, täsmällisen tapahtumaerän ja enimmäissumman rajoissa.

Tarvittava geneerinen primitive on claimiin sidottu, lyhytikäinen effect grant sekä write-toimien preflight-interceptointi ja audit ledger.

## Ei geneerisiä platform-gapeja

Seuraavat ovat tämän projektin nykyisiä, tarkoituksellisesti näkyviä rajoja:

- GitHub issue -publication-Stepiä ei ole. Nykyinen workflow todistaa, että issue draftit pysyvät `draft_only`/`not_executed`-tilassa ennen milestone-gatea ja sen jälkeen. Positiivinen GitHub-publication vaatisi uuden project-local Stepin ja agentin; sitä ei saa keksiä tässä eval-goalissa.
- `managed-product.code_paths` on tyhjä ja hyväksytyt release/environment/rollback-lähdesopimukset puuttuvat. Todellinen implementation/release-polku kuuluu siksi blokata. Positiivinen polku validoitiin vain eristetyllä mock fixturellä.
- Nykyisestä source-planesta puuttuvat saman scopen DESIGN-lähde, stable acceptance ID:t ja quality threshold -metadata. Tämä on human-owned source gap, ei Ballet-platform-gap.
- Vapaamuotoisen luonnollisen kielen ristiriita tarvitsee agentin semanttisen analyysin. Deterministinen validator tarkistaa eksplisiittiset duplikaatti-ID:t, declared conflictit ja normalisoidut fixture-claimit; se ei väitä ratkaisevansa yleistä luonnollisen kielen ristiriidantunnistusta.
