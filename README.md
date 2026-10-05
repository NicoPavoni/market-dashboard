# 📈 Market Dashboard

Dashboard personal para seguimiento de acciones y criptomonedas con análisis técnico y señales de compra.

## ✨ Funcionalidades

- **Watchlist personalizable** — buscador con todos los instrumentos de BYMA (acciones, CEDEARs, bonos, ONs) y de EE.UU.
- **Precios en tiempo real** — criptos vía CoinGecko, acciones y bonos vía data912 (gratis, sin API key)
- **Portafolio** — compras, ventas (precio promedio ponderado, resultado realizado y no realizado) y saldos iniciales
- **Vista en USD o en pesos** al dólar MEP del día
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
    ├── analysis.js     # Precios (CoinGecko, data912) e indicadores técnicos
    ├── search.js       # Buscador de activos
    ├── ui.js           # Funciones de renderizado DOM
    └── app.js          # Controlador principal y estado
```

## 📊 Activos soportados

### Criptomonedas (precios reales vía CoinGecko)
BTC, ETH, SOL, BNB, ADA, XRP, DOGE, AVAX, LINK, DOT, MATIC, UNI, ATOM, LTC, PEPE

### Acciones, CEDEARs, bonos y ONs (precios reales vía data912)
Cualquier instrumento de BYMA o de NYSE/NASDAQ: buscalo por ticker en **Configurar → Agregar activo** (ej: GGAL, AL30, YM34O, VIST, KO).

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

## 📈 Precios de acciones, CEDEARs y bonos

Los precios vienen de [data912.com](https://data912.com) (gratis, sin API key, permite llamadas desde el navegador). Todo se muestra en **USD**:

| Tipo | Precio en vivo | Historial (RSI / medias) |
|------|----------------|--------------------------|
| Acciones / ADRs de EE.UU. | `live/usa_stocks`, `live/usa_adrs` | `historical/usa_stocks/{ticker}` |
| CEDEARs | `live/arg_cedears`, ticker en USD MEP (ej. `VISTD`) | el de la acción subyacente, reescalado al precio del CEDEAR |
| ONs | `live/arg_corp`, ticker en USD MEP (ej. `YM34D`), por 100 VN | no disponible: se muestra con el badge "sin hist." |

Si la API falla, se usa un precio simulado y el activo muestra el badge "sim". Para agregar activos, ver el comentario al principio de `src/data.js`.

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
