async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const item = data.data[0];
    return { value: parseInt(item.value, 10), label: item.value_classification };
  } catch (e) {
    console.warn('Fear & Greed fetch failed:', e.message);
    return null;
  }
}

async function fetchCryptoGlobal() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data: d } = await res.json();
    return {
      totalMcap:     d.total_market_cap?.usd || 0,
      totalVol:      d.total_volume?.usd     || 0,
      btcDom:        d.market_cap_percentage?.btc || 0,
      ethDom:        d.market_cap_percentage?.eth || 0,
      mcapChange24h: d.market_cap_change_percentage_24h_usd || 0,
    };
  } catch (e) {
    console.warn('CoinGecko global fetch failed:', e.message);
    return null;
  }
}

function computeMacroData(fearGreed, globalData) {
  const fg = fearGreed?.value ?? 50;

  // Extreme fear = great buying opportunity (contrarian signal)
  let macroScore =
    fg <= 20 ? 82 :
    fg <= 35 ? 68 :
    fg <= 55 ? 52 :
    fg <= 70 ? 38 : 22;

  const mcapChg = globalData?.mcapChange24h ?? 0;
  if (mcapChg < -3) macroScore += 8;
  else if (mcapChg > 3) macroScore -= 8;
  macroScore = Math.max(0, Math.min(100, macroScore));

  const signal =
    macroScore >= 65 ? 'buy'  :
    macroScore >= 45 ? 'wait' : 'sell';

  const signalDesc =
    macroScore >= 65 ? 'Buen momento de entrada al mercado'       :
    macroScore >= 45 ? 'Mercado neutral — esperar confirmación'    :
                       'Mercado sobrecalentado — considerar esperar';

  return {
    fearGreed: fearGreed ?? { value: 50, label: 'Neutral' },
    global: globalData,
    macroScore,
    signal,
    signalDesc,
  };
}

async function loadMacroData() {
  const [fg, global] = await Promise.all([fetchFearGreed(), fetchCryptoGlobal()]);
  return computeMacroData(fg, global);
}
