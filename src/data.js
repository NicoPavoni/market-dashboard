/**
 * data.js — Watchlist initial state and known assets catalog
 *
 * To add a new crypto: add an entry to KNOWN_ASSETS with type: 'crypto'
 *   and set `id` to the CoinGecko coin id (e.g. 'bitcoin', 'solana').
 *
 * Stock / bond prices come from data912.com (free, no API key, CORS enabled).
 * All prices are in USD; simulated prices are only used if the API fails.
 *
 * To add a US stock/ETF: add an entry with type: 'stock'. Prices are fetched
 *   using `asset.ticker` (e.g. 'AAPL', 'SPY').
 *
 * To add a CEDEAR: add type: 'stock', market: 'cedear', `liveSymbol` set to
 *   the USD (MEP) ticker on BYMA — usually the ticker + 'D' (e.g. 'VISTD') —
 *   and `usTicker` set to the underlying US ticker (used for price history).
 *
 * To add an ON (corporate bond) on BYMA: add type: 'bond', market: 'corp' and
 *   `liveSymbol` set to the USD (MEP) ticker, price per 100 VN (e.g. 'YM34D').
 *   data912 has no history for ONs, so only the live price is shown.
 */

// Default watchlist loaded on first visit
const DEFAULT_WATCHLIST = [
  { id: 'bitcoin',             ticker: 'BTC',  name: 'Bitcoin',   type: 'crypto' },
  { id: 'ethereum',            ticker: 'ETH',  name: 'Ethereum',  type: 'crypto' },
  { id: 'solana',              ticker: 'SOL',  name: 'Solana',    type: 'crypto' },
  { id: 'apple',               ticker: 'AAPL', name: 'Apple',     type: 'stock'  },
  { id: 'nvidia-corporation',  ticker: 'NVDA', name: 'NVIDIA',    type: 'stock'  },
];

// Full catalog — used for the "add asset" feature
const KNOWN_ASSETS = {
  // ── Cryptos ──────────────────────────────────────────────
  'btc':        { id: 'bitcoin',           ticker: 'BTC',  name: 'Bitcoin',       type: 'crypto' },
  'bitcoin':    { id: 'bitcoin',           ticker: 'BTC',  name: 'Bitcoin',       type: 'crypto' },
  'eth':        { id: 'ethereum',          ticker: 'ETH',  name: 'Ethereum',      type: 'crypto' },
  'ethereum':   { id: 'ethereum',          ticker: 'ETH',  name: 'Ethereum',      type: 'crypto' },
  'sol':        { id: 'solana',            ticker: 'SOL',  name: 'Solana',        type: 'crypto' },
  'solana':     { id: 'solana',            ticker: 'SOL',  name: 'Solana',        type: 'crypto' },
  'bnb':        { id: 'binancecoin',       ticker: 'BNB',  name: 'BNB',           type: 'crypto' },
  'ada':        { id: 'cardano',           ticker: 'ADA',  name: 'Cardano',       type: 'crypto' },
  'cardano':    { id: 'cardano',           ticker: 'ADA',  name: 'Cardano',       type: 'crypto' },
  'xrp':        { id: 'ripple',            ticker: 'XRP',  name: 'XRP',           type: 'crypto' },
  'ripple':     { id: 'ripple',            ticker: 'XRP',  name: 'XRP',           type: 'crypto' },
  'doge':       { id: 'dogecoin',          ticker: 'DOGE', name: 'Dogecoin',      type: 'crypto' },
  'dogecoin':   { id: 'dogecoin',          ticker: 'DOGE', name: 'Dogecoin',      type: 'crypto' },
  'avax':       { id: 'avalanche-2',       ticker: 'AVAX', name: 'Avalanche',     type: 'crypto' },
  'avalanche':  { id: 'avalanche-2',       ticker: 'AVAX', name: 'Avalanche',     type: 'crypto' },
  'link':       { id: 'chainlink',         ticker: 'LINK', name: 'Chainlink',     type: 'crypto' },
  'chainlink':  { id: 'chainlink',         ticker: 'LINK', name: 'Chainlink',     type: 'crypto' },
  'dot':        { id: 'polkadot',          ticker: 'DOT',  name: 'Polkadot',      type: 'crypto' },
  'polkadot':   { id: 'polkadot',          ticker: 'DOT',  name: 'Polkadot',      type: 'crypto' },
  'matic':      { id: 'matic-network',     ticker: 'POL',  name: 'Polygon',       type: 'crypto' },
  'polygon':    { id: 'matic-network',     ticker: 'POL',  name: 'Polygon',       type: 'crypto' },
  'uni':        { id: 'uniswap',           ticker: 'UNI',  name: 'Uniswap',       type: 'crypto' },
  'atom':       { id: 'cosmos',            ticker: 'ATOM', name: 'Cosmos',        type: 'crypto' },
  'ltc':        { id: 'litecoin',          ticker: 'LTC',  name: 'Litecoin',      type: 'crypto' },
  'litecoin':   { id: 'litecoin',          ticker: 'LTC',  name: 'Litecoin',      type: 'crypto' },
  'pepe':       { id: 'pepe',              ticker: 'PEPE', name: 'Pepe',          type: 'crypto' },

  // ── Stocks ───────────────────────────────────────────────
  'aapl':       { id: 'apple',             ticker: 'AAPL', name: 'Apple',         type: 'stock' },
  'apple':      { id: 'apple',             ticker: 'AAPL', name: 'Apple',         type: 'stock' },
  'nvda':       { id: 'nvidia-corporation',ticker: 'NVDA', name: 'NVIDIA',        type: 'stock' },
  'nvidia':     { id: 'nvidia-corporation',ticker: 'NVDA', name: 'NVIDIA',        type: 'stock' },
  'msft':       { id: 'microsoft',         ticker: 'MSFT', name: 'Microsoft',     type: 'stock' },
  'microsoft':  { id: 'microsoft',         ticker: 'MSFT', name: 'Microsoft',     type: 'stock' },
  'tsla':       { id: 'tesla',             ticker: 'TSLA', name: 'Tesla',         type: 'stock' },
  'tesla':      { id: 'tesla',             ticker: 'TSLA', name: 'Tesla',         type: 'stock' },
  'amzn':       { id: 'amazon',            ticker: 'AMZN', name: 'Amazon',        type: 'stock' },
  'amazon':     { id: 'amazon',            ticker: 'AMZN', name: 'Amazon',        type: 'stock' },
  'googl':      { id: 'alphabet',          ticker: 'GOOGL',name: 'Alphabet',      type: 'stock' },
  'alphabet':   { id: 'alphabet',          ticker: 'GOOGL',name: 'Alphabet',      type: 'stock' },
  'meta':       { id: 'meta',              ticker: 'META', name: 'Meta',          type: 'stock' },
  'nflx':       { id: 'netflix',           ticker: 'NFLX', name: 'Netflix',       type: 'stock' },
  'netflix':    { id: 'netflix',           ticker: 'NFLX', name: 'Netflix',       type: 'stock' },
  'dis':        { id: 'disney',            ticker: 'DIS',  name: 'Disney',        type: 'stock' },
  'disney':     { id: 'disney',            ticker: 'DIS',  name: 'Disney',        type: 'stock' },
  'ko':         { id: 'coca-cola',         ticker: 'KO',   name: 'Coca-Cola',     type: 'stock' },
  'jpm':        { id: 'jpmorgan',          ticker: 'JPM',  name: 'JPMorgan',      type: 'stock' },
  'v':          { id: 'visa',              ticker: 'V',    name: 'Visa',          type: 'stock' },
  'amd':        { id: 'amd',              ticker: 'AMD',  name: 'AMD',            type: 'stock' },
  'pypl':       { id: 'paypal',           ticker: 'PYPL', name: 'PayPal',         type: 'stock' },
  'paypal':     { id: 'paypal',           ticker: 'PYPL', name: 'PayPal',         type: 'stock' },
  'uber':       { id: 'uber',             ticker: 'UBER', name: 'Uber',           type: 'stock' },
  'baba':       { id: 'alibaba',          ticker: 'BABA', name: 'Alibaba',        type: 'stock' },
  'alibaba':    { id: 'alibaba',          ticker: 'BABA', name: 'Alibaba',        type: 'stock' },

  // ── Latam & Índices ────────────────────────────────────────────────────
  'spy':        { id: 'sp500',            ticker: 'SPY',  name: 'S&P 500',        type: 'stock' },
  'sp500':      { id: 'sp500',            ticker: 'SPY',  name: 'S&P 500',        type: 'stock' },
  'spx':        { id: 'sp500',            ticker: 'SPY',  name: 'S&P 500',        type: 'stock' },
  'ypf':        { id: 'ypf',              ticker: 'YPF',  name: 'YPF',            type: 'stock' },
  'meli':       { id: 'mercadolibre',     ticker: 'MELI', name: 'Mercado Libre',  type: 'stock' },
  'mercadolibre':{ id: 'mercadolibre',   ticker: 'MELI', name: 'Mercado Libre',  type: 'stock' },
  'glob':       { id: 'globant',          ticker: 'GLOB', name: 'Globant',        type: 'stock' },
  'globant':    { id: 'globant',          ticker: 'GLOB', name: 'Globant',        type: 'stock' },
  'desp':       { id: 'despegar',         ticker: 'DESP', name: 'Despegar',       type: 'stock' },
  'despegar':   { id: 'despegar',         ticker: 'DESP', name: 'Despegar',       type: 'stock' },
  'loma':       { id: 'loma-negra',       ticker: 'LOMA', name: 'Loma Negra',     type: 'stock' },
  'pamp':       { id: 'pampa-energia',    ticker: 'PAM',  name: 'Pampa Energía',  type: 'stock' },

  // ── CEDEARs (BYMA, cotización en USD MEP) ─────────────────────────────
  'vist':       { id: 'vista-cedear', ticker: 'VIST', name: 'Vista Energy (CEDEAR)', type: 'stock', market: 'cedear', liveSymbol: 'VISTD', usTicker: 'VIST' },
  'vista':      { id: 'vista-cedear', ticker: 'VIST', name: 'Vista Energy (CEDEAR)', type: 'stock', market: 'cedear', liveSymbol: 'VISTD', usTicker: 'VIST' },
  'vistd':      { id: 'vista-cedear', ticker: 'VIST', name: 'Vista Energy (CEDEAR)', type: 'stock', market: 'cedear', liveSymbol: 'VISTD', usTicker: 'VIST' },

  // ── Obligaciones Negociables (Bonos BYMA) ────────────────────────────
  // liveSymbol is the USD (MEP) ticker on BYMA, priced per 100 VN
  'ym34o':      { id: 'ym34o',  ticker: 'YM34O',  name: 'YPF ON 2034 (YM34O)',    type: 'bond', market: 'corp', liveSymbol: 'YM34D' },
  'ypf-on':     { id: 'ym34o',  ticker: 'YM34O',  name: 'YPF ON 2034 (YM34O)',    type: 'bond', market: 'corp', liveSymbol: 'YM34D' },
  'ymcho':      { id: 'ym34o',  ticker: 'YM34O',  name: 'YPF ON 2034 (YM34O)',    type: 'bond', market: 'corp', liveSymbol: 'YM34D' },
  'tlcto':      { id: 'tlcto',  ticker: 'TLCTO',  name: 'Telecom ON USD (TLCTO)', type: 'bond', market: 'corp', liveSymbol: 'TLCTD' },
  'telecom-on': { id: 'tlcto',  ticker: 'TLCTO',  name: 'Telecom ON USD (TLCTO)', type: 'bond', market: 'corp', liveSymbol: 'TLCTD' },
  'tlcmo':      { id: 'tlcto',  ticker: 'TLCTO',  name: 'Telecom ON USD (TLCTO)', type: 'bond', market: 'corp', liveSymbol: 'TLCTD' },
};

// Simulated base prices for stocks (used when real API not available)
const STOCK_BASE_PRICES = {
  'apple':             195,
  'nvidia-corporation':920,
  'microsoft':         415,
  'tesla':             175,
  'amazon':            185,
  'alphabet':          175,
  'meta':              490,
  'netflix':           620,
  'disney':             90,
  'coca-cola':          63,
  'jpmorgan':          200,
  'visa':              275,
  'amd':               168,
  'paypal':             73,
  'uber':               79,
  'alibaba':           110,
  'sp500':             545,
  'ypf':                30,
  'mercadolibre':     2050,
  'globant':           168,
  'despegar':           11,
  'loma-negra':         10,
  'pampa-energia':      55,
  'vista-cedear':       23,
  'ym34o':             100,
  'tlcto':             100,
};

// ─── Assets found with the search box (data912) ──────────────────────────────
// Their id encodes where the price comes from — 'dyn~<market>~<ticker>~<liveSymbol>' —
// so the asset can be rebuilt from the id saved in the watchlist / trades.

const MARKET_INFO = {
  us:        { type: 'stock', label: 'Acción EE.UU.' },
  cedear:    { type: 'stock', label: 'CEDEAR' },
  arg_stock: { type: 'stock', label: 'Acción ARG' },
  arg_bond:  { type: 'bond',  label: 'Bono' },
  corp:      { type: 'bond',  label: 'ON' },
};

function makeDynamicAsset(market, ticker, liveSymbol) {
  const info = MARKET_INFO[market];
  return {
    id:   `dyn~${market}~${ticker}~${liveSymbol}`,
    ticker,
    name: `${ticker} (${info.label})`,
    type: info.type,
    market,
    liveSymbol,
    // ARS-quoted instruments are converted to USD with the MEP rate
    ars:  market === 'arg_stock'
       || ((market === 'cedear' || market === 'arg_bond') && liveSymbol === ticker),
    ...(market === 'cedear' && { usTicker: ticker }),
  };
}

/**
 * Find an asset by id. Search-box assets are rebuilt from their id and
 * registered in KNOWN_ASSETS, so the rest of the app can see them.
 */
function findAsset(id) {
  const known = Object.values(KNOWN_ASSETS).find(a => a.id === id);
  if (known || !id?.startsWith('dyn~')) return known;

  const [, market, ticker, liveSymbol] = id.split('~');
  if (!MARKET_INFO[market] || !ticker || !liveSymbol) return undefined;

  const asset = makeDynamicAsset(market, ticker, liveSymbol);
  KNOWN_ASSETS[asset.id.toLowerCase()] = asset;
  return asset;
}
