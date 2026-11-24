# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/iCapt/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/iCapt/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The token launches that have not happened yet, ranked by what they could be worth. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## What it does

`main.ts` reads the sealed DefiLlama snapshot (`input/snapshot.json`), scores every
pre-token protocol, and writes a ranked board plus a static dashboard:

- **The watchlist, covered whole.** Every protocol with at least $50M of TVL and no
  token on record — 40 of them — is on the board.
- **The early radar.** Every pre-token protocol below the floor that the watchlist's
  own rule would keep (no wrapped, staked or bridged product, no versioned pool, no
  exchange product) joins it — 138 more rows, 178 in all.
- **A value model the snapshot itself supplies.** Each category's multiple is the
  median market-cap-to-TVL of the tokenized protocols in that category, computed
  from the snapshot (global median where a category has too few). Implied value =
  TVL x category multiple x growth x maturity, where growth follows the 7-day TVL
  change and maturity follows how long the protocol has run with no token. No
  protocol name is special-cased anywhere.
- **A farm plan for every row.** Five steps each, derived from the protocol's
  category, chains, TVL and age, with what each step costs and how long it takes.
- **A dashboard a reader can use.** Sortable and filterable board, a detail view for
  every protocol (with the value breakdown and the farm plan), a live-token table
  that keeps the already-trading protocols apart, and the full methodology with the
  per-category multiples table. Static HTML/CSS/JS, no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

Node 22.18 or later, standard library only. The program runs twice and writes the
same bytes both times. It writes `out/board.json`, `out/data.js`, `out/dashboard/`,
`out/screenshots/` and `out/dossier.json`.

## Open the dashboard

Open `out/dashboard/index.html` in a browser (it reads `out/data.js` beside it).
Filter with the search box, the category and chain selectors, or the watchlist
toggle; select a row for its detail view. The URL hash carries the state
(`#q=`, `#category=`, `#chain=`, `#watchlist=1`, `#p=<slug>`).

## Files

- `main.ts` — entrypoint: snapshot in, board + dashboard + dossier out.
- `lib/model.ts` — the model: multiples, implied value, board, farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three screenshots: the board, a detail view, a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jtabzsjz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
