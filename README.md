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
  exchange product) joins it — 138 more rows, 178 in all. The 39 protocols below
  the floor that record no token but are not launches of their own are listed with
  their reasons, not ranked.
- **A fitted value model the snapshot itself supplies.** The market-cap-to-TVL
  multiple is fitted on the snapshot's own tokenized peers (n = 87 with a known
  age): log(market-cap / TVL) = -1.417 - 0.635 x (log TVL - 17.44), plus a
  category effect shrunk toward the global fit for small samples. Held out one
  peer at a time, the fit misses by 1.924 log points (MAE 1.418), against 2.175
  (MAE 1.665) for the median multiple alone; R² = 0.238. Growth and age were
  tested as fitted terms the same way and carried no signal beyond TVL, so they
  enter at fixed bounded weights.
- **Token odds from the peers' own record.** Implied value is an expected value:
  the value if the protocol launches, times the odds that it does — the share of
  protocols in its category that record a token in this snapshot, shrunk toward
  the global share 19.0%. Privacy leads at 35.0%, Risk Curators trail at 5.9%.
- **A farm plan for every row.** Six steps each, derived from the protocol's
  category, chains, TVL and age — including a category-specific advanced step and
  a weekly action — with what each step costs and how long it takes, and a costed
  summary (capital in position, gas over the hold, hold days).
- **A dashboard a reader can use.** Sortable and filterable board, a detail view
  for every protocol (verdict band, value breakdown with the fitted multiple and
  token odds, evidence lines, farm plan and farm-cost box), a live-token table
  that keeps the already-trading protocols apart, and the full methodology with
  the fitted category effects, the token-odds table, the fit diagnostics and the
  list of protocols left out. Static HTML/CSS/JS, no network.

Top of the board: Tori Finance ($5.73M implied), Manta CeDeFi ($5.39M), Axis
($5.29M), Aegis YUSD ($5.20M), Liminal Basis ($4.92M).

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
- `lib/model.ts` — the model: fitted multiple, token odds, implied value, board, farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three screenshots: the board, a detail view, a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jtabzsjz&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
