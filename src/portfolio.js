const PORTFOLIO_KEY = 'mktdash_portfolio_v1';

function loadTrades() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTrades(trades, _skipCloud) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(trades));
  if (!_skipCloud) dbSaveTrades(trades); // fire and forget
}

async function syncTradesFromCloud() {
  if (!dbIsConfigured()) return false;
  const cloud = await dbLoadTrades();
  if (cloud !== null) {
    saveTrades(cloud, true); // update local only, don't echo back
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

function computePortfolio(priceData) {
  const trades = loadTrades();

  const positions = {};
  let totalUsdInvested  = 0;
  let totalCurrentValue = 0;

  trades.forEach(t => {
    if (!positions[t.assetId]) {
      positions[t.assetId] = {
        assetId:         t.assetId,
        ticker:          t.ticker,
        assetName:       t.assetName,
        assetType:       t.assetType,
        trades:          [],
        totalUsdInvested: 0,
        totalArsInvested: 0,
        totalQuantity:   0,
      };
    }
    const pos = positions[t.assetId];
    pos.trades.push(t);
    pos.totalUsdInvested  += t.usdInvested;
    pos.totalArsInvested  += t.arsAmount;
    pos.totalQuantity     += t.quantity;
    totalUsdInvested      += t.usdInvested;
  });

  Object.values(positions).forEach(pos => {
    const currentPrice = priceData[pos.assetId]?.current ?? 0;
    const currentValue = pos.totalQuantity * currentPrice;
    const pnlUsd       = currentValue - pos.totalUsdInvested;
    const pnlPct       = pos.totalUsdInvested > 0
      ? (pnlUsd / pos.totalUsdInvested) * 100
      : 0;
    const avgBuyPrice  = pos.totalQuantity > 0
      ? pos.totalUsdInvested / pos.totalQuantity
      : 0;

    pos.currentPrice  = currentPrice;
    pos.currentValue  = currentValue;
    pos.pnlUsd        = pnlUsd;
    pos.pnlPct        = pnlPct;
    pos.avgBuyPrice   = avgBuyPrice;
    pos.hasPrice      = currentPrice > 0;

    totalCurrentValue += currentValue;
  });

  const totalPnlUsd = totalCurrentValue - totalUsdInvested;
  const totalPnlPct = totalUsdInvested > 0
    ? (totalPnlUsd / totalUsdInvested) * 100
    : 0;

  return {
    trades,
    positions: Object.values(positions).sort((a, b) => b.totalUsdInvested - a.totalUsdInvested),
    totalUsdInvested,
    totalCurrentValue,
    totalPnlUsd,
    totalPnlPct,
  };
}

function getUniqueAssetOptions() {
  return Object.values(KNOWN_ASSETS)
    .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'crypto' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
