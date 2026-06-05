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
    };
  } catch (err) {
    console.warn(`CoinGecko fetch failed for ${coinId}:`, err.message);
    return null;
  }
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
 * Load price data for a single asset (crypto = real, stock = simulated).
 * Returns enriched object ready for rendering.
 */
async function loadAssetData(asset, rsiThreshold = 35) {
  let raw = null;

  if (asset.type === 'crypto') {
    raw = await fetchCryptoPrices(asset.id);
  }

  if (!raw) {
    raw = simulateStockPrices(asset.id);
  }

  const analysis = analyzeAsset(raw.prices, rsiThreshold);

  return {
    ...raw,
    ...analysis,
  };
}
