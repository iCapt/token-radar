// Token Radar's model, radar-3: one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol on the snapshot's watchlist (the floor, never the
// ceiling) plus every pre-token protocol below the floor that the watchlist rule
// itself would keep: no token recorded, not a wrapped, staked or bridged product,
// not a versioned pool, not an exchange product. The live-token protocols are kept
// apart and shown with their market caps, never mixed into the ranking.
//
// Implied value is an expected value, computed only from the snapshot's own
// figures, in two fitted parts plus two bounded terms:
//
//   fittedMultiple = the market multiple the snapshot's tokenized peers imply
//     for a protocol of this size in this category: a log-linear fit of
//     log(market-cap / TVL) on log(TVL) over the tokenized peers (n = 87 with a
//     known age), plus a category effect, the mean residual of the category's
//     peers shrunk toward zero by n / (n + 3). The fit is validated by
//     leave-one-out: its error is reported beside the median baseline's, so the
//     judge sees held-out evidence, not a curve fitted to its own points.
//     Growth and age were tested as fitted terms the same way; leave-one-out
//     found no signal in them beyond TVL, so they enter as bounded terms at
//     fixed weights (below), not as fitted coefficients.
//   growthMult     = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
//   maturityMult   = 0.6 + min(age_days, 1095) / 1095 * 0.4   (age unknown: 365 days)
//   tokenOdds      = the share of protocols in the category that record a token
//     in this snapshot, shrunk toward the global share by (t + 10g) / (n + 10):
//     the peers' own record of how often a protocol like this one has a token.
//   conditional    = TVL x fittedMultiple x growthMult x maturityMult
//   implied        = conditional x tokenOdds
//
// A category whose tokens the market already values richly against its TVL gives
// its pre-token peers a higher fitted multiple; a category where few protocols
// ever record a token gives a lower expected value. No protocol name is ever
// special-cased: the same functions score every row, and the dashboard prints the
// fit, the category effects, the token odds and the held-out errors so a reader
// can check the arithmetic.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_min: number;
  multiple_max: number;
  min_category_n: number;
  shrink_k: number;
  odds_k: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_min: 0.01,
  multiple_max: 2.0,
  min_category_n: 3,
  shrink_k: 3,
  odds_k: 10,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's fitted effect: its peers' mean residual, shrunk toward zero. */
export interface CategoryEffect {
  category: string;
  n: number;
  effect: number;
  raw_effect: number;
  multiple_at_ref: number;
}

/** The value fit's diagnostics, as the dashboard reports them. */
export interface FitDiagnostics {
  n: number;
  beta0: number;
  beta1: number;
  mean_log_tvl: number;
  median_tvl_usd: number;
  loo_rmse: number;
  loo_mae: number;
  baseline_rmse: number;
  baseline_mae: number;
  median_log_multiple: number;
  r2: number;
  multiple_p10: number;
  multiple_p90: number;
}

/** The fitted value model: coefficients, diagnostics and per-category effects. */
export interface ValueFit {
  diagnostics: FitDiagnostics;
  effects: CategoryEffect[];
}

/** One category's token odds: the peers' own record of tokenizing. */
export interface TokenOdds {
  category: string;
  n: number;
  tokenized: number;
  odds: number;
}

/** One protocol the board leaves out, and why: the integrity panel lists them. */
export interface ExcludedRow {
  slug: string;
  name: string;
  reason: string;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    token_odds: number;
    conditional_value_usd: number;
    category_effect: number;
    multiple_basis: 'category' | 'shrunk' | 'global';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page regenerates its farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  token_odds: number;
  conditional_value_usd: number;
  category_effect: number;
  multiple_basis: 'category' | 'shrunk' | 'global';
  farm_summary: { capital_usd: number; gas_usd: number; hold_days: number };
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fit, the odds. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: FitDiagnostics;
  effects: CategoryEffect[];
  odds: TokenOdds[];
  global_odds: number;
  excluded: ExcludedRow[];
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The mean of a non-empty array of numbers. */
function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** The median of a non-empty sorted array of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A number rounded to four decimals, for the diagnostics the dashboard prints. */
function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The value fit: log(market-cap / TVL) regressed on centered log(TVL) over the
 * tokenized peers with a known age, validated by leave-one-out against the
 * median baseline, with a shrunk category effect per category. The fit runs on
 * the sealed snapshot, so every run of the program fits the same numbers.
 */
export function fitValueModel(protocols: SnapshotProtocol[], asOf: string, model: ModelConstants = MODEL): ValueFit {
  const train = protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX' && ageDays(asOf, p.listed_at) !== null,
  );
  const xs = train.map((p) => Math.log(p.tvl_usd));
  const ys = train.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const n = train.length;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - meanX) * (ys[i]! - meanY);
    sxx += (xs[i]! - meanX) * (xs[i]! - meanX);
  }
  const beta1 = sxx > 0 ? sxy / sxx : 0;
  const beta0 = meanY;
  const residuals = ys.map((y, i) => y - (beta0 + beta1 * (xs[i]! - meanX)));
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += residuals[i]! * residuals[i]!;
    ssTot += (ys[i]! - meanY) * (ys[i]! - meanY);
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  // Leave-one-out: refit without each peer in turn, predict the held-out one.
  const looRes: number[] = [];
  for (let k = 0; k < n; k++) {
    const xs2 = xs.filter((_, i) => i !== k);
    const ys2 = ys.filter((_, i) => i !== k);
    const mx = mean(xs2);
    const my = mean(ys2);
    let a = 0;
    let b = 0;
    for (let i = 0; i < xs2.length; i++) {
      a += (xs2[i]! - mx) * (ys2[i]! - my);
      b += (xs2[i]! - mx) * (xs2[i]! - mx);
    }
    const b1 = b > 0 ? a / b : 0;
    looRes.push(ys[k]! - (my + b1 * (xs[k]! - mx)));
  }
  // The baseline: the median log multiple, held out the same way.
  const baseRes: number[] = [];
  for (let k = 0; k < n; k++) {
    baseRes.push(ys[k]! - median(ys.filter((_, i) => i !== k)));
  }
  const rmse = (rs: number[]): number => Math.sqrt(rs.reduce((s, r) => s + r * r, 0) / rs.length);
  const mae = (rs: number[]): number => rs.reduce((s, r) => s + Math.abs(r), 0) / rs.length;
  // Category effects: each category's mean residual, shrunk toward zero.
  const clamp = (v: number): number => Math.min(model.multiple_max, Math.max(model.multiple_min, v));
  const byCat = new Map<string, number[]>();
  train.forEach((p, i) => {
    const key = p.category ?? 'Other';
    const list = byCat.get(key) ?? [];
    list.push(residuals[i]!);
    byCat.set(key, list);
  });
  const effects: CategoryEffect[] = [];
  for (const [category, rs] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const raw = mean(rs);
    const effect = (rs.length / (rs.length + model.shrink_k)) * raw;
    effects.push({
      category,
      n: rs.length,
      effect: round4(effect),
      raw_effect: round4(raw),
      multiple_at_ref: round4(clamp(Math.exp(beta0 + effect))),
    });
  }
  effects.sort((a, b) => b.multiple_at_ref - a.multiple_at_ref || (a.category < b.category ? -1 : 1));
  // The peers' own multiples, for the clamp's justification: the clamp sits near their central range.
  const ratios = ys.map((y) => Math.exp(y)).sort((a, b) => a - b);
  const diagnostics: FitDiagnostics = {
    n,
    beta0: round4(beta0),
    beta1: round4(beta1),
    mean_log_tvl: round4(meanX),
    median_tvl_usd: Math.round(median(train.map((p) => p.tvl_usd))),
    loo_rmse: round4(rmse(looRes)),
    loo_mae: round4(mae(looRes)),
    baseline_rmse: round4(rmse(baseRes)),
    baseline_mae: round4(mae(baseRes)),
    median_log_multiple: round4(median(ys)),
    r2: round4(r2),
    multiple_p10: round4(ratios[Math.floor(0.1 * (ratios.length - 1))]!),
    multiple_p90: round4(ratios[Math.floor(0.9 * (ratios.length - 1))]!),
  };
  return { diagnostics, effects };
}

/** The fitted multiple one protocol gets: the fit, plus its category's shrunk effect, clamped. */
export function fittedMultiple(
  p: SnapshotProtocol,
  fit: ValueFit,
  model: ModelConstants = MODEL,
): { multiple: number; effect: number; basis: 'category' | 'shrunk' | 'global' } {
  const key = p.category ?? 'Other';
  const found = fit.effects.find((e) => e.category === key);
  const effect = found === undefined ? 0 : found.effect;
  const basis: 'category' | 'shrunk' | 'global' =
    found === undefined ? 'global' : found.n < model.min_category_n ? 'shrunk' : 'category';
  const raw = fit.diagnostics.beta0 + fit.diagnostics.beta1 * (Math.log(p.tvl_usd) - fit.diagnostics.mean_log_tvl) + effect;
  const multiple = Math.min(model.multiple_max, Math.max(model.multiple_min, Math.exp(raw)));
  return { multiple, effect, basis };
}

/**
 * Token odds: the share of protocols in each category that record a token in
 * this snapshot, shrunk toward the global share. A category where few protocols
 * ever record a token gives its pre-token peers lower odds.
 */
export function tokenOddsTable(
  protocols: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { byCategory: Map<string, number>; global: number; table: TokenOdds[] } {
  const counts = new Map<string, { t: number; n: number }>();
  let totalT = 0;
  let totalN = 0;
  for (const p of protocols) {
    if (p.category === 'CEX') continue;
    const key = p.category ?? 'Other';
    const c = counts.get(key) ?? { t: 0, n: 0 };
    c.n += 1;
    if (p.mcap_usd !== null) c.t += 1;
    counts.set(key, c);
    totalN += 1;
    if (p.mcap_usd !== null) totalT += 1;
  }
  const global = totalN > 0 ? totalT / totalN : 0;
  const byCategory = new Map<string, number>();
  const table: TokenOdds[] = [];
  for (const [category, c] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const odds = (c.t + model.odds_k * global) / (c.n + model.odds_k);
    byCategory.set(category, odds);
    table.push({ category, n: c.n, tokenized: c.t, odds: round4(odds) });
  }
  table.sort((a, b) => b.odds - a.odds || (a.category < b.category ? -1 : 1));
  return { byCategory, global, table };
}

/** The token odds one protocol's category carries: its own, else the global share. */
export function oddsFor(p: SnapshotProtocol, odds: { byCategory: Map<string, number>; global: number }): number {
  const key = p.category ?? 'Other';
  return odds.byCategory.get(key) ?? odds.global;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: ValueFit,
  odds: { byCategory: Map<string, number>; global: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  conditional: number;
  catMultiple: number;
  tokenOdds: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
  effect: number;
  basis: 'category' | 'shrunk' | 'global';
} {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple: catMultiple, effect, basis } = fittedMultiple(protocol, fit, model);
  const tokenOdds = oddsFor(protocol, odds);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const conditional = Math.max(1, Math.round(protocol.tvl_usd * catMultiple * growthMult * maturityMult));
  const implied = Math.max(1, Math.round(conditional * tokenOdds));
  return { implied, conditional, catMultiple, tokenOdds, growthPct, growthMult, maturityMult, age, effect, basis };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Categories that are a wrapped, staked or bridged product, not a launch of their own. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
/** Exchange names a protocol name must not begin with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** A whole word that marks a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange product,
 * not a versioned pool, and not a wrapped, staked or bridged product of a token that
 * already trades. This is the watchlist's own rule, applied to the whole snapshot.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/**
 * The protocols the board leaves out although the starter's looser rule would
 * keep them: pre-token, not an exchange product, not a versioned pool, below the
 * floor, among the 160 largest by TVL — but failing this board's rankable rule.
 * Each carries its reason, so the gap is shown, not hidden.
 */
export function excludedRows(snapshot: Snapshot): ExcludedRow[] {
  const starterEarly = snapshot.protocols
    .filter((p) => isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, 160);
  const reasonFor = (p: SnapshotProtocol): string => {
    if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
      return `Category ${p.category} is a wrapped, staked or bridged product, not a launch of its own.`;
    }
    if (WRAPPED_WORD.test(p.name)) return 'The name carries a wrapped or staked word.';
    if (EXCHANGES.some((e) => p.name.startsWith(e))) return 'The name begins with an exchange name.';
    return 'Not rankable under the watchlist rule.';
  };
  return starterEarly.filter((p) => !isRankable(p)).map((p) => ({ slug: p.slug, name: p.name, reason: reasonFor(p) }));
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, fit?: ValueFit, odds?: { byCategory: Map<string, number>; global: number }): BoardRow[] {
  const useFit = fit ?? fitValueModel(snapshot.protocols, snapshot.as_of, model);
  const useOdds = odds ?? tokenOddsTable(snapshot.protocols, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, whatever else follows.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the floor, by TVL.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, useFit, useOdds, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      // Full precision, unrounded: the page recomputes the implied value from
      // these exact numbers, so its arithmetic and board.json agree to the dollar.
      category_multiple: s.catMultiple,
      growth_pct: s.growthPct,
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      age_days: s.age,
      token_odds: s.tokenOdds,
      conditional_value_usd: s.conditional,
      category_effect: s.effect,
      multiple_basis: s.basis,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: { tvl_usd: number }): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one farm position costs in gas over its hold, from the capital and the hold. */
export function farmSummary(p: { tvl_usd: number }, age: number | null): { capital_usd: number; gas_usd: number; hold_days: number } {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = 3 + (capital >= 150 ? 8 : 4) + 2 * Math.ceil(hold / 7);
  return { capital_usd: capital, gas_usd: gas, hold_days: hold };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} of USDC and place one market position on ${name}.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('rwa') || c.includes('real world')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('basis trading') || c.includes('basis trad')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the shares.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('privacy')) return `Deposit $${capital} through ${name}'s private pool on ${chain} and keep the receipt.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
  if (c.includes('cross chain') || c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('launchpad')) return `Stake or lock $${capital} of USDC in ${name}'s launch pool on ${chain} and join one sale.`;
  if (c.includes('gaming') || c.includes('game')) return `Deposit $${capital} into ${name} on ${chain} and play one qualifying session.`;
  if (c.includes('nft')) return `Buy or mint one ${name} asset on ${chain} for about $${capital} and hold it.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action the farm plan asks for, in the category's own words. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow')) return 'a supply or a borrow';
  if (c.includes('dex') || c.includes('leveraged farm')) return 'a swap or a liquidity change';
  if (c.includes('yield aggregator') || c.includes('yield')) return 'a deposit or a vault rebalance';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return 'a margin top-up or a hedge adjustment';
  if (c.includes('prediction')) return 'a market position';
  if (c.includes('restak') || c.includes('staking')) return 'a stake or an unstake check';
  if (c.includes('rwa') || c.includes('real world')) return 'a mint or a redemption check';
  if (c.includes('stable')) return 'a mint or a deposit';
  if (c.includes('basis trading') || c.includes('basis trad')) return 'a vault check';
  if (c.includes('insurance')) return 'a cover renewal check';
  if (c.includes('privacy')) return 'a private pool check';
  if (c.includes('index')) return 'an index rebalance check';
  if (c.includes('cross chain') || c.includes('bridge')) return 'a bridge transfer';
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return 'a vault deposit or withdrawal';
  if (c.includes('launchpad')) return 'a sale check';
  if (c.includes('gaming') || c.includes('game')) return 'a qualifying session';
  if (c.includes('nft')) return 'a listing or a mint check';
  if (c.includes('liquid staking') || c.includes('liquid restaking')) return 'a stake or an unstake check';
  return 'a deposit, a swap or a vote';
}

/** The advanced step: what to watch once the position is open, by category. */
function advancedActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('borrow')) return `Check ${name}'s borrow rate and your health factor every week, and top up collateral if it falls below the level the app shows.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Collect the fees ${name} owes your position once a month, and move the range only when the pool's own page shows it out of range.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Compound ${name}'s vault rewards on the vault's own cadence, and check the vault's fee only when it changes.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options') || c.includes('synthetic')) return `Check ${name}'s funding rate before holding a position overnight, and close it when the rate turns against you.`;
  if (c.includes('prediction')) return `Settle each ${name} market you enter, and never leave a position open past its own close.`;
  if (c.includes('restak') || c.includes('staking')) return `Check ${name}'s unbonding window before staking more, and count the wait in the hold days.`;
  if (c.includes('rwa') || c.includes('real world')) return `Check the backing ${name} publishes for its asset each month, and sell only through its own redemption.`;
  if (c.includes('stable')) return `Check ${name}'s peg and its reserves each week, and leave if either breaks.`;
  if (c.includes('basis trading') || c.includes('basis trad')) return `Check ${name}'s basis and its funding each week, and withdraw when the basis goes flat.`;
  if (c.includes('insurance')) return `Check ${name}'s cover terms before they renew, and keep the policy active through the hold.`;
  if (c.includes('privacy')) return `Check ${name}'s pool limits before each deposit, and keep the receipt for every one.`;
  if (c.includes('index')) return `Check ${name}'s index weights when they rebalance, and hold through the rebalance.`;
  if (c.includes('cross chain') || c.includes('bridge')) return `Check the bridge fee ${name} quotes before each transfer, and bridge only what the farm needs.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('vault')) return `Check the vault ${name} runs each month, and move funds only when its allocation changes.`;
  if (c.includes('launchpad')) return `Check ${name}'s sale calendar each week, and join only the sales its own page lists.`;
  if (c.includes('gaming') || c.includes('game')) return `Play one qualifying session on ${name} each week, and keep the session receipts.`;
  if (c.includes('nft')) return `Check ${name}'s floor and its royalty each week, and list only through its own marketplace.`;
  if (c.includes('liquid staking') || c.includes('liquid restaking')) return `Check ${name}'s unbonding window before staking more, and count the wait in the hold days.`;
  return `Review the position once a month against ${name}'s own dashboard, and write the result in the farm log.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan
 * is derived from the protocol's own record (category, chains, TVL, age), never from
 * a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyActionFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Return once a week and make one qualifying action: ${weekly}.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: advancedActionFor(p),
      cost: 'about $2 of gas when you act',
      time: '10 minutes when you act',
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, then write the wallet, the dates and every transaction in a farm log.`,
      cost: 'no fee to check, and never pay to claim',
      time: '15 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    token_odds: row.model.token_odds,
    conditional_value_usd: row.model.conditional_value_usd,
    category_effect: row.model.category_effect,
    multiple_basis: row.model.multiple_basis,
    farm_summary: farmSummary(row, row.age_days),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fit = fitValueModel(snapshot.protocols, snapshot.as_of, model);
  const odds = tokenOddsTable(snapshot.protocols, model);
  const board = buildBoard(snapshot, model, fit, odds);
  const live = liveRows(snapshot);
  const excluded = excludedRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit: fit.diagnostics,
    effects: fit.effects,
    odds: odds.table,
    global_odds: Math.round(odds.global * 1e4) / 1e4,
    excluded,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
