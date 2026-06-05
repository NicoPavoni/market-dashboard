const STOCK_FUNDAMENTALS = {
  'apple':             { sector: 'Tecnología',       mcapTier: 'Mega Cap',  stabilityScore: 92 },
  'nvidia-corporation':{ sector: 'Semiconductores',  mcapTier: 'Mega Cap',  stabilityScore: 74 },
  'microsoft':         { sector: 'Tecnología',       mcapTier: 'Mega Cap',  stabilityScore: 95 },
  'tesla':             { sector: 'Automotriz/Tech',  mcapTier: 'Large Cap', stabilityScore: 52 },
  'amazon':            { sector: 'E-commerce/Cloud', mcapTier: 'Mega Cap',  stabilityScore: 85 },
  'alphabet':          { sector: 'Tecnología',       mcapTier: 'Mega Cap',  stabilityScore: 90 },
  'meta':              { sector: 'Redes Sociales',   mcapTier: 'Mega Cap',  stabilityScore: 80 },
  'netflix':           { sector: 'Streaming',        mcapTier: 'Large Cap', stabilityScore: 65 },
  'disney':            { sector: 'Entretenimiento',  mcapTier: 'Large Cap', stabilityScore: 68 },
  'coca-cola':         { sector: 'Consumo Básico',   mcapTier: 'Large Cap', stabilityScore: 88 },
  'jpmorgan':          { sector: 'Banca',             mcapTier: 'Mega Cap',  stabilityScore: 82 },
  'visa':              { sector: 'Fintech/Pagos',    mcapTier: 'Mega Cap',  stabilityScore: 93 },
  'amd':               { sector: 'Semiconductores',  mcapTier: 'Large Cap', stabilityScore: 74 },
  'paypal':            { sector: 'Fintech/Pagos',    mcapTier: 'Large Cap', stabilityScore: 65 },
  'uber':              { sector: 'Plataformas Tech', mcapTier: 'Large Cap', stabilityScore: 64 },
  'alibaba':           { sector: 'E-commerce/Asia',  mcapTier: 'Large Cap', stabilityScore: 58 },
  'sp500':             { sector: 'Índice S&P 500',   mcapTier: 'Índice',    stabilityScore: 97 },
  'ypf':               { sector: 'Energía/Argentina',mcapTier: 'Mid Cap',   stabilityScore: 36 },
  'mercadolibre':      { sector: 'E-comm./LatAm',    mcapTier: 'Large Cap', stabilityScore: 74 },
  'globant':           { sector: 'Tecnología/LatAm', mcapTier: 'Mid Cap',   stabilityScore: 70 },
  'despegar':          { sector: 'Turismo/LatAm',    mcapTier: 'Small Cap', stabilityScore: 44 },
  'loma-negra':        { sector: 'Construcción/ARG', mcapTier: 'Small Cap', stabilityScore: 40 },
  'pampa-energia':     { sector: 'Energía/Argentina',mcapTier: 'Mid Cap',   stabilityScore: 42 },
};

async function fetchAllCryptoFundamentals(coinIds) {
  if (!coinIds.length) return {};
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(',')}&order=market_cap_desc&per_page=50&price_change_percentage=30d`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();

    const out = {};
    list.forEach(c => {
      const rank     = c.market_cap_rank || 999;
      const mcap     = c.market_cap      || 0;
      const vol      = c.total_volume    || 0;
      const athChg   = c.ath_change_percentage || 0;
      const chg30    = c.price_change_percentage_30d_in_currency || 0;
      const volRatio = mcap > 0 ? vol / mcap : 0;

      let score = 0;
      score += rank <= 5  ? 38 : rank <= 20 ? 30 : rank <= 50 ? 22 : rank <= 100 ? 14 : 6;
      score += volRatio > 0.15 ? 22 : volRatio > 0.08 ? 16 : volRatio > 0.03 ? 10 : 4;
      score += athChg < -70 ? 22 : athChg < -40 ? 18 : athChg < -20 ? 13 : athChg < -10 ? 8 : 4;
      score += chg30  > 30  ? 18 : chg30  > 10  ? 14 : chg30  > 0   ? 10 : chg30  > -20 ? 6 : 2;

      out[c.id] = {
        rank, mcap, vol, volRatio, athChg, chg30,
        score: Math.min(100, score),
        tier: rank <= 10 ? 'Top 10' : rank <= 50 ? 'Establecida' : rank <= 200 ? 'Media' : 'Pequeña',
        sector: 'Criptomoneda',
        source: 'live',
      };
    });
    return out;
  } catch (e) {
    console.warn('Fundamental fetch failed:', e.message);
    return {};
  }
}

function getStockFundamentals(assetId) {
  const d = STOCK_FUNDAMENTALS[assetId];
  if (!d) return null;
  const score = d.stabilityScore;
  return {
    score,
    tier: score >= 88 ? 'Muy Sólida' : score >= 75 ? 'Sólida' : score >= 60 ? 'Moderada' : 'Especulativa',
    sector: d.sector,
    mcapTier: d.mcapTier,
    source: 'static',
    rank: null,
  };
}

async function loadAllFundamentals(watchlist) {
  const cryptoIds  = watchlist.filter(a => a.type === 'crypto').map(a => a.id);
  const cryptoData = await fetchAllCryptoFundamentals(cryptoIds);

  const out = { ...cryptoData };
  watchlist.filter(a => a.type === 'stock').forEach(a => {
    const d = getStockFundamentals(a.id);
    if (d) out[a.id] = d;
  });
  return out;
}
