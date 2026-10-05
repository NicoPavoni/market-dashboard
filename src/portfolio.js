const PORTFOLIO_KEY = 'mktdash_portfolio_v1';

function loadTrades() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTrades(trades) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(trades));
  dbSaveTrades(trades); // sync to Firebase (fire and forget)
}

async function syncTradesFromCloud() {
  if (!dbIsConfigured()) return false;
  const cloud = await dbLoadTrades();
  if (cloud !== null) {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(cloud)); // update local only
    return true;
  }
  return false;
}

function addTrade(tradeData) {
  const trades = loadTrades();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  trades.push({ ...tradeData, id });
  saveTrades(trades);
  return trades;
}

function removeTrade(id) {
  const trades = loadTrades().filter(t => t.id !== id);
  saveTrades(trades);
  return trades;
}

function updateTrade(id, updates) {
  const trades = loadTrades().map(t => t.id === id ? { ...t, ...updates } : t);
  saveTrades(trades);
  return trades;
}

/** Units of an asset held right now (after sales). */
function heldQuantity(assetId) {
  return computePortfolio({}).positions.find(p => p.assetId === assetId)?.totalQuantity ?? 0;
}

/**
 * Positions use the average-cost method. Trades are replayed in date order:
 * a sale removes the same fraction of quantity and cost basis, and its
 * realized P&L is the USD received minus the cost removed. As with the
 * unrealized P&L, initial balances are left out (their "cost" is just the
 * value they had when registered).
 * For sales (side: 'sell'), `usdInvested` holds the USD received.
 */
function computePortfolio(priceData) {
  const trades = loadTrades();

  const positions = {};
  let totalUsdInvested  = 0;
  let totalCurrentValue = 0;
  let totalRealizedPnl  = 0;
  // P&L totals exclude initial-balance entries
  let totalPnlInvested  = 0;
  let totalPnlCurrVal   = 0;

  const byDate = trades
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date || '').localeCompare(b.t.date || '') || a.i - b.i)
    .map(x => x.t);

  byDate.forEach(t => {
    if (!positions[t.assetId]) {
      positions[t.assetId] = {
        assetId:          t.assetId,
        ticker:           t.ticker,
        assetName:        t.assetName,
        assetType:        t.assetType,
        trades:           [],
        totalUsdInvested: 0,  // cost basis of the units still held
        totalArsInvested: 0,
        totalQuantity:    0,
        pnlInvested:      0,  // non-initial trades only
        pnlQuantity:      0,  // non-initial trades only
        realizedPnl:      0,
        hasSales:         false,
      };
    }
    const pos = positions[t.assetId];
    pos.trades.push(t);

    if (t.side === 'sell') {
      const f = pos.totalQuantity > 0 ? Math.min(1, t.quantity / pos.totalQuantity) : 0;
      pos.realizedPnl      += (pos.pnlQuantity * t.priceUsd - pos.pnlInvested) * f;
      pos.totalUsdInvested *= 1 - f;
      pos.totalArsInvested *= 1 - f;
      pos.totalQuantity    *= 1 - f;
      pos.pnlInvested      *= 1 - f;
      pos.pnlQuantity      *= 1 - f;
      pos.hasSales          = true;
      return;
    }

    pos.totalUsdInvested += t.usdInvested;
    pos.totalArsInvested += t.arsAmount;
    pos.totalQuantity    += t.quantity;
    if (!t.isInitial) {
      pos.pnlInvested += t.usdInvested;
      pos.pnlQuantity += t.quantity;
    }
  });

  Object.values(positions).forEach(pos => {
    const currentPrice = priceData[pos.assetId]?.current ?? 0;
    const currentValue = pos.totalQuantity * currentPrice;
    const pnlCurrVal   = pos.pnlQuantity  * currentPrice;
    const pnlUsd       = pos.pnlInvested > 0 ? pnlCurrVal - pos.pnlInvested : 0;
    const pnlPct       = pos.pnlInvested > 0
      ? (pnlUsd / pos.pnlInvested) * 100
      : 0;
    const avgBuyPrice  = pos.pnlQuantity > 0
      ? pos.pnlInvested / pos.pnlQuantity
      : 0;

    pos.currentPrice  = currentPrice;
    pos.currentValue  = currentValue;
    pos.pnlCurrVal    = pnlCurrVal;
    pos.pnlUsd        = pnlUsd;
    pos.pnlPct        = pnlPct;
    pos.avgBuyPrice   = avgBuyPrice;
    pos.hasPrice      = currentPrice > 0;
    pos.hasNewTrades  = pos.pnlInvested > 0;
    pos.isClosed      = pos.totalQuantity <= 1e-9;

    totalUsdInvested  += pos.totalUsdInvested;
    totalRealizedPnl  += pos.realizedPnl;
    totalCurrentValue += currentValue;
    totalPnlInvested  += pos.pnlInvested;
    totalPnlCurrVal   += pnlCurrVal;
  });

  // Overview P&L is also based on non-initial trades only
  const totalPnlUsd = totalPnlInvested > 0 ? totalPnlCurrVal - totalPnlInvested : 0;
  const totalPnlPct = totalPnlInvested > 0
    ? (totalPnlUsd / totalPnlInvested) * 100
    : 0;

  // Category breakdown uses non-initial for P&L, but tracks all held value too
  const byType = {};
  Object.values(positions).forEach(pos => {
    const t = pos.assetType || 'other';
    if (!byType[t]) byType[t] = { invested: 0, value: 0, totalHeld: 0 };
    byType[t].invested  += pos.pnlInvested;
    byType[t].value     += pos.pnlCurrVal;
    byType[t].totalHeld += pos.currentValue;
  });

  return {
    trades,
    // Open positions first, largest first; fully sold ones at the end
    positions: Object.values(positions).sort((a, b) =>
      a.isClosed - b.isClosed || b.totalUsdInvested - a.totalUsdInvested),
    totalUsdInvested,
    totalCurrentValue,
    totalRealizedPnl,
    totalPnlUsd,
    totalPnlPct,
    byType,
  };
}

// ─── Portfolio history (equity curve) ────────────────────────────────────────

const PF_HISTORY_KEY = 'mktdash_pfhist_v1';

function loadPfHistory() {
  try {
    const raw = localStorage.getItem(PF_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function savePfHistory(history) {
  localStorage.setItem(PF_HISTORY_KEY, JSON.stringify(history));
  dbSavePfHistory(history);
}

function recordPfSnapshot(pf) {
  if (!pf.totalCurrentValue && !pf.totalUsdInvested) return;
  const today = new Date().toISOString().slice(0, 10);
  const history = loadPfHistory();
  const idx = history.findIndex(h => h.date === today);
  const snap = {
    date:     today,
    value:    pf.totalCurrentValue,
    invested: pf.totalUsdInvested,
  };
  if (idx >= 0) {
    history[idx] = snap;
  } else {
    history.push(snap);
  }
  const trimmed = history
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-365);
  savePfHistory(trimmed);
  return trimmed;
}

function getUniqueAssetOptions() {
  const typeOrder = { crypto: 0, stock: 1, bond: 2 };
  return Object.values(KNOWN_ASSETS)
    .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    .sort((a, b) => {
      const ta = typeOrder[a.type] ?? 3;
      const tb = typeOrder[b.type] ?? 3;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
}
