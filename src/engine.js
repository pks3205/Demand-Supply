// Market engine for Sabzi Mandi.
// Supply & demand drive prices; buy/sell orders only fill when a market bid/ask matches.

export const STOCKS = [
  { id: "tomato", name: "Tomato Corp", hindi: "टमाटर लिमिटेड", emoji: "🍅", base: 100, color: "#e6594a" },
  { id: "onion", name: "Onion & Co", hindi: "प्याज़ इंडस्ट्रीज", emoji: "🧅", base: 85, color: "#c271a4" },
  { id: "potato", name: "Potato Green", hindi: "आलू ग्रीन", emoji: "🥔", base: 70, color: "#c99b63" },
  { id: "apple", name: "Apple Tech", hindi: "सेब टेक", emoji: "🍎", base: 150, color: "#db4f4f" },
  { id: "banana", name: "Banana Bank", hindi: "केला बैंक", emoji: "🍌", base: 60, color: "#f0b429" },
  { id: "carrot", name: "Carrot Apps", hindi: "गाजर ऐप्स", emoji: "🥕", base: 55, color: "#ef8b35" },
  { id: "peanut", name: "Peanut Media", hindi: "मूंगफली मीडिया", emoji: "🥜", base: 65, color: "#b7791f" },
  { id: "chilli", name: "Chilli Motors", hindi: "मिर्च मोटर्स", emoji: "🌶️", base: 80, color: "#d13d28" },
  { id: "ice", name: "Ice Cream Cloud", hindi: "आइसक्रीम क्लाउड", emoji: "🍦", base: 95, color: "#7ec8e3" },
  { id: "egg", name: "Egg Cartel", hindi: "अंडा कार्टेल", emoji: "🥚", base: 45, color: "#e8c874" },
];

export const STOCKS_BY_ID = Object.fromEntries(STOCKS.map((s) => [s.id, s]));

const TICK_MS = 1100;
const ROUND_SECONDS = 90;
const HISTORY_LENGTH = 60;

const DIR = { buy: 1, sell: -1 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function chance(p) {
  return Math.random() < p;
}

function roundTo1(v) {
  return Math.round(v * 10) / 10;
}

function fmt(n) {
  const v = Math.round(n);
  return "₹" + v.toLocaleString("en-IN");
}

export function createPlayer({ id, name, emoji, isHuman = false, role = "buyer", color = "#7ba46a", strategy = "random" }) {
  const p = {
    id,
    name,
    emoji,
    isHuman,
    role,
    color,
    strategy,
    cash: 0,
    inventory: {},
    avgCost: {},
    pending: [],
    startValue: 0,
  };
  if (isHuman) {
    if (role === "seller") {
      p.cash = 200;
      p.inventory = { tomato: 50 };
      p.avgCost = { tomato: STOCKS[0].base };
    } else {
      p.cash = 1000;
    }
  } else {
    p.cash = 300 + Math.round(rand(0, 400));
    // give bots a little starting inventory to keep them believable
    const n = 1 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) {
      const s = STOCKS[Math.floor(rand(0, STOCKS.length))].id;
      p.inventory[s] = (p.inventory[s] || 0) + Math.floor(rand(2, 7));
      p.avgCost[s] = 0;
    }
  }
  return p;
}

export class MarketSim {
  constructor() {
    this.tickMs = TICK_MS;
    this.roundSeconds = ROUND_SECONDS;
    this.stocks = STOCKS.map((s) => this._makeStock(s));
    this.players = [];
    this.you = null;
    this.timeLeft = this.roundSeconds;
    this.tickCount = 0;
    this.running = false;
    this.onTick = null; // callback(tickCount)
    this.onEvent = null; // callback(title, detail, emoji)
    this.onTrade = null; // callback({type, ...})
    this.onOrder = null; // callback(order)
    this._events = [];
  }

  _makeStock(def) {
    return {
      ...def,
      price: def.base,
      prevPrice: def.base,
      bestBid: def.base - 1,
      bestAsk: def.base + 1,
      demand: 52,
      supply: 48,
      momentum: 0,
      history: [def.base],
      eventBoost: 0,
      eventTicks: 0,
    };
  }

  start(players) {
    this.players = players;
    this.you = players.find((p) => p.isHuman);
    for (const p of this.players) {
      p.startValue = this.netWorth(p);
    }
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  getStock(id) {
    return this.stocks.find((s) => s.id === id);
  }

  netWorth(player) {
    let val = player.cash;
    for (const [id, qty] of Object.entries(player.inventory)) {
      val += qty * this.getStock(id).price;
    }
    return Math.round(val);
  }

  capacityFor(player, stockId) {
    return player.role === "seller" ? 50 : 10;
  }

  capacityRemaining(player, stockId) {
    const cap = this.capacityFor(player, stockId);
    const held = player.inventory[stockId] || 0;
    return Math.max(0, cap - held);
  }

  tick() {
    if (!this.running) return;
    this.tickCount += 1;
    this.timeLeft = Math.max(0, this.timeLeft - 1);

    // 1. move market (supply & demand engine)
    for (const s of this.stocks) {
      this._updateSupplyDemand(s);
      this._movePrice(s);
      s.history.push(s.price);
      if (s.history.length > HISTORY_LENGTH) s.history.shift();
    }

    // 2. bots trade against the market
    this._botsTrade();

    // 3. fill the human player's pending orders if the market crossed them
    this._checkPendingOrders(this.you);

    // 4. randomly trigger a market event that teaches cause & effect
    if (this.tickCount % 16 === 0 && Math.random() < 0.75) {
      this._triggerEvent();
    }

    // 5. update start value (only for bots that appear later)
    if (this.onTick) this.onTick(this.tickCount);

    if (this.timeLeft <= 0) {
      this.running = false;
    }
  }

  _updateSupplyDemand(s) {
    // demand / supply drift toward equilibrium + noise + event boost
    const driftDemand = (50 - s.demand) * 0.08;
    const driftSupply = (50 - s.supply) * 0.08;
    s.demand = clamp(s.demand + driftDemand + rand(-4, 4), 12, 90);
    s.supply = clamp(s.supply + driftSupply + rand(-4, 4), 12, 90);

    if (s.eventTicks > 0) {
      s.demand = clamp(s.demand + s.eventBoost, 12, 95);
      s.supply = clamp(s.supply - s.eventBoost * 0.4, 12, 95);
      s.eventTicks -= 1;
    }

    s.demand = Math.round(s.demand);
    s.supply = Math.round(s.supply);
  }

  _movePrice(s) {
    const imbalance = s.demand - s.supply;
    const noise = rand(-2.4, 2.4);
    const momentum = s.momentum;
    let delta = imbalance * 0.22 + momentum * 0.7 + noise;
    delta = roundTo1(delta);

    let next = Math.round(s.price + delta);
    next = Math.max(15, Math.min(500, next));
    s.prevPrice = s.price;
    s.price = next;
    s.momentum = clamp(s.price - s.prevPrice + s.momentum * 0.3, -6, 6);

    // market spread
    const spread = Math.max(1, Math.round(s.price * 0.018));
    s.bestBid = Math.max(1, s.price - spread);
    s.bestAsk = s.price + spread;
  }

  _botsTrade() {
    for (const bot of this.players.filter((p) => !p.isHuman)) {
      const opportunities = chance(0.62) ? 1 : 0;
      for (let k = 0; k <= opportunities; k++) {
        this._botTrade(bot);
      }
    }
  }

  _botTrade(bot) {
    const stock = this.stocks[Math.floor(rand(0, this.stocks.length))];
    if (!stock) return;
    const held = bot.inventory[stock.id] || 0;
    const wantsBuy = this._botWantsBuy(bot, stock, held);
    const qty = Math.ceil(rand(1, 4));

    if (wantsBuy) {
      const price = stock.bestAsk;
      const cost = price * qty;
      if (bot.cash >= cost) {
        bot.cash -= cost;
        this._addToInventory(bot, stock.id, qty, price);
        this._applyPriceImpact(stock, DIR.buy, qty);
        if (this.onTrade) this.onTrade({ stockId: stock.id, side: "buy", qty, price, actor: bot.name, actorId: bot.id, isHuman: false });
      }
    } else if (held >= qty) {
      const price = stock.bestBid;
      bot.cash += price * qty;
      bot.inventory[stock.id] -= qty;
      this._applyPriceImpact(stock, DIR.sell, qty);
      if (this.onTrade) this.onTrade({ stockId: stock.id, side: "sell", qty, price, actor: bot.name, actorId: bot.id, isHuman: false });
    }
  }

  _botWantsBuy(bot, stock, held) {
    const avg = this._rollingAvg(stock);
    if (bot.strategy === "momentum") {
      return stock.momentum > 1.2 ? chance(0.75) : stock.momentum < -1.2 ? chance(0.18) : chance(0.45);
    }
    if (bot.strategy === "value") {
      const cheap = stock.price < avg - 5;
      const expensive = stock.price > avg + 5;
      if (cheap) return chance(0.82);
      if (expensive) return chance(0.12);
      return chance(0.4);
    }
    return chance(0.45);
  }

  _rollingAvg(stock) {
    const h = stock.history.slice(-8);
    return h.reduce((a, b) => a + b, 0) / Math.max(1, h.length);
  }

  _applyPriceImpact(stock, dir, qty) {
    const impact = Math.max(1, Math.round(qty * 0.7)) * dir;
    stock.prevPrice = stock.price;
    stock.price = Math.max(15, Math.min(500, stock.price + impact));
    const spread = Math.max(1, Math.round(stock.price * 0.018));
    stock.bestBid = Math.max(1, stock.price - spread);
    stock.bestAsk = stock.price + spread;
    stock.demand = clamp(stock.demand + (dir > 0 ? qty * 2 : -qty * 1.6), 5, 100);
    stock.supply = clamp(stock.supply + (dir > 0 ? -qty * 1.6 : qty * 2), 5, 100);
    stock.momentum = clamp(stock.momentum + impact * 0.5, -8, 8);
    if (stock.history.length) stock.history[stock.history.length - 1] = stock.price;
  }

  _addToInventory(player, stockId, qty, price) {
    const cur = player.inventory[stockId] || 0;
    const curAvg = player.avgCost[stockId] || 0;
    const totalCost = curAvg * cur + qty * price;
    player.inventory[stockId] = cur + qty;
    player.avgCost[stockId] = Math.round(totalCost / (cur + qty));
  }

  placePlayerOrder(player, { side, stockId, qty, price }) {
    const stock = this.getStock(stockId);
    if (!stock || !qty || qty < 1) return { ok: false, msg: "मात्रा 1 से कम नहीं हो सकती।" };
    if (player.cash <= 0 && side === "buy") return { ok: false, msg: "नकद ख़त्म! पहले कुछ बेचो।" };
    if (side === "sell" && (player.inventory[stockId] || 0) < qty) {
      return { ok: false, msg: "बास्केट में इतनी सब्ज़ियाँ नहीं हैं!" };
    }

    const priceToUse = Math.max(1, Math.round(price));

    if (side === "buy" && priceToUse >= stock.bestAsk) {
      // market buy — fills immediately at the ask
      const fillPrice = Math.min(priceToUse, stock.bestAsk);
      return this._fillPlayerBuy(player, stock, qty, fillPrice);
    }

    if (side === "sell" && priceToUse <= stock.bestBid) {
      // market sell — fills immediately at the bid
      const fillPrice = Math.max(priceToUse, stock.bestBid);
      return this._fillPlayerSell(player, stock, qty, fillPrice);
    }

    // otherwise keep it on the orange crate as a "limit order"
    const order = {
      id: Math.random().toString(36).slice(2),
      side,
      stockId,
      qty,
      price: priceToUse,
      createdAt: Date.now(),
    };
    player.pending.push(order);
    if (this.onOrder) this.onOrder(order, "pending");
    return { ok: true, pending: true, order };
  }

  _fillPlayerBuy(player, stock, qty, fillPrice) {
    const capRemaining = this.capacityRemaining(player, stock.id);
    const accepted = Math.min(qty, capRemaining);
    const rot = qty - accepted;
    const cost = qty * fillPrice;

    if (player.cash < cost) {
      // buyer pays for as many as affordable, but no partial fill in kid mode for clarity
      return { ok: false, msg: "इतने क्रेट ख़रीदने के लिए नकद कम है!" };
    }

    player.cash -= cost;
    this._addToInventory(player, stock.id, accepted, fillPrice);
    this._applyPriceImpact(stock, DIR.buy, qty);

    const result = { ok: true, side: "buy", stockId: stock.id, qty: accepted, rot, price: fillPrice, cost };
    if (this.onTrade) this.onTrade({ ...result, actor: player.name, isHuman: true });
    return result;
  }

  _fillPlayerSell(player, stock, qty, fillPrice) {
    player.inventory[stock.id] -= qty;
    player.cash += qty * fillPrice;
    this._applyPriceImpact(stock, DIR.sell, qty);
    const result = { ok: true, side: "sell", stockId: stock.id, qty, rot: 0, price: fillPrice, revenue: qty * fillPrice };
    if (this.onTrade) this.onTrade({ ...result, actor: player.name, isHuman: true });
    return result;
  }

  _checkPendingOrders(player) {
    if (!player) return;
    const still = [];
    for (const order of player.pending) {
      const stock = this.getStock(order.stockId);
      if (!stock) continue;
      let filled = false;
      let result = null;
      if (order.side === "buy" && stock.bestAsk <= order.price) {
        const fillPrice = Math.min(stock.bestAsk, order.price);
        result = this._fillPlayerBuy(player, stock, order.qty, fillPrice);
        filled = result.ok;
      } else if (order.side === "sell" && stock.bestBid >= order.price) {
        const fillPrice = Math.max(stock.bestBid, order.price);
        result = this._fillPlayerSell(player, stock, order.qty, fillPrice);
        filled = result.ok;
      }
      if (filled) {
        if (this.onOrder) this.onOrder(order, "filled");
        // if a fill was partial (rot), we don't keep the remainder
        continue;
      }
      still.push(order);
    }
    player.pending = still;
  }

  _triggerEvent() {
    const stock = this.getStock(STOCKS[Math.floor(rand(0, STOCKS.length))].id);
    const isDemand = chance(0.55);
    const boost = Math.round(rand(22, 38));
    stock.eventBoost = isDemand ? boost : -boost;
    stock.eventTicks = 5 + Math.floor(rand(0, 4));
    const title = isDemand ? "माँग बढ़ी!" : "सप्लाई बढ़ी!";
    const detail = isDemand
      ? `${stock.emoji} ${stock.name} की माँग बढ़ी — भाव ऊपर जाएगा!`
      : `${stock.emoji} ${stock.name} का माल ढेर हो गया — भाव नीचे आएगा!`;
    if (this.onEvent) this.onEvent(title, detail, stock.emoji);
  }

  playerNetWorth(player) {
    return this.netWorth(player);
  }

  profit(player) {
    return this.netWorth(player) - player.startValue;
  }

  ranking() {
    return [...this.players].sort((a, b) => this.netWorth(b) - this.netWorth(a));
  }
}

export { fmt };
