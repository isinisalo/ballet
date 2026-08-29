---
id: adr-035
title: Markdown Agents paired daemon ja Run Evidence muodostavat orchestration-rajan
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags:
  - arkkitehtuuripaatos
  - markdown
  - daemon
  - strict-cut
---

# Markdown Agents paired daemon ja Run Evidence muodostavat orchestration-rajan

## Konteksti

V20 korvasi top-level Agentin ExecutionProfilella, yhdisti Goals/ADRs/Constraints-authoringin Direction-lomakkeeksi, hajotti Environment-authoringin useille Configure-reiteille ja nimesi terminal run -evidenssin Product Snapshotiksi. Checkout-local launchd-daemon suorittaa CLI-adaptereita, mutta käyttöliittymä ei anna sitoa Agenttia Computer → Provider → Model → Reasoning -ketjuun. Ratkaisu on toimiva runtime, mutta ristiriidassa hyväksytyn käyttäjäkokemuksen kanssa.

## Päätösajurit

- `goal-023`, `REQ-023` ja QS-033–QS-037.
- Markdown on versionhallittavan projektitotuuden luonnollinen authoring-muoto.
- Agentin identiteetti ja resurssit ovat projektitotuutta; kone, CLI-provider ja credential-readiness ovat machine-local truthia.
- Remote daemon tarvitsee pairing-, heartbeat-, lease-, fencing- ja trusted callback -rajan.
- Nykyinen Environment → State → Action ja Validation-first-looppi eivät saa regressoitua.
- Pre-production strict cut sallii vanhan aktiivimallin poistamisen ilman migraatiota tai compatibilityä.

## Päätös

### Authoring ja informaatiarkkitehtuuri

Goals, ADRs, Constraints, Use Cases ja Instructions käyttävät yhteistä `MarkdownWorkbench`-sopimusta: listaus, YAML-frontmatter + Markdown body -editori, preview, tallennus ja dirty-navigation guard. Goals ja ADRs ovat erillisiä canonical reittejä. Use Case -lista säilyy, mutta oikea paneeli ei rakenna rinnakkaista form-truthia.

Environment → State → Action authoroidaan `/automation/loops`-reitillä Loop Engineering -shellissä. Sidebar ryhmittelee `Automation`, `Environment`, `Project` ja `Run`; `/configure/*` ja `/products/*` poistuvat ilman aliaksia.

### Agent ja execution binding

`AgentDefinitionV1` on Markdown-backed project truth: id, name, description, enabled, instructions, skills ja content hash. Actionin Validation/Work-composition viittaa `agentId`:hen ja voi lisätä action-kohtaiset instruction/skill-resurssit. Role-pohjainen server policy määrittää työkalurajat; käyttäjän Markdown ei voi laajentaa niitä.

`AgentExecutionBindingV1` on machine-local truth: agentId, deviceId, runtimeBackendId, provider, model, reasoning, network ja read-only roots. `ExecutionProfile` poistetaan. Bindingin muuttaminen ei muuta project Markdownia.

### Paired daemon

Palautetaan control-plane-protokolla, jossa ihminen parittaa Computerin lyhytikäisellä koodilla, daemon säilyttää tokenin OS keychainissa ja serveri vain hashin. Daemon ilmoittaa heartbeatit, CLI-backendien capabilityt ja auth/model-readinessin; UI tarjoaa logs, refresh, restart ja revoke -toiminnot.

Kaikkien yhden Environment Runin Agenttien pitää preflightissa sitoutua samaan online-laitteeseen, täsmälleen samaan checkoutiin ja config/snapshot-hashiin. Mixed-device, offline, dirty checkout, puuttuva auth/model tai policy mismatch hylätään ennen ensimmäistä claimia. Remote liikenne käyttää HTTPS:ää; selvä HTTP sallitaan vain loopbackissa.

Työ jaetaan durable claim/lease/fencing-protokollalla. Terminal callback on idempotentti, fencing-tokenilla suojattu ja johtaa root-finalisaatioon korkeintaan kerran. Codex CLI ja Copilot CLI ovat saman provider-adapterirajan ensimmäiset backendit.

### Feedback, Refinement ja Run Evidence

Human Feedback v2:n request on täsmälleen `{ category, comment }`, jossa category on `system | architecture | code | design | documentation`. Serveri lisää actor-, commit- ja valinnaisen run/action/critic-provenienssin.

Refinement v2 alkaa Feedback-ID:stä ja saa ehdottaa vain agentti-, instruction- ja shared Skill -resursseja poluissa `.ballet/agents/**`, `.ballet/instructions/**` ja `.agents/skills/**`. Exact diff, preimage SHA-256:t, diff hash ja erillinen ihmisapproval säilyvät. Muu muutostarve tuottaa `blocked`-tilan ilman kirjoituksia.

Product Snapshot -entity, table, API ja UI poistetaan. Terminal successful Run saa immutable `RunEvidenceV1`-projektion: commit, changed files, artifacts, validation evidence ja lineage. Product tarkoittaa jatkossa vasta buildia, joka on viety dev-ympäristöön; sellaista domainia ei tässä toteuteta.

### Strict versiot

Yksi strict cut käyttää Project Config v21:tä, Root Snapshot v14:ää, Task Envelope/role outcome v11:tä, prompt composition v12:ta, ExecutionSpec v13:a, SQLite v17:ää ja Feedback/Critic/Refinement v2:ta. V20/v16-dataa ei migroida, lueta, aliasoida tai dual-writeta.

## Seuraukset

- Project truth, machine-local truth ja runtime truth ovat erillisiä ja hash-sidottuja.
- Yhden laitteen preflight tekee runista helpommin selitettävän, mutta estää multi-device Environment Runin tarkoituksellisesti.
- Markdown-editori yksinkertaistaa UI:ta ja tekee git-diffistä canonicalin; serveri omistaa edelleen strict parse/validationin.
- Daemon kasvattaa security- ja restart-scopea, joten sen negative tests ovat acceptance gate.
- Product-termi ei enää sekoita teknistä evidenssiä dev-deployattuun lopputuotteeseen.

## Hylätyt vaihtoehdot

- **ExecutionProfile säilytetään Agentin rinnalla:** kaksi päällekkäistä identity/resource-käsitettä ja epäselvä binding owner.
- **Rich form per Markdown-laji:** tuntemattoman frontmatterin häviäminen, rinnakkainen schema/UI truth ja tarpeeton komponenttipinta.
- **Checkout-local daemon vain:** ei toteuta käyttäjän Computer-valintaa eikä aiempaa paired daemon -kokemusta.
- **Per-Action device:** mahdollistaa sekoitetun checkout/config-totuuden yhden Runin sisällä.
- **Product Snapshot uudelleennimetään taulussa mutta säilytetään domainina:** jättäisi väärän käsitteen API:in ja persistenceen.
- **Refinement saa korjata koodia:** ylittää hyväksytyn resurssirajan ja laajentaa agentin write-authorityä.

## Supersession

ADR-035 supersedoi ADR-001:n pairing/remote-daemon-kiellon, ADR-012:n top-level Agentin poistamisen ja ExecutionProfile-omistuksen sekä ADR-034:n ExecutionProfile-, Product Snapshot- ja yhdistetyn Configure-UI:n osat. ADR-034:n Environment ordering, Validation-first, retry/block, approvals, immutable snapshot/continuation ja no-standalone-run -päätökset säilyvät.

## Evidenssi ja review trigger

Trace on `goal-023` / `REQ-023`, QS-033–QS-037, `adr-035` / CON-016, BB-016, RT-029–RT-031, DEP-006, TEST-033–TEST-037, EVID-033–EVID-037 ja initiative `markdown-agent-daemon-orchestration`.

Uusi ADR vaaditaan, jos multi-device Run sallitaan, agentti saa laajentaa role policyä, Refinementin allowlist laajenee tuotantokoodiin, Product-domain otetaan käyttöön tai daemonin trusted callback/security-malli muuttuu.
