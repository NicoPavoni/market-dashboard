# 📈 Market Dashboard

Dashboard personal para seguimiento de acciones y criptomonedas con análisis técnico y señales de compra.

## ✨ Funcionalidades

- **Watchlist personalizable** — agregá y eliminá activos libremente
- **Precios en tiempo real** — criptos vía CoinGecko (gratis, sin API key)
- **Análisis técnico automático:**
  - RSI (Relative Strength Index) de 14 períodos
  - Medias móviles MA20 y MA50
  - Detección de Golden Cross
- **Señales de compra/espera/venta** calculadas automáticamente
- **Gráfico histórico** interactivo (7D / 30D / 90D)
- **Alertas visuales** agrupadas por tipo
- **Auto-refresh** configurable (5 / 15 / 30 minutos)
- **Modo oscuro** automático según preferencia del sistema

## 🚀 Cómo usar

### Opción 1 — Abrir directamente

Simplemente abrí `index.html` en tu navegador. No requiere instalación ni servidor.

> ⚠️ Nota: los navegadores modernos bloquean fetch a APIs externas al abrir
> archivos locales con `file://`. Si las criptos no cargan, usá la Opción 2.

### Opción 2 — Servidor local (recomendado)

```bash
# Con Python (viene instalado en Mac/Linux)
python3 -m http.server 8080

# Con Node.js
npx serve .

# Con PHP
php -S localhost:8080
```

Luego abrí: `http://localhost:8080`

### Opción 3 — GitHub Pages (acceso desde cualquier dispositivo)

1. Subí el repo a GitHub
2. Andá a **Settings → Pages → Source: main branch / root**
3. Tu dashboard queda disponible en `https://TU_USUARIO.github.io/market-dashboard`

## 📁 Estructura del proyecto

```
market-dashboard/
├── index.html          # Estructura HTML del dashboard
└── src/
    ├── styles.css      # Estilos (light + dark mode)
    ├── data.js         # Catálogo de activos y watchlist inicial
    ├── analysis.js     # Indicadores técnicos (RSI, MA, señales)
    ├── ui.js           # Funciones de renderizado DOM
    └── app.js          # Controlador principal y estado
```

## 📊 Activos soportados

### Criptomonedas (precios reales vía CoinGecko)
BTC, ETH, SOL, BNB, ADA, XRP, DOGE, AVAX, LINK, DOT, MATIC, UNI, ATOM, LTC, PEPE

### Acciones (precios simulados*)
AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL, META, NFLX, DIS, KO, JPM, V

*Para precios reales de acciones, ver sección **Agregar datos reales de acciones** más abajo.

## ⚙️ Personalización

### Cambiar la watchlist por defecto

Editá `DEFAULT_WATCHLIST` en `src/data.js`:

```js
const DEFAULT_WATCHLIST = [
  { id: 'bitcoin',   ticker: 'BTC',  name: 'Bitcoin', type: 'crypto' },
  { id: 'ethereum',  ticker: 'ETH',  name: 'Ethereum', type: 'crypto' },
  // agregá más aquí...
];
```

### Cambiar el umbral del RSI para señales de compra

El slider en la pestaña **Configurar** lo maneja en tiempo real.
Para cambiar el valor por defecto, editá el HTML en `index.html`:

```html
<input type="range" min="20" max="45" value="35" ...
```

### Agregar un activo personalizado al catálogo

En `src/data.js`, agregá a `KNOWN_ASSETS`:

```js
'mi-cripto': { id: 'nombre-en-coingecko', ticker: 'XXX', name: 'Mi Cripto', type: 'crypto' },
```

El `id` debe coincidir con el ID que usa CoinGecko. Podés verificarlo en:
`https://api.coingecko.com/api/v3/coins/list`

## 📈 Agregar datos reales de acciones

Las APIs gratuitas más populares para acciones son:

| Proveedor | Plan gratuito | Link |
|-----------|--------------|------|
| **Alpha Vantage** | 25 req/día | [alphavantage.co](https://www.alphavantage.co) |
| **Yahoo Finance** (no oficial) | Ilimitado* | via `query1.finance.yahoo.com` |
| **Polygon.io** | 5 req/min | [polygon.io](https://polygon.io) |
| **Finnhub** | 60 req/min | [finnhub.io](https://finnhub.io) |

Para integrar, reemplazá la función `simulateStockPrices` en `src/analysis.js`
con un fetch real al proveedor elegido.

## 🔔 Alertas en el teléfono (futuro)

Para recibir notificaciones push reales necesitás un backend mínimo.
Opciones populares y baratas:

- **Telegram Bot** — gratis, basta con un script en Python/Node
- **Pushover** — ~$5 pago único, muy fácil de integrar
- **ntfy.sh** — 100% gratuito y open source
- **GitHub Actions** — cron job que corre el análisis y manda email

## 🛠️ Posibles mejoras

- [ ] Persistencia de watchlist en `localStorage`
- [ ] Soporte para múltiples portfolios
- [ ] Alertas de precio personalizado (ej: "avisar si BTC < $50.000")
- [ ] Integración con broker (Binance API, Alpaca)
- [ ] Backtest de señales históricas
- [ ] Exportar alertas a CSV / Google Sheets

## 📄 Licencia

MIT — libre para uso personal y comercial.
