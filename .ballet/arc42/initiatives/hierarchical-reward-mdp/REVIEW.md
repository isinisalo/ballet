---
id: hierarchical-reward-mdp-review
title: Hierarchical Reward-MDP initiative review
status: review
createdAt: '2026-08-23'
updatedAt: '2026-08-23'
version: 1
tags:
  - arc42
  - initiative
  - review
---

# Hierarchical Reward-MDP REVIEW

## Nykytila

Contract/compiler/runtime/default data/CRUD/Module/UI ja kanoninen dokumentaatioketju on toteutettu ADR-033:n mukaisesti. Automated test suite, packaged install, SQLite v15 startup/health ja desktop/narrow browser-QA ovat vihreitä HRM-evid-001–005:n mukaisesti.

## Findingit

- Acceptance-ledger ja policy-state olivat käsitteellisesti sekoittuneet. V19 erottaa ledgerin Graph-owned portiksi ja johtaa matriisit node-ID:istä.
- Runtime tarvitsi kaksi scopekohtaisesti tagattua decision/observation-ketjua, mutta ei kahta rinnakkaista truth-storea: yksi immutable snapshot ja transaction coordinator säilyvät.
- Lisääminen jättää required cellit tarkoituksella incompleteksi; implisiittinen array-fallback olisi rikkonut authoring/control-truth-rajan.
- Exact ledger-effect mismatch pysähtyy ennen state/ledger-siirtymää ja voidaan korjata samalla odottavalla Validation-rajalla.
- UI:n matrix virtualization alkaa yli 20 rivin. 40/64 skaalafixturet todennettiin automated UI:ssa; installed-selaimessa 5×5/2×2/12×12 ja 1440×900/390×844 todensivat sticky/internal-scroll- ja page-overflow-sopimuksen.
- Ensimmäinen narrow browser -ajo löysi implisiittisen CSS-grid-raidan 754 px venymän. Eksplisiittinen `minmax(0,1fr)` rajasi 390 px viewportin sisältöraitaan 366 px ja vaakavierityksen matrix/acceptance-paneeleihin.

## QS-verdict ja handoff

`QS-027`: tekninen acceptance passed HRM-evid-001–005:n rajoissa. Operational/human evidence pysyy pending HRM-evid-006:ssa. Seuraava toimi on projektin omistajan visual verdict tai erikseen valtuutettu production-like hierarchical Root Run -pilotti.
