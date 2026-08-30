---
id: adr-038
title: Action-kohtaiset Validation- ja Work-suoritusbindingit
status: accepted
createdAt: '2026-08-30'
updatedAt: '2026-08-30'
version: 1
tags: [arkkitehtuuripaatos, action, runtime-binding, strict-cut]
---

# Action-kohtaiset Validation- ja Work-suoritusbindingit

## Konteksti

ADR-034 sitoi hyväksyttyjä Use Caseja sekä Stateen että Actioniin. ADR-035 sitoi Validation- ja Work-roolit top-level Markdown Agenteihin, vaikka Action jo omisti roolikohtaiset instruction- ja Skill-valinnat. Tämä loi kaksi rinnakkaista closuren lähdettä ja pakotti konepaikallisen provider-valinnan epäsuoran Agent-identiteetin taakse.

## Päätösajurit

- Staten on oltava Actioneidensa ainoa hyväksytyn Use Case -closuren omistaja.
- Validation- ja Work-suorituksen provider-, model-, reasoning- ja policy-valinnat ovat konepaikallisia faktoja.
- Instructionit ja Skillit säilyvät versionhallittuna projektitotuutena.
- Runin on estyttävä ennen ensimmäistä dispatchia, jos yksikin tarvittava binding tai capability ei ole valmis.
- Critic ja Refinement säilyttävät nykyisen Markdown Agent- ja `AgentExecutionBindingV2`-mallin.

## Päätös

Project Config v22:n Action sisältää kummallekin roolille täsmälleen `{ instructionResource, skillResources }`. Actionin `useCaseIds` ja roolikohtainen `agentId` ovat strict-skeemassa kiellettyjä. Action perii omistavan Staten koko hyväksytyn Use Case -closuren.

Konepaikallinen `ActionRoleExecutionBindingV1` tunnistetaan avaimella `(actionId, role)`, jossa role on `validation | work`. Binding sisältää providerin, modelin, reasoning effortin sekä network- ja read-only-roots-policyn. Canonical GET/PUT-raja on `/api/environment/states/:stateId/actions/:actionId/execution/:role`; API varmistaa State/Action-suhteen ja strict bodyn. Actionin tai Staten poisto siivoaa bindingit, eikä uusi Action peri niitä mallipohjasta.

Root Snapshot v16 sisältää Environmentin Action-role-bindingit ja vain Critic/Refinementin tarvitsemat Agent-bindingit. Capability-, prompt-evidence- ja ExecutionSpec-identiteetti on diskriminoitu `action_role | agent` -subject. Validation on read-only, Work kirjoittaa vain serverin managed worktreehen ja approval policy on aina `never`.

Prompt composition v13 ja ExecutionSpec v15 käyttävät samaa subject-identiteettiä. Continuation-evidenssi invalidoituu vain, kun relevantin Action-roolin binding, instruction tai Skill muuttuu. SQLite v19 tallentaa bindingit uniikilla `(action_id, role)`-avaimella. Vanhaa Project Configia tai SQLite v18:aa ei lueta eikä migroida.

## Seuraukset

- Action-editori näyttää provider-, model-, reasoning-, network-, roots-, instruction- ja Skill-kontrollit roolikohtaisesti sekä erillisen `Save execution` -toiminnon.
- Top-level Agents-workspace palvelee Critic- ja Refinement-governancea; käyttämättömät Validation/Work-Agent-resurssit poistuvat.
- Nested `.agents/skills/**/SKILL.md` -resurssit ovat valittavia turvallisen rekursiivisen listauksen kautta.
- Aktiivisen Runin snapshot pysyy muuttumattomana; bindingin tallennus vaikuttaa vain tuleviin Runeihin.

## Hylätyt vaihtoehdot

- **Actionin Use Case -viitteiden säilyttäminen:** ylläpitäisi kahta ristiriitaista closurea.
- **Validation/Work Agent -bindingin säilyttäminen:** säilyttäisi tarpeettoman epäsuoran identiteetin.
- **Provider-valintojen tallennus Project Configiin:** sekoittaisi konekohtaisen readinessin versionhallittuun intentioon.
- **Bindingien kopiointi uuteen Actioniin tai v18-datasta:** voisi dispatchata väärällä paikallisella suoritussopimuksella.

## Supersession ja review trigger

ADR-038 supersedoi ADR-034:n Action-kohtaiset Use Case -viitteet ja ADR-035:n Validation/Work-`agentId`-bindingin. ADR-034:n Environment-, State-, Validation-led-, retry- ja human approval -rajat, ADR-035:n Critic/Refinement Markdown Agents sekä ADR-037:n checkout-local daemon säilyvät.

ADR-039 supersedoi tämän päätöksen roolikohtaisen provider- ja policy-omistuksen. State-owned closure, project-owned role resources ja muut tässä määritetyt rajat säilyvät.

Uusi ADR vaaditaan, jos Actionille palautetaan oma Use Case -closure, Validation/Work palautetaan Agent-identiteettiin, binding siirretään project truthiin tai daemon/worktree/approval-omistus muuttuu. Trace: `goal-023` / `goal-024`, REQ-023 / REQ-024, QS-039–QS-040, CON-016–CON-017, BB-016–BB-017, RT-026 / RT-032, DEP-007, TEST-039–TEST-040 ja EVID-039–EVID-040.
