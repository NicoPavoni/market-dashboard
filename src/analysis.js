/**
 * analysis.js — Technical indicators & signal detection
 *
 * Functions:
 *   calculateRSI(prices, period)  → number (0–100)
 *   getMA(prices, period)         → number | null
 *   getSignal(rsi, ma20, ma50, change24h, rsiThreshold) → 'buy'|'wait'|'sell'|'neutral'
 *   analyzeAsset(prices)          → { rsi, ma20, ma50, change24h, signal }
 */

const DEFAULT_RSI_PERIOD = 14;

/**
 * Relative Strength Index (Wilder's smoothing).
 * Requires at least `period + 1` data points.
 */
function calculateRSI(prices, period = DEFAULT_RSI_PERIOD) {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss over first `period` changes
  for (let i = prices.length - period; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Simple Moving Average over the last `period` prices.
 * Returns null if not enough data.
 */
function getMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(4));
}

/**
 * Determines the trading signal for an asset.
 *
 * Rules:
 *  - 'buy'     → RSI ≤ threshold OR (golden cross AND drop > 3 %)
 *  - 'wait'    → RSI ≤ threshold + 10 OR MA20 > MA50
 *  - 'sell'    → RSI ≥ 70
 *  - 'neutral' → everything else
 */
function getSignal(rsi, ma20, ma50, change24h, rsiThreshold = 35) {
  const goldenCross = ma20 && ma50 && ma20 > ma50;

  if (rsi <= rsiThreshold || (goldenCross && change24h < -3)) return 'buy';
  if (rsi <= rsiThreshold + 10 || goldenCross) return 'wait';
  if (rsi >= 70) return 'sell';
  return 'neutral';
}

/**
 * Full analysis for an asset given its price history (oldest → newest).
 * Returns an object with all computed indicators + signal.
 */
function analyzeAsset(prices, rsiThreshold = 35) {
  const rsi      = calculateRSI(prices);
  const ma20     = getMA(prices, 20);
  const ma50     = getMA(prices, 50);
  const current  = prices[prices.length - 1];
  const prev     = prices[prices.length - 2];
  const change24h = prev
    ? parseFloat(((current - prev) / prev * 100).toFixed(2))
    : 0;

  const signal = getSignal(rsi, ma20, ma50, change24h, rsiThreshold);

  return { rsi, ma20, ma50, current, change24h, signal };
}

/**
 * Fetch real price history from CoinGecko (free, no API key needed).
 * Returns { prices: number[], timestamps: number[] } or null on error.
 */
async function fetchCryptoPrices(coinId) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=90`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      prices:     data.prices.map(p => p[1]),
      timestamps: data.prices.map(p => p[0]),
      simulated:  false,
    };
  } catch (err) {
    console.warn(`CoinGecko fetch failed for ${coinId}:`, err.message);
    return null;
  }
}

// ─── data912.com — stocks, CEDEARs & ONs (free, no API key, CORS enabled) ───

const DATA912_URL  = 'https://data912.com';
const LIVE_TTL_MS  = 60_000;
const _livePanels  = {};

/**
 * Fetch a data912 live panel ('usa_stocks', 'usa_adrs', 'arg_cedears',
 * 'arg_stocks', 'arg_bonds', 'arg_corp')
 * as { SYMBOL: row }. Cached for 60 s so a refresh downloads each panel once.
 */
function fetchLivePanel(panel) {
  const hit = _livePanels[panel];
  if (hit && Date.now() - hit.t < LIVE_TTL_MS) return hit.promise;

  const promise = fetch(`${DATA912_URL}/live/${panel}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(rows => Object.fromEntries(rows.map(r => [r.symbol, r])))
    .catch(err => {
      console.warn(`data912 live/${panel} failed:`, err.message);
      if (_livePanels[panel]?.promise === promise) delete _livePanels[panel];
      return {};
    });

  _livePanels[panel] = { t: Date.now(), promise };
  return promise;
}

/** Last traded price for `symbol` in a live panel → { price, pctChange } or null. */
async function fetchLivePrice(panel, symbol) {
  const row   = (await fetchLivePanel(panel))[symbol];
  const price = row && (row.c || row.px_bid);
  return price > 0 ? { price, pctChange: row.pct_change || 0 } : null;
}

/** Live price for a US ticker — regular stocks first, then ADRs (YPF, PAM…). */
async function fetchUsLivePrice(ticker) {
  return (await fetchLivePrice('usa_stocks', ticker))
      ?? (await fetchLivePrice('usa_adrs', ticker));
}

/** MEP rate (ARS per USD) implied by AL30 / AL30D, falling back to GD30. */
async function fetchMepRate() {
  const bonds = await fetchLivePanel('arg_bonds');
  for (const t of ['AL30', 'GD30']) {
    const ars = bonds[t]?.c;
    const usd = bonds[`${t}D`]?.c;
    if (ars > 0 && usd > 0) return ars / usd;
  }
  return null;
}

/**
 * Daily close history from data912 — `path` is e.g. 'usa_stocks/AAPL',
 * 'stocks/GGAL' or 'bonds/AL30D'. Prices are in the instrument's currency.
 * Returns { prices, timestamps } or null on failure.
 */
async function fetchHistory(path, days = 90) {
  try {
    const res = await fetch(`${DATA912_URL}/historical/${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // US endpoint: { dates, prices } — BYMA endpoints: [{ date, c }, …]
    const rows = Array.isArray(data)        ? data.map(r => [r.date, r.c])
               : Array.isArray(data.prices) ? data.dates.map((d, i) => [d, data.prices[i]])
               : null;
    if (!rows) throw new Error(data.detail || data.Error || 'Sin datos');

    const valid = rows.slice(-days - 1)
      // Noon local time so the date doesn't shift a day in UTC-3
      .map(([d, p]) => ({ t: new Date(`${d}T12:00:00`).getTime(), p }))
      .filter(x => x.p != null && isFinite(x.p) && x.p > 0);

    if (valid.length < 5) throw new Error('Datos insuficientes');

    return { prices: valid.map(x => x.p), timestamps: valid.map(x => x.t) };
  } catch (err) {
    console.warn(`data912 history failed for ${path}:`, err.message);
    return null;
  }
}

/**
 * Adds today's live price to a daily history: replaces today's close if it
 * is already there, otherwise appends it (skipped when the market is closed
 * and the live price is just the last close).
 */
function withLivePoint(hist, livePrice) {
  if (!livePrice) return hist;
  const prices     = [...hist.prices];
  const timestamps = [...hist.timestamps];
  const last       = prices.length - 1;

  if (new Date(timestamps[last]).toDateString() === new Date().toDateString()) {
    prices[last] = livePrice;
  } else if (Math.abs(livePrice - prices[last]) / prices[last] > 1e-6) {
    prices.push(livePrice);
    timestamps.push(Date.now());
  }
  return { prices, timestamps };
}

/** Two-point series (yesterday's close → live) for assets without history. */
function livePointOnly(live) {
  const now = Date.now();
  return {
    prices:     [live.price / (1 + live.pctChange / 100), live.price],
    timestamps: [now - 86_400_000, now],
    noHistory:  true,
  };
}

/**
 * Where each market's prices come from:
 *   live       → [panel, symbol] for the current price ('us' = stocks + ADRs)
 *   hist       → history path (null when data912 has none, e.g. ONs)
 *   histLive   → live price of the instrument the history belongs to, when it
 *                is not the asset itself (a CEDEAR uses its US stock's history)
 */
function priceSources(asset) {
  const t = asset.usTicker || asset.ticker;
  switch (asset.market) {
    case 'corp':      return { live: ['arg_corp',    asset.liveSymbol], hist: null };
    case 'cedear':    return { live: ['arg_cedears', asset.liveSymbol], hist: `usa_stocks/${t}`, histLive: ['us', t] };
    case 'arg_stock': return { live: ['arg_stocks',  asset.liveSymbol], hist: `stocks/${asset.liveSymbol}` };
    case 'arg_bond':  return { live: ['arg_bonds',   asset.liveSymbol], hist: `bonds/${asset.liveSymbol}` };
    default:          return { live: ['us', t], hist: `usa_stocks/${t}` };
  }
}

function fetchSourcePrice([panel, symbol]) {
  return panel === 'us' ? fetchUsLivePrice(symbol) : fetchLivePrice(panel, symbol);
}

/**
 * Real prices for a stock / CEDEAR / bond / ON, always in USD.
 * ARS-quoted instruments (asset.ars) are converted with the MEP rate.
 * History is rescaled so its last point matches the live USD price
 * (RSI and moving averages don't depend on the scale).
 * Returns { prices, timestamps, simulated: false } or null on failure.
 */
async function fetchMarketPrices(asset) {
  const src = priceSources(asset);
  const [live, hist, histLive, mep] = await Promise.all([
    fetchSourcePrice(src.live),
    src.hist     ? fetchHistory(src.hist)         : null,
    src.histLive ? fetchSourcePrice(src.histLive) : null,
    asset.ars    ? fetchMepRate()                 : null,
  ]);

  const usdLive = !live      ? null
                : !asset.ars ? live
                : mep        ? { price: live.price / mep, pctChange: live.pctChange }
                : null;

  let series = null;
  if (hist && usdLive) {
    const h     = withLivePoint(hist, src.histLive ? histLive?.price : live.price);
    const scale = usdLive.price / h.prices[h.prices.length - 1];
    series = { prices: h.prices.map(p => p * scale), timestamps: h.timestamps };
  } else if (usdLive) {
    series = livePointOnly(usdLive);
  } else if (hist && !src.histLive && !asset.ars) {
    series = hist; // no live quote (e.g. SPY): last close is the current price
  }

  return series && { ...series, simulated: false };
}

/**
 * Generate plausible simulated price history for stocks.
 * Drift is slightly positive to mimic long-term equity behaviour.
 */
function simulateStockPrices(assetId, days = 91) {
  const base     = STOCK_BASE_PRICES[assetId] || 100;
  const volScale = base > 500 ? 0.022 : base > 100 ? 0.018 : 0.025;
  const prices   = [];
  const timestamps = [];
  const now = Date.now();
  let p = base * (0.88 + Math.random() * 0.24); // random start ±12 %

  for (let i = days - 1; i >= 0; i--) {
    p = p * (1 + (Math.random() - 0.47) * volScale); // slight upward drift
    prices.push(parseFloat(p.toFixed(2)));
    timestamps.push(now - i * 86_400_000);
  }

  return { prices, timestamps, simulated: true };
}

/**
 * Composite score combining technical (50%), fundamental (30%), and macro (20%).
 * Returns { techScore, composite, compositeSignal }.
 */
function getCompositeScore(rsi, ma20, ma50, change24h, rsiThreshold, fundamentalScore, macroScore) {
  let techScore = 50;
  if (rsi <= rsiThreshold) techScore += 30;
  else if (rsi <= rsiThreshold + 10) techScore += 15;
  else if (rsi >= 70) techScore -= 25;
  if (ma20 && ma50 && ma20 > ma50) techScore += 20;
  if (ma20 && ma50 && ma20 > ma50 && change24h < -3) techScore += 10;
  techScore = Math.max(0, Math.min(100, techScore));

  const fScore = fundamentalScore ?? 50;
  const mScore = macroScore ?? 50;
  const composite = Math.round(techScore * 0.50 + fScore * 0.30 + mScore * 0.20);

  const compositeSignal =
    composite >= 68 ? 'buy'     :
    composite >= 50 ? 'wait'    :
    composite >= 32 ? 'neutral' : 'sell';

  return { techScore, composite, compositeSignal };
}

/**
 * Load price data for a single asset.
 * Crypto → CoinGecko (real). Stock/Bond → data912 (real, fallback sim).
 * Returns enriched object ready for rendering.
 */
async function loadAssetData(asset, rsiThreshold = 35) {
  let raw = null;

  if (asset.type === 'crypto') {
    raw = await fetchCryptoPrices(asset.id);
  } else if (asset.type === 'stock' || asset.type === 'bond') {
    raw = await fetchMarketPrices(asset);
  }

  if (!raw) {
    // Fallback: generate simulated history (marks simulated: true)
    raw = simulateStockPrices(asset.id);
  }

  const analysis = analyzeAsset(raw.prices, rsiThreshold);

  return {
    ...raw,
    ...analysis,
  };
}
