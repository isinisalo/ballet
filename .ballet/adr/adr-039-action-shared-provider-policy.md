---
id: adr-039
title: Action-tason yhteinen provider ja policy
status: accepted
createdAt: '2026-08-30'
updatedAt: '2026-08-30'
version: 1
tags: [arkkitehtuuripaatos, action, runtime-binding, strict-cut]
---

# Action-tason yhteinen provider ja policy

## Konteksti

ADR-038 erotti Validation- ja Work-rooleille omat konepaikalliset provider- ja policy-bindingit. Work syntyy kuitenkin Validationin alisteiseksi agentiksi samassa Action-suorituksessa. Eri provider tai erilainen network/read-only-roots-policy rikkoisi tämän yhteisen suoritusrajan ja tekisi readinessista sekä immutable snapshotista tarpeettoman ristiriitaisen.

## Päätösajurit

- Validation ja sen Work-subagentti käyttävät aina samaa provideria.
- Actionin network- ja read-only-roots-policy on yksi atomisesti tallennettava konepaikallinen päätös.
- Roolit tarvitsevat edelleen omat model- ja reasoning-valintansa.
- Run ei saa dispatchata mitään, jos yhteinen provider/policy tai kummankaan roolin capability ei täsmää.
- Critic/Refinementin governance Agent binding v2 ei muutu.

## Päätös

Konepaikallinen `ActionExecutionBindingV2` tunnistetaan `actionId`:llä ja sisältää yhden providerin, yhden policyn sekä roolikohtaiset `validation`- ja `work`-model/reasoning-valinnat. Binding tallennetaan yhtenä SQLite v20 -rivinä ja yhdellä atomisella upsertilla. Canonical GET/PUT-raja on `/api/environment/states/:stateId/actions/:actionId/execution`; roolikohtainen route poistuu ilman alias- tai migraatiopolkua.

Root Snapshot v17 sisältää yhden Action-capabilityn. Provider, network-policy, read-only roots ja providerin workspace-write-tuki esiintyvät siinä kerran; Validation- ja Work-model/reasoning-capabilityt ovat saman Action-capabilityn roolikohtaisia osia. Prompt evidence ja ExecutionSpec v15 säilyttävät dispatch-kohtaisen `action_role`-subjectin, mutta johtavat providerin ja policyn samasta immutable Action-bindingistä.

Action-editori näyttää yhteisen Provider-, Network- ja Read-only roots -osion ennen roolikortteja. Providerin eksplisiittinen vaihto alustaa molemmat roolit valitun providerin ensimmäiseen modeliin ja sen default-reasoningiin. Persistoitua invalidia bindingiä ei korjata latauksessa. Yksi `Save execution` validoi ja tallentaa koko bindingin; `Save Action` tallentaa edelleen vain project truthin.

Validation pysyy read-onlyna. Work saa kirjoittaa vain serverin managed worktreehen, eikä yhteinen read-only-roots-policy laajenna tätä kirjoitusoikeutta. Approval policy on aina `never`. Actionin tai Staten poisto siivoaa bindingin, eikä uuden Actionin luonnissa kopioida bindingiä.

## Seuraukset

- Validationin ja Workin provider tai policy eivät voi eriytyä tallennuksessa, snapshotissa tai dispatchissa.
- Roolikohtainen model/reasoning-mismatch näkyy erikseen, mutta yksikin mismatch estää koko Runin ennen ensimmäistä dispatchia.
- Aktiivisen Runin snapshot ei muutu, joten uusi binding vaikuttaa vain tuleviin Runeihin.
- SQLite v19 ja Root Snapshot v16 hylätään strict cutissa; niitä ei lueta eikä migroida.

## Hylätyt vaihtoehdot

- **Roolikohtaiset providerit:** ristiriidassa Validationin omistaman Work-subagentin suoritusrajan kanssa.
- **Roolikohtaiset policyt samalla providerilla:** mahdollistaisi alisteisen agentin authority driftin.
- **Modelin ja reasoningin yhdistäminen:** poistaisi hyödyllisen roolikohtaisen suoritusvalinnan ilman turvallisuushyötyä.
- **v19-bindingien migraatio:** joutuisi ratkaisemaan ristiriitaiset providerit ja policyt ilman ihmisen päätöstä.

## Supersession ja review trigger

ADR-039 supersedoi ADR-038:n roolikohtaisen provider- ja policy-omistuksen. ADR-038:n State-owned Use Case closure, Actionin project-owned instruction/Skill-koostumus, Validation-led-raja, immutable continuation sekä Critic/Refinement Agent -rajat säilyvät.

Uusi ADR vaaditaan, jos Validation ja Work saavat eri providerit tai policyt, binding siirretään project truthiin, Workin managed-worktree-rajaa laajennetaan tai approval policy muuttuu. Trace: `goal-024` / REQ-024, QS-041, CON-017, BB-017, RT-033, DEP-007, TEST-041 ja EVID-041.
