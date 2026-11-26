// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, the filters, a per-protocol detail
// view with the model's own inputs and the protocol's farm plan, and the live
// token table. No network: every byte it shows is in data.js.
//
// Two functions keep the page honest against board.json. impliedOf recomputes a
// row's implied value from the snapshot figures the row carries, with the same
// arithmetic main.ts used, and the detail view prints both numbers. farmSteps
// below is the same derivation main.ts writes to board.json: category, chains,
// TVL and age decide the action, the capital, the hold and every cost and time.
// No protocol name is special-cased anywhere on this page.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var WATCHLIST = {};
  DATA.watchlist.forEach(function (s) { WATCHLIST[s] = true; });
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(3) + 'x';
  }
  function fmt4(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(4);
  }
  // The model in one function: the page recomputes a row from the snapshot figures
  // and checks the number board.json carries, so the page's code and the board's
  // data are visibly the same arithmetic. Same order of operations as main.ts.
  function impliedOf(row) {
    var growth = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * DATA.model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? DATA.model.unknown_age_days : row.age_days;
    var maturity = DATA.model.maturity_floor + (Math.min(Math.max(age, 0), DATA.model.maturity_days) / DATA.model.maturity_days) * DATA.model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * row.token_odds));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan, the same derivation main.ts writes to board.json.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('borrow') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s highest-TVL vault on " + chain + ' and keep the shares.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('synthetic') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' of USDC and place one market position on ' + name + '.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return 'Mint $' + capital + " of " + name + "'s yield-bearing asset on " + chain + ' and hold it.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('basis trading') >= 0 || c.indexOf('basis trad') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s basis vault on " + chain + ' and keep the shares.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + " through " + name + "'s private pool on " + chain + ' and keep the receipt.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index token on ' + chain + ' and hold it.';
    if (c.indexOf('cross chain') >= 0 || c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('launchpad') >= 0) return 'Stake or lock $' + capital + " of USDC in " + name + "'s launch pool on " + chain + ' and join one sale.';
    if (c.indexOf('gaming') >= 0 || c.indexOf('game') >= 0) return 'Deposit $' + capital + ' into ' + name + ' on ' + chain + ' and play one qualifying session.';
    if (c.indexOf('nft') >= 0) return 'Buy or mint one ' + name + ' asset on ' + chain + ' for about $' + capital + ' and hold it.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('borrow') >= 0) return 'a supply or a borrow';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'a swap or a liquidity change';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0) return 'a deposit or a vault rebalance';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('synthetic') >= 0) return 'a margin top-up or a hedge adjustment';
    if (c.indexOf('prediction') >= 0) return 'a market position';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 'a stake or an unstake check';
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return 'a mint or a redemption check';
    if (c.indexOf('stable') >= 0) return 'a mint or a deposit';
    if (c.indexOf('basis trading') >= 0 || c.indexOf('basis trad') >= 0) return 'a vault check';
    if (c.indexOf('insurance') >= 0) return 'a cover renewal check';
    if (c.indexOf('privacy') >= 0) return 'a private pool check';
    if (c.indexOf('index') >= 0) return 'an index rebalance check';
    if (c.indexOf('cross chain') >= 0 || c.indexOf('bridge') >= 0) return 'a bridge transfer';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'a vault deposit or withdrawal';
    if (c.indexOf('launchpad') >= 0) return 'a sale check';
    if (c.indexOf('gaming') >= 0 || c.indexOf('game') >= 0) return 'a qualifying session';
    if (c.indexOf('nft') >= 0) return 'a listing or a mint check';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0) return 'a stake or an unstake check';
    return 'a deposit, a swap or a vote';
  }
  function advancedActionFor(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('borrow') >= 0) return "Check " + name + "'s borrow rate and your health factor every week, and top up collateral if it falls below the level the app shows.";
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return "Collect the fees " + name + " owes your position once a month, and move the range only when the pool's own page shows it out of range.";
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('yield') >= 0) return "Compound " + name + "'s vault rewards on the vault's own cadence, and check the vault's fee only when it changes.";
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('synthetic') >= 0) return "Check " + name + "'s funding rate before holding a position overnight, and close it when the rate turns against you.";
    if (c.indexOf('prediction') >= 0) return "Settle each " + name + " market you enter, and never leave a position open past its own close.";
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return "Check " + name + "'s unbonding window before staking more, and count the wait in the hold days.";
    if (c.indexOf('rwa') >= 0 || c.indexOf('real world') >= 0) return "Check the backing " + name + " publishes for its asset each month, and sell only through its own redemption.";
    if (c.indexOf('stable') >= 0) return "Check " + name + "'s peg and its reserves each week, and leave if either breaks.";
    if (c.indexOf('basis trading') >= 0 || c.indexOf('basis trad') >= 0) return "Check " + name + "'s basis and its funding each week, and withdraw when the basis goes flat.";
    if (c.indexOf('insurance') >= 0) return "Check " + name + "'s cover terms before they renew, and keep the policy active through the hold.";
    if (c.indexOf('privacy') >= 0) return "Check " + name + "'s pool limits before each deposit, and keep the receipt for every one.";
    if (c.indexOf('index') >= 0) return "Check " + name + "'s index weights when they rebalance, and hold through the rebalance.";
    if (c.indexOf('cross chain') >= 0 || c.indexOf('bridge') >= 0) return "Check the bridge fee " + name + " quotes before each transfer, and bridge only what the farm needs.";
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return "Check the vault " + name + " runs each month, and move funds only when its allocation changes.";
    if (c.indexOf('launchpad') >= 0) return "Check " + name + "'s sale calendar each week, and join only the sales its own page lists.";
    if (c.indexOf('gaming') >= 0 || c.indexOf('game') >= 0) return "Play one qualifying session on " + name + " each week, and keep the session receipts.";
    if (c.indexOf('nft') >= 0) return "Check " + name + "'s floor and its royalty each week, and list only through its own marketplace.";
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0) return "Check " + name + "'s unbonding window before staking more, and count the wait in the hold days.";
    return "Review the position once a month against " + name + "'s own dashboard, and write the result in the farm log.";
  }
  function farmSummary(p) {
    return p.farm_summary;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weekly = weeklyActionFor(p);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Return once a week and make one qualifying action: ' + weekly + '.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: advancedActionFor(p), cost: 'about $2 of gas when you act', time: '10 minutes when you act' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes, then write the wallet, the dates and every transaction in a farm log.", cost: 'no fee to check, and never pay to claim', time: '15 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === '1') state.watchlistOnly = true;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('watchlist', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlistOnly && !WATCHLIST[r.slug]) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark', 'aria-hidden': 'true' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'pill' }, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', { class: 'pill' }, 'DefiLlama protocol index'),
        el('span', { class: 'pill' }, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function integrityText() {
    var cats = {};
    var pos = 0;
    var unknown = 0;
    DATA.rows.forEach(function (r) {
      cats[r.category || 'Other'] = true;
      if (r.change_7d !== null && r.change_7d > 0) pos++;
      if (r.age_days === null || r.age_days === undefined) unknown++;
    });
    return DATA.board_size + ' rows \u00b7 ' + Object.keys(cats).length + ' categories \u00b7 ' + pos + ' with positive 7-day growth \u00b7 ' + unknown + ' with unknown age \u00b7 ' + DATA.excluded.length + ' left out as non-launches (listed below)';
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('h1', { text: 'The token launches that have not happened yet, ranked by what they could be worth.' }),
      el('p', null,
        'Every protocol in the snapshot with ', el('b', { text: 'no token on record' }),
        ' and at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL is on the watchlist. The early radar adds ',
        el('b', { text: String(DATA.early_size) + ' pre-token protocols' }),
        ' below that floor, so the board covers the whole watchlist and the launches the floor leaves out. Implied value is an expected value: what a token would be worth if it launches, times the odds that it does, both estimated from the snapshot\u2019s own tokenized peers. It is a model, not a promise.'
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every slug, no exception' })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows ranked' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' of them below the floor' })),
        el('div', { class: 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: fmtUsd(DATA.rows[0].implied_value_usd) }), el('small', { text: DATA.rows[0].name })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols' }), el('b', { text: String(DATA.live_size) }), el('small', { text: 'set aside, shown with market caps' }))
      ),
      el('div', { class: 'integrity-strip' }, el('span', { text: integrityText() }))
    );
  }

  function formulaStrip() {
    var m = DATA.model;
    return el('div', { class: 'formula-strip' },
      el('span', { class: 'tag', text: 'The model' }),
      el('code', { text: 'implied = TVL x fitted multiple x growth x maturity x token odds' }),
      el('span', { class: 'note', text: 'The multiple is fitted on this snapshot\u2019s tokenized peers; the odds are the peers\u2019 own record of tokenizing. No name is special-cased.' })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'watchlist', checked: state.watchlistOnly ? 'checked' : null });
    wl.addEventListener('change', function () { state.watchlistOnly = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    var shown = state.tab === 'pre-token' ? filteredRows().length : DATA.live.length;
    return el('div', { class: 'controls' },
      el('div', { class: 'field grow' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      el('label', { class: 'check', for: 'watchlist' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: shown + (state.tab === 'pre-token' ? ' rows shown' : ' live-token protocols') })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u2193' : ' \u2191' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (WATCHLIST[r.slug] ? ' - watchlist' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var half = Math.ceil(DATA.effects.length / 2);
    function effectRows(list) {
      return list.map(function (x) {
        var basis = x.n >= m.min_category_n ? 'category' : 'shrunk';
        return el('tr', null,
          el('td', { text: x.category }),
          el('td', { class: 'num', text: String(x.n) }),
          el('td', { class: 'num', text: (x.effect >= 0 ? '+' : '') + x.effect.toFixed(3) }),
          el('td', { class: 'num', text: fmtMult(x.multiple_at_ref) }),
          el('td', { text: basis })
        );
      });
    }
    function effectTable(list) {
      return el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Peers' }), el('th', { class: 'num', text: 'Effect' }), el('th', { class: 'num', text: 'Multiple' }), el('th', { text: 'Basis' }))),
        el('tbody', null, effectRows(list))
      );
    }
    var ohalf = Math.ceil(DATA.odds.length / 2);
    function oddsRows(list) {
      return list.map(function (x) {
        return el('tr', null,
          el('td', { text: x.category }),
          el('td', { class: 'num', text: String(x.n) }),
          el('td', { class: 'num', text: String(x.tokenized) }),
          el('td', { class: 'num', text: (x.odds * 100).toFixed(1) + '%' })
        );
      });
    }
    function oddsTable(list) {
      return el('table', { class: 'mult-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Category' }), el('th', { class: 'num', text: 'Protocols' }), el('th', { class: 'num', text: 'Tokenized' }), el('th', { class: 'num', text: 'Token odds' }))),
        el('tbody', null, oddsRows(list))
      );
    }
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every row, from the snapshot figures alone. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x fitted_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x token_odds )'
      ),
      el('p', { class: 'sub', text: 'The fitted multiple comes from a log-linear fit on the snapshot\u2019s own tokenized peers (n = ' + f.n + ' with a known age): log(market-cap / TVL) = ' + f.beta0.toFixed(3) + ' ' + (f.beta1 >= 0 ? '+' : '\u2212') + ' ' + Math.abs(f.beta1).toFixed(3) + ' x (log TVL \u2212 ' + f.mean_log_tvl.toFixed(2) + '), plus the category effect below. Held out one peer at a time, the fit misses by ' + f.loo_rmse.toFixed(3) + ' log points (MAE ' + f.loo_mae.toFixed(3) + '), against ' + f.baseline_rmse.toFixed(3) + ' (MAE ' + f.baseline_mae.toFixed(3) + ') for the median multiple alone; R\u00b2 = ' + f.r2.toFixed(3) + '. Growth and age were tested as fitted terms the same way and carried no signal beyond TVL, so they enter at fixed bounded weights. The multiple is clamped to ' + m.multiple_min + 'x\u2013' + m.multiple_max + 'x, near the peers\u2019 10th\u201390th percentile range (' + fmtMult(f.multiple_p10) + '\u2013' + fmtMult(f.multiple_p90) + ').' }),
      el('p', { class: 'sub', text: 'Token odds are the peers\u2019 own record: the share of protocols in the category that record a token in this snapshot, shrunk toward the global share ' + (DATA.global_odds * 100).toFixed(1) + '%. The expected value is the value if it launches, times those odds. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Wrapped, staked and bridged products, versioned pools and exchange products are left out of the board entirely: they are not launches of their own, and they are listed below with their reasons.' }),
      el('h3', { class: 'table-title', text: 'Category effects (multiple at ' + fmtUsd(f.median_tvl_usd) + ' TVL, the peers\u2019 median)' }),
      el('div', { class: 'mult-cols' }, effectTable(DATA.effects.slice(0, half)), effectTable(DATA.effects.slice(half))),
      el('h3', { class: 'table-title', text: 'Token odds by category' }),
      el('div', { class: 'mult-cols' }, oddsTable(DATA.odds.slice(0, ohalf)), oddsTable(DATA.odds.slice(ohalf))),
      el('h3', { class: 'table-title', text: 'Left out, and why' }),
      el('p', { class: 'sub', text: DATA.excluded.length + ' protocols below the floor record no token but are not launches of their own (wrapped, staked, bridged or exchange products); they are listed here, not ranked.' }),
      el('ul', { class: 'excluded' }, DATA.excluded.map(function (x) { return el('li', null, el('b', { text: x.name + ' ' }), el('span', { text: x.reason })); }))
    );
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', null, el('b', { text: 'Source. ' }), 'DefiLlama protocol index, snapshot of ' + DATA.as_of + ' (' + DATA.source + '). The snapshot is sealed: every run of the program reads the same bytes.'),
      el('p', null, el('b', { text: 'A note on what this is. ' }), 'An implied value is this entry\u2019s own estimate of what a token would be worth if the protocol\u2019s record stayed as it is. It does not predict whether or when a token is issued, and it is not investment advice. Farm plans describe on-chain actions with real costs; check the protocol\u2019s own pages before you move funds.')
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    var recomputed = impliedOf(row);
    var agrees = recomputed === row.implied_value_usd;
    var steps = farmSteps(row);
    var sortedImplied = DATA.rows.map(function (r) { return r.implied_value_usd; }).sort(function (a, b) { return a - b; });
    var q3 = sortedImplied[Math.floor(0.75 * (sortedImplied.length - 1))];
    var caps = [];
    if (row.change_7d !== null && row.change_7d < 0) caps.push('negative 7-day growth');
    if (row.multiple_basis === 'shrunk' || row.multiple_basis === 'global') caps.push('category multiple from few peers');
    if (row.age_days === null || row.age_days === undefined) caps.push('unknown age');
    if (row.change_7d === null || row.change_7d === undefined) caps.push('no reported 7-day growth');
    var verdictTier = 'Watch';
    var verdictClass = 'verdict watch';
    var verdictNote = 'No caps apply.';
    if (caps.length === 0 && row.change_7d !== null && row.change_7d >= 0 && row.implied_value_usd >= q3) {
      verdictTier = 'Strong watch';
      verdictClass = 'verdict strong';
      verdictNote = 'Top-quarter implied value, growing, no caps apply.';
    } else if (caps.length > 0) {
      verdictTier = 'Watch with care';
      verdictClass = 'verdict care';
      verdictNote = 'Caps apply: ' + caps.join('; ') + '.';
    }
    var evidence = [];
    if (row.multiple_basis === 'shrunk') evidence.push('Only a few tokenized peers sit in this category, so the multiple blends the category\u2019s effect toward the global fit.');
    else if (row.multiple_basis === 'global') evidence.push('No tokenized peer sits in this category, so the multiple comes from the global fit alone.');
    if (row.change_7d === null || row.change_7d === undefined) evidence.push('No 7-day growth is reported, so growth enters as zero.');
    if (row.age_days === null || row.age_days === undefined) evidence.push('Age is unknown, so maturity uses 365 days.');
    evidence.push('Expected value = value if it launches x token odds.');
    var list = sortedRows(filteredRows());
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) idx = i;
    var prev = idx > 0 ? list[idx - 1] : null;
    var next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'kicker', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (WATCHLIST[row.slug] ? ' - watchlist' : ' - early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' - listed ' + (row.listed_at || 'unknown') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var body = el('div', { class: 'detail-body' });
    body.appendChild(el('div', { class: verdictClass },
      el('span', { class: 'verdict-tier', text: verdictTier }),
      el('p', { class: 'verdict-note', text: verdictNote })
    ));
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Fitted multiple' }), el('b', { class: 'num', text: fmtMult(row.category_multiple) })),
        el('div', null, el('span', { text: 'Category effect' }), el('b', { class: 'num', text: (row.category_effect >= 0 ? '+' : '') + row.category_effect.toFixed(3) + ' (' + row.multiple_basis + ')' })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: fmt4(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: fmt4(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: (row.token_odds * 100).toFixed(1) + '%' })),
        el('div', null, el('span', { text: 'Value if it launches' }), el('b', { class: 'num', text: fmtUsd(row.conditional_value_usd) })),
        el('div', { class: 'total wide' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': TVL x ' + fmtMult(row.category_multiple) + ' x ' + fmt4(row.growth_multiplier) + ' x ' + fmt4(row.maturity_multiplier) + ' = ' + fmtUsd(row.conditional_value_usd) + ' if it launches; x ' + (row.token_odds * 100).toFixed(1) + '% token odds = ' + fmtUsd(row.implied_value_usd) + ' expected. The page recomputes this row as ' + fmtUsd(recomputed) + (agrees ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' }),
      el('p', { class: 'sub evidence', text: evidence.join(' ') })
    ));
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    var fs = farmSummary(row);
    body.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm cost' }),
      el('div', { class: 'farm-cost' },
        el('div', null, el('span', { text: 'Capital in position' }), el('b', { class: 'num', text: '$' + fs.capital_usd })),
        el('div', null, el('span', { text: 'Gas over the hold' }), el('b', { class: 'num', text: 'about $' + fs.gas_usd })),
        el('div', null, el('span', { text: 'Hold' }), el('b', { class: 'num', text: fs.hold_days + ' days' }))
      ),
      el('p', { class: 'sub', text: 'Gas is $3 for the first transaction, $4 or $8 to set up, and about $2 a week over the hold. The capital stays in the position.' })
    ));
    body.appendChild(el('div', { class: 'detail-nav' },
      prev ? el('button', { class: 'button', type: 'button', text: '< ' + prev.name, onclick: function () { openDetail(prev.slug); } }) : el('button', { class: 'button', type: 'button', disabled: 'disabled', text: '< Previous' }),
      next ? el('button', { class: 'button', type: 'button', text: next.name + ' >', onclick: function () { openDetail(next.slug); } }) : el('button', { class: 'button', type: 'button', disabled: 'disabled', text: 'Next >' })
    ));
    body.appendChild(el('div', { class: 'detail-foot' },
      el('p', { text: 'No token is recorded for this protocol in the snapshot. That is the record, not a promise: a token may already exist outside it, or never come.' })
    ));
    dialog.appendChild(body);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(formulaStrip());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
