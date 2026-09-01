# 🧺 सब्ज़ी मंडी — Demand & Supply Game

बच्चों (और सभी के लिए!) एक मज़ेदार, पूरी तरह से ब्राउज़र-बेस्ड गेम जो **Demand, Supply, Price, Order Matching और Position Sizing** सिखाता है। असली पैसा नहीं, बस वर्चुअल मंडी और सीखना। 🎮

## ▶️ चलाओ

```bash
npm install
npm run dev
```

फिर ब्राउज़र में `http://localhost:5173/` खोलो। (Preview environment में दिखाई गई लिंक से भी खुलता है।)

## 🎯 गेम कैसे खेलते हैं?

1. **रोल चुनो** — **Buyer Kid** (₹1000 नकद) या **Seller Kid** (50 टमाटर + ₹200 नकद)।
2. **स्टॉक चुनो** — 10 मज़ेदार सब्ज़ी/फल स्टॉक्स:
   - Tomato Corp, Onion & Co, Potato Green, Apple Tech, Banana Bank, Carrot Apps, Peanut Media, Chilli Motors, Ice Cream Cloud, Egg Cartel
3. **ऑर्डर दो**:
   - 🟢 **ख़रीदें / 🔴 बेचें** toggle
   - ⚖️ मात्रा slider (तराजू)
   - 🏷️ दाम slider + plus/minus
4. **मंडी में लटका हुआ ऑर्डर** तब पक्का होता है जब market का Best Bid / Best Ask तुम्हारे दाम से **मैच** होता है। (सौदा पक्का नियम)
5. **टमाटर सड़ने का डर**: एक स्टॉक में क्षमता से ज़्यादा ख़रीदा तो अतिरिक्त सब्ज़ियाँ **सड़ जाती हैं** — पैसा जाता है। यानी सब कुछ एक स्टॉक में मत लगाओ!
6. ⏰ **90 सेकंड** की मंडी के बाद ranking दिखती है।

## 🧠 क्या सिखाता है?

- **माँग और आपूर्ति**: जब बहुत सारे buyers आते हैं → भाव ऊपर; जब सप्लाई ज़्यादा → भाव नीचे।
- **Order Matching**: कीमत तभी बदलती है जब दाम मैच होता है।
- **Position Sizing**: एक ही जगह सारा पैसा मत डालो; क्षमता से अधिक माल = सड़ांध।
- **Risk & Reward**: कम ख़रीदो, ज़्यादा बेचो, खुद को बर्बाद मत करो।

## 🧱 तकनीक

- **Vite + Vanilla JS** (बिना किसी भारी framework के)
- **Three.js** — 3D लकड़ी के क्रेट चार्ट (हरा/लाल), हरा Support Zone और लाल Resistance Zone
- **Single-player vs 3 AI बोट** (momentum / value / random strategies)
- कस्टम supply-demand price engine, market event system (माँग बढ़ी! / सप्लाई बढ़ी!), live leaderboard, toasts, round end screen

## 📁 फ़ाइलें

| File | काम |
|---|---|
| `src/engine.js` | Market engine, stocks, players, order matching, bots, prices |
| `src/chart3d.js` | Three.js 3D crate chart + support/resistance zones |
| `src/main.js` | UI, controls, game loop, leaderboard, end screen |
| `src/styles.css` | मंडी जैसी हरी-पीली, बच्चों वाली styling |

## 🔮 आगे क्या जोड़ा जा सकता है?

- दो बच्चे आमने-सामने (multiplayer) खेलें → दूसरे की कीमत असली Demand बने
- सब्ज़ी मंडी की आवाज़ें (vendor calls, bhāv announcements)
- सीखने के छोटे-छोटे *चैलेंज* (जैसे "सिर्फ़ आलू में 5 क्रेट बेचो")
- टाइम-ट्रैवल मोड जहाँ खबर (news) आती है: बारिश → टमाटर महँगा
