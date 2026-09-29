#  Gold Candle Timers — Windows app (.exe) kaise banaye

Chhota **always-on-top** widget jo **1M / 5M / 1H** candle-close countdown dikhata hai —
MetaTrader jaise chart ke **upar**, taki pata rahe ki gold (XAUUSD) ki candle kab close hogi.
Timers **real clock se** chalte hain, isliye ek baar sync karne ke baad **drift nahi hota** —
hamesha candle close se matched.

## 1) Zaroorat

- Windows 10/11
- Node.js LTS — <https://nodejs.org> se install karo (ek baar)

## 2) .exe banana (ek baar)

Is `timer-app` folder ko apne Windows PC par le jao (USB / git pull / copy).

**Asaan tarika:** `build-win.bat` par double-click karo.

**Ya cmd me:**

```bat
cd timer-app
npm install
npm run dist
```

`dist\` folder me do files banengi:

| File | Kya hai |
|---|---|
| `Gold Candle Timers Setup 1.0.0.exe` | Installer (one-click) |
| `Gold Candle Timers 1.0.0.exe` | **Portable** — bina install, double-click se chalta hai |

> Bina .exe banaye try karna ho: `npm install` ke baad `npm start`.

## 3) Istemal

- Window **hamesha sabke upar** rehti hai, right side me khulti hai.
- Strip ko **pakad kar drag** karo — kahin bhi rakh lo.
- 📌 **pin** par click = always-on-top on/off.
- Widget par **hover** karo → upar-daaye ⚙ dikhega → **sync panel** khulta hai.

### Gold chart se sync (ek baar karna hota hai)

1. MetaTrader me gold chart ke neeche jo **server time** chal raha hai wo dekho.
2. ⚙ kholo, wahi time `HH:MM:SS` me daal kar **Sync** dabao.
   (Galat ho jaye to `±1m / ±30m` buttons se adjust, ya **Reset** = local time.)
3. Bas! Ab teeno timers usi clock se jude hain — **00:00 hote hi chart par candle close hogi.**
   Offset save ho jata hai, har baar karna nahi padta.

- Candle close par ring **white flash** hoti hai; chaaho to ⚙ me **beep** on kar lo.

## 4) Notes

- Countdown real clock (NTP-synced system time) + saved offset se banta hai —
  stopwatch jaisa drift nahi hota.
- Settings `%AppData%\gold-candle-timers\config.json` me save hoti hain.
- Source: `main.js` (window/always-on-top), `renderer/` (UI + logic), `test/` (unit tests).
