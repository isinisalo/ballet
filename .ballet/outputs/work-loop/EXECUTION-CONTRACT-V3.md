# Work Loop execution contract V3

Tämä dokumentti kuvaa strict-v10:n aktiivisen provider-neutraalin prompt-, Task Envelope- ja structured output -sopimuksen. Control-flow'n varsinainen Loop Orchestrator toteutetaan seuraavassa vaiheessa; siihen asti Run-start on tarkoituksella fail-closed.

Päätöslähde: [ADR-015 — Work Loop, revisioitu State ja Loop Orchestrator](../../adr/adr-015-work-loop-state-ja-loop-orchestrator.md).

## Versiot ja evidence

| Sopimus | Versio | Pysyvä evidence |
| --- | ---: | --- |
| Execution spec | 4 | Immutable `spec_json` ja spec hash |
| Prompt composition | 3 | Exact UTF-8 prompt ja SHA-256 |
| Task Envelope | 2 | Versio ja canonical envelope SHA-256 |
| Role output schema | 3 | Node role, schema ID, canonical JSON Schema ja SHA-256 |
| System execution contract | 3 | Snapshotoitu system-resurssi ja source SHA-256 |

Schema-ID:t ovat `work-node-outcome-v3`, `validation-node-outcome-v3` ja `orchestrator-node-outcome-v3`. ExecutionTaskin immutable `nodeRole` valitsee täsmälleen yhden skeeman. Eri roolin outcome hylätään, vaikka se olisi toisen skeeman mukaan validi.

## Task Envelope V2

Kaikille rooleille välitetään:

- version ja rooli;
- Root Run-, Loop Run- ja Node Run -identiteetit;
- Loopin ID ja description;
- roolikohtainen task;
- State revision, koko kanoninen JSON-arvo ja State SHA-256;
- mahdollinen resume-konteksti; sekä
- enintään kahdeksan relevanttia historiayhteenvetoa.

Work ja Validation saavat lisäksi Work Loop Node Run -identiteetin, Work Loop Noden ID:n/descriptionin ja local attemptin. Validation saa viimeisimmän kanonisen completed Work-outcomen. Local retry -Work saa vain Validationin `feedback`- ja `expectedCorrection`-kentät.

Orchestrator saa persistoidusta Repair Requestista rajatun projektion. Se ei saa continuationia eikä return targetia. Sallitut target Loopit johdetaan immutable snapshotin source-Loop-kohtaisista repair-LoopEdgeistä ja välitetään ID:n sekä descriptionin kanssa UTF-8 ID -järjestyksessä.

Historia järjestetään `(sequence, nodeRunId)`-avaimella ja rajataan deterministisesti kahdeksaan uusimpaan entryyn. Entryä, Statea, Repair Requestia, resume-kontekstia tai provider-outputia ei typistetä sisältä. Jos valittu semanttinen sisältö ylittää rajansa, rakentaminen epäonnistuu näkyvästi.

| Sisältö | Raja |
| --- | ---: |
| State | 262144 tavua |
| Relevantti historia | 65536 tavua |
| Repair Request -projektio | 65536 tavua |
| Resume-konteksti | 32768 tavua |
| Koko Task Envelope | 393216 tavua |
| Koko Ballet-owned prompt | 524288 tavua |

Envelope serialisoidaan canonical JSONina: object-avaimet järjestetään, taulukkojärjestys säilyy roolisopimuksen mukaisena ja hash lasketaan täsmälleen providerille välitettävistä envelope-tavuista. State SHA-256 tarkistetaan ennen compositionia.

## Work Node outcome

Work tekee työn eikä saa palauttaa `decision`, `OK`, `FAIL`, `approved` tai `rejected` -control-kenttiä.

- `completed` vaatii `summary`, `artifacts` ja `checks`; `statePatch` on optional.
- `needs_input` vaatii `question`, `context`, `summary` ja `checks`; patch on kielletty.
- `blocked` ja `failed` vaativat `summary`- ja `checks`-kentät; patch on kielletty.

## Validation Node outcome

Validationin `completed`-tila lukitsee päätöksen:

```text
decision = OK
tai
decision = FAIL + repair.mode = LOCAL_RETRY | ORCHESTRATOR_REPAIR
```

`OK` vaatii summaryn, evidencen ja checksit, kieltää repairin ja voi ehdottaa State patchia. `FAIL` vaatii summaryn, evidencen, checksit ja repairin sekä kieltää State patchin.

`LOCAL_RETRY` vaatii `feedback`- ja `expectedCorrection`-kentät. `ORCHESTRATOR_REPAIR` vaatii `reason`- ja `evidenceRefs`-kentät sekä täsmälleen toisen kentistä `requestedCapability | requestedOutcome`. Validation ei nimeä target Loopia tai LoopEdgeä.

`needs_input`, `blocked` ja `failed` ovat erilliset strict-haarat eivätkä sisällä decision- tai repair-kenttiä.

## Orchestrator outcome

Orchestratorin `completed` vaatii:

- `targetLoopId`;
- `routeReason`;
- `repairInput`; sekä
- `expectedOutcome`.

`targetLoopId` ei ole sellaisenaan route. Platform tarkistaa sen persisted Repair Requestin source-Loopin allowlistia vasten ja ratkaisee vakaan repair-LoopEdgen. `continuation`, `returnLoopId`, `returnWorkLoopNodeId`, `returnValidationNodeDefinitionId`, `loopEdgeId` ja `statePatch` ovat outcome-skeemassa kiellettyjä.

Orchestratorin `needs_input`, `blocked` ja `failed` ovat strict-haaroja. Provider-adapteri ei koskaan määrää control-flow'ta raakatekstillä.

## Prompt composition

Exact prompt muodostetaan aina järjestyksessä:

1. fixed System execution contract;
2. Project primary instruction;
3. valitut Project skillsit nousevassa UTF-8 ID -järjestyksessä;
4. roolikohtainen Task Envelope V2; ja
5. roolikohtainen output JSON Schema V3.

System contract määrittelee vain instruction authorityn, runtime-permissionit, secret-rajat, structured outputin, check/artifact-referenssit ja hidden chain-of-thoughtin kiellon. Project-kohtainen workflow kuuluu Project instructioneihin ja skilleihin.

## Parse-, canonicalization- ja persistence-raja

Provider-adapteri tuottaa provider-neutraalin structured JSON -payloadin. Queue valitsee immutablella Node rolella Zod-skeeman, hylkää unknown-kentät ja väärän union-haaran sekä välittää eteenpäin vain parsed outcomen. ExecutionStore validoi roolin uudelleen ja tallentaa outcomen canonical JSONina.

State patchin JSON-rakenne validoidaan outcome-skeemassa. Ennen commitia persistence-raja validoi lisäksi enintään 128 operaatiota, 65536 tavun patch-rajan, sallitut `add | remove | replace` -operaatiot, JSON Pointerit, prototype-segmenttien kiellon, nykyisen base revisionin sekä post-patch Staten 262144 tavun ja 64 tason rajat. Patch sovelletaan kopioon; outcome, uusi revision ja control-flow-event kirjoitetaan atomisesti tai ei lainkaan.

Providerin prose, assistant-teksti tai julkaistu reasoning-yhteenveto ei ole control-flow-lähde. Piilotettua chain-of-thoughtia ei pyydetä eikä tallenneta envelopeen, outcomeen, Repair Requestiin, Stateen tai UI DTO:hon.
