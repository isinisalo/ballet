# Kertamuunnoksen tarkastuskartta

Tämä hakemisto on vain testievidenssiä. Tuote ei lue historiallista Markdownia eikä suorita muunnosta käynnistyksessä tai CLI:ssä.

Lähtötiedoston SHA-256: `1fc3334266aa61656ca1005099d37155fd7d93f41a19ec7951c4674accae816b`.

| Prosessi | Prosessi-ID / alkuperäinen prosessitaulu | Vastuunäkymä |
| --- | --- | --- |
| 6. Refinement ja continuation | `3d075703-a410-4d75-b98f-942f9755e9a8` | `db0094fb-775f-4552-bf8a-674564d177a0` |
| 3. Validation, Work ja Run Evidence | `598ff734-ac7f-47f6-bd92-2fc73cdf6e88` | `85f829ff-ccf0-41a2-804f-f06406a327e6` |
| 4. Paikallinen palvelu, daemon ja jakelu | `74f22c5a-3ae7-4184-bf95-4e69368c586d` | `a858d959-11ac-4dd5-8359-71f79828e5bb` |
| 1. Projektisisältö ja tarinoiden hyväksyntä | `8319f5a8-4263-483e-b027-83bb1c082406` | `c7b4c86b-e5da-4230-b4eb-53ad2dcb0f16` |
| 5. Feedback ja Critic | `ba0bdc02-5d4b-425d-8d0a-3a38f9d99489` | `4436191c-d365-4d73-b9b1-9128e5eeba6e` |
| 2. Environment ja Action Agentit | `c8d2c75c-a2e3-4197-a69f-7a5f6cc281a8` | `57a098ff-f0ee-4398-adc4-43a1b09ceb92` |

Prosessitaulun eksplisiittinen jäsenyys määrää prosessin. Vastuunäkymän alkuperäinen `sourceBoardId` yhdistää sen prosessiin. Kokonaiskuvan nimettyjen kehysten eksplisiittiset `frameId`-jäsenyydet on kohdistettu vastaaviin kuuteen prosessiin. Koordinaatteja ei käytetty jäsenyyteen. Sama käsite saman prosessin eri näkymissä on yksi askel; prosessitaulun sijoittelu-ID on ensisijainen askel-ID. Pelkästään vastuunäkymässä tai kokonaiskuvassa ollut käsite sai ensimmäisen alkuperäisen sijoittelunsa ID:n. Yhteinen avoin kysymys säilyy `sharedConceptIds`-viitteenä.

`mapping.json` luettelee jokaisen vanhan sijoittelun vastineen ja jokaisen vanhan nuolen semanttisen yhteyden. 113 käsitettä muodostaa 112 prosessiaskelta ja yhden yhteisen kysymyksen. Kaikki 233 sijoittelu-ID:tä, 232 nuoli-ID:tä, 18 kehystä ja 13 näkymää säilyvät layoutissa. Näistä lähtönuolista ei löytynyt identtisiä semanttisia yhteyksiä. Saman käsitteen esityskopiot on yhdistetty, ei eri prosessien askelia.

Nuolten alkuperäiset nimet ja päätepisteet säilyvät. Aggregateen liittyvät omistus-/vastuunuolet ovat `responsibility`; read modeliin tai ulkoiseen järjestelmään liittyvät avustavat nuolet `support`; muu tapahtumakulku `flow`. Alkuperäisen nimen eksplisiittinen ehto, retry, esto tai poikkeus säilytetään myös tekstimuotoisena ehtona. Nimi ei muutu suoritettavaksi säännöksi. Vastuurajan jäsenyys tulee alkuperäisistä nimetyistä frame-viitteistä.

Story-lähteet säilyvät käsitteissä ja muodostavat askelviitteet sekä niitä kokoavan prosessin viitteet. Tarinoiden sisältöä tai hyväksyntää ei kopioida. Mallin Markdown-runko säilyy tavuntarkasti `documentation`-kentässä. Vastuunäkymän kuvaus säilyy sekä näkymän esityskuvauksena että kyseisen semanttisen vastuurajan kuvauksena.

`EventStormingConversion.test.ts` todentaa lähtöaineiston, tunnistekartoituksen, käsitteet/lähteet, päätepisteet/nimet, geometrian ja Markdown-rungon suhteessa tämän kertamuunnoksen repositorydataan. Tämä on historiallisen siirron tarkistus, ei yleinen taulu- tai täydellisyysvaatimus.
