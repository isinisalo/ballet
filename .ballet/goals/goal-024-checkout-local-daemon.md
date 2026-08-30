---
id: goal-024
title: Varmatoiminen checkout-kohtainen local-only daemon
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [tavoite, daemon, local-only, reliability]
---

# Varmatoiminen checkout-kohtainen local-only daemon

## Tavoite

Ballet käyttää yhtä checkout-kohtaista macOS launchd-daemonia paikallisen serverin CLI-workerina. Serveri omistaa SQLite-runtime-totuuden, managed worktreet, Run-finalisoinnin ja Run Evidencen; daemon omistaa vain Codex- ja Copilot-CLI:n readiness-tarkistukset ja prosessit.

## Käyttäjäarvo

- Agentin execution-asetuksissa ei ole merkityksetöntä Computer-valintaa.
- `ballet start`, `stop`, `status`, `restart` ja `logs` hallitsevat serveriä ja saman checkoutin daemonia yhtenä kokonaisuutena.
- `/runtimes` näyttää yhden paikallisen daemonin ja kahden providerin faktat ilman pairing- tai remote-käsitteitä.
- Jono, lease/fencing ja terminal outcome säilyvät restartissa yksiselitteisinä.

## Mitattavat success criteria

1. Fresh server ja daemon ovat ready enintään 60 sekunnissa ja daemon-crashista toivutaan enintään 30 sekunnissa.
2. Leaseään menettänyt aktiivinen taski päättyy kerran `runtime_lost`-failureen enintään 90 sekunnissa eikä requeueudu; queued task suoritetaan restartin jälkeen täsmälleen kerran.
3. Väärä bearer-token hylätään ja checkout-kohtaiset daemon config/token -tiedostot ovat moodissa `0600`.
4. Agent binding sisältää vain providerin, mallin, reasoning effortin, network/read-only-policyt ja aikaleiman; Computer-, device- ja runtime backend -kentät hylätään.
5. Strict target hyväksyy vain Project Config v21:n, Root Snapshot v15:n, Task Envelope/role outcome v11:n, prompt composition v12:n, ExecutionSpec v14:n, SQLite v18:n, Agent/daemon binding v2:n ja Run Evidence v1:n.

## Rajaus ja valtuutus

Environment → State → Action, Validation-first, retry, approval, Feedback/Refinement ja immutable Run Evidence säilyvät. Tuki on macOS/launchd ja daemon checkout-kohtainen. Käyttäjän 2026-08-29 toteutuspyyntö hyväksyi tämän paikallisen strict cutin; mergeä, pushia, julkaisua tai deployta ei valtuutettu.
