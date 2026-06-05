function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 10) return 0;
  const xs = x.slice(-n), ys = y.slice(-n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : parseFloat((num / den).toFixed(3));
}

function corrLabel(r) {
  const abs = Math.abs(r);
  if (abs >= 0.85) return { text: 'Muy alta', cls: 'red' };
  if (abs >= 0.65) return { text: 'Alta',     cls: 'amber' };
  if (abs >= 0.40) return { text: 'Moderada', cls: 'amber' };
  return              { text: 'Baja',      cls: 'green' };
}

function analyzePortfolioRisk(watchlist, priceData) {
  const assets = watchlist.filter(a => priceData[a.id]?.prices?.length >= 30);
  const n = assets.length;

  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      if (j < i)   return null;
      return pearsonCorrelation(
        priceData[assets[i].id].prices,
        priceData[assets[j].id].prices
      );
    })
  );

  for (let i = 0; i < n; i++)
    for (let j = 0; j < i; j++)
      matrix[i][j] = matrix[j][i];

  let totalCorr = 0, count = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      totalCorr += Math.abs(matrix[i][j]);
      count++;
    }
  const avgCorr = count > 0 ? totalCorr / count : 0;

  const cryptos = watchlist.filter(a => a.type === 'crypto').length;
  const stocks  = watchlist.filter(a => a.type === 'stock').length;
  const typeBonus = Math.min(cryptos, stocks) > 0 ? 20 : 0;
  const divScore  = Math.round(Math.max(0, 100 - avgCorr * 100) * 0.8 + typeBonus);

  const divLabel =
    divScore >= 75 ? 'Excelente' :
    divScore >= 55 ? 'Buena'     :
    divScore >= 35 ? 'Moderada'  : 'Baja — alta concentración';

  return { assets, matrix, avgCorr, divScore, divLabel, cryptos, stocks };
}

function scoreTechForAlloc(d) {
  if (!d) return 50;
  let s = 50;
  if (d.rsi <= 30) s += 30;
  else if (d.rsi <= 40) s += 18;
  else if (d.rsi >= 70) s -= 20;
  if (d.ma20 && d.ma50 && d.ma20 > d.ma50) s += 15;
  return Math.max(0, Math.min(100, s));
}

function suggestAllocation(watchlist, priceData, fundamentalData, macroData) {
  const assets = watchlist.filter(a => priceData[a.id]);
  if (!assets.length) return [];

  const macroScore = macroData?.macroScore ?? 50;

  const scored = assets.map(a => {
    const d     = priceData[a.id];
    const fund  = fundamentalData?.[a.id];
    const tech  = scoreTechForAlloc(d);
    const fScore = fund?.score ?? 50;
    const total  = tech * 0.45 + fScore * 0.40 + (macroScore / 100) * 15;
    return { asset: a, data: d, fund, score: Math.round(total) };
  }).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 4);
  const sum = top.reduce((s, x) => s + x.score, 0) || 1;

  return top.map(x => ({
    asset:     x.asset,
    data:      x.data,
    fund:      x.fund,
    score:     x.score,
    weight:    Math.round((x.score / sum) * 100),
    riskLabel: x.asset.type === 'crypto'
      ? (x.score >= 65 ? 'Riesgo moderado' : 'Riesgo alto')
      : (x.score >= 68 ? 'Riesgo bajo'     : 'Riesgo moderado'),
  }));
}
