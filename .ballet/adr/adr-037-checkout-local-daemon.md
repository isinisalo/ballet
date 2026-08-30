---
id: adr-037
title: Checkout-kohtainen local-only daemon on ainoa CLI execution worker
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arkkitehtuuripaatos, daemon, local-only, strict-cut]
---

# Checkout-kohtainen local-only daemon on ainoa CLI execution worker

## Konteksti

Paired Computer -malli toi paikalliseen tuotteeseen device-registryn, pairingin, Keychain-credentialit, TLS/WebSocket-liikenteen, remote checkoutin ja erillisen control-plane-tietokannan. Agentit suoritetaan aina samalla koneella kuin checkout ja Ballet-serveri, joten nämä käsitteet kasvattivat failure- ja security-pintaa ilman käyttäjäarvoa.

## Päätösajurit

- `goal-024`, `REQ-024` ja QS-038–QS-040.
- Paikallisen käynnistyksen ja crash-recoveryn pitää olla mitattavia.
- Serverin on säilyttävä ainoana runtime-, worktree-, finalisointi- ja evidence-totuuden omistajana.
- Provider-worker tarvitsee edelleen durable claimin, lease-renewalin, fencingin, event-sekvenssin ja idempotentin terminal callbackin.
- Pre-production strict cut ei sisällä migraatiota, compatibility readeria, aliasta tai dual writea.

## Päätös

Yksi checkout-kohtainen launchd-palvelu pollaa saman checkoutin loopback-serveriä. Se raportoi Codex- ja Copilot-CLI:n capability/readiness-faktat, suorittaa korkeintaan yhden taskin per provider, uusii leaseä, välittää normalisoidut eventit ja palauttaa raaka-outputin serverin v11-validointiin. Se ei kloonaa repositorya, valitse remote checkoutia eikä finalisoi Runia.

Sisäiset `/api/daemon/*`-reitit hyväksyvät vain loopback-liikenteen ja automaattisesti luodun checkout-kohtaisen 0600 bearer-tokenin. Pollaus korvaa WebSocketin. Julkinen runtime-sopimus on singleton `/api/runtimes/local` refresh-, restart- ja logs-alireitteineen. Restart hylätään aktiivisen taskin aikana.

`AgentExecutionBindingV2` sisältää `agentId`, `provider`, `model`, `reasoningEffort`, network/read-only-policyt ja `updatedAt`:n. ExecutionSpec v14 välitetään daemonille sellaisenaan serverin permission snapshotin ja managed-worktree-polun kanssa. Computer-, device-, pairing-, runtimeBackendId-, remote checkout-, Keychain-, TLS- ja WebSocket-käsitteitä ei ole aktiivisessa mallissa.

Serverin SQLite v18 sisältää bindingit, singleton-daemon-statuksen, provider-capabilityt sekä claim/lease/fencing/event/terminal-faktat samoissa execution-rajoissa. Claim on atominen. Queued task säilyy restartissa; kerran claimattu taski ei requeueudu ja lease expiry tuottaa yhden `runtime_lost`-failuren.

Strict versiot ovat Project Config v21, Root Snapshot v15, Task Envelope/role outcome v11, prompt composition v12, ExecutionSpec v14, SQLite v18, Feedback/Critic/Refinement v2, Agent/daemon binding v2 ja Run Evidence v1. V17/control-plane-state arkistoidaan tai poistetaan ennen fresh-käynnistystä.

## Seuraukset

- Käyttäjän runtime-kokemus ja daemonin trust boundary pienenevät yhteen paikalliseen worker-palveluun.
- SQLite ja managed worktree pysyvät serverin omistamina, joten terminal outcome voidaan validoida ja finalisoida yhdessä paikassa.
- Local daemon ei tue toista konetta tai käyttäjäkohtaista globaalia poolia.
- launchd jää macOS-jakelun alustariippuvuudeksi.

## Hylätyt vaihtoehdot

- **Providerit serveriprosessissa:** pienempi prosessimäärä, mutta CLI-crashit ja elinkaari kytkeytyvät HTTP/runtime-omistajaan.
- **Paired remote daemon säilytetään piilotettuna:** ylläpitää tarpeettoman credential-, transport- ja checkout-pinnan.
- **Daemon omistaa worktreen/finalisoinnin:** hajauttaa runtime-totuuden ja tekee idempotentista finalisoinnista vaikeamman.
- **Claimatun taskin automaattinen requeue:** voi toistaa sivuvaikutuksia epäselvän CLI-tilan jälkeen.

## Supersession ja review trigger

ADR-037 supersedoi ADR-035:n Computer-, device-, pairing-, remote-daemon-, Keychain-, TLS/WebSocket-, same-device- ja daemon-owned checkout/finalization -osat. ADR-035:n Markdown Agents, Feedback/Refinement ja Run Evidence sekä ADR-034:n Environment/Validation-semanttiikka säilyvät.

Uusi ADR vaaditaan, jos remote tai multi-machine execution palautetaan, daemon saa runtime/worktree/finalization-omistusta, task concurrency muuttuu tai macOS/launchd ei enää ole ainoa tuettu deployment. Trace on `goal-024` / `REQ-024`, QS-038–QS-040, CON-017, BB-017, RT-032, DEP-007, TEST-038–TEST-040 ja EVID-038–EVID-040.
