import { MarketSim, STOCKS, STOCKS_BY_ID, createPlayer, fmt } from "./engine.js";
import { CrateChart } from "./chart3d.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const sim = new MarketSim();
let chart = null;
let selectedStockId = "tomato";
let gameStarted = false;
let endShown = false;
let intervalId = null;
let selectedRole = "buyer";
let currentSide = "buy";
let toastTimer = null;

const roleEmoji = { buyer: "🧒", seller: "🧑‍🌾" };
const roleTitle = { buyer: "Buyer Kid · खरीदार", seller: "Seller Kid · दुकानदार" };
const roleHint = {
  buyer: "कम दाम में ख़रीदो, ऊँचे में बेचो",
  seller: "अपना टमाटर महँगा बेचो",
};

const state = {
  quantity: 1,
  price: STOCKS_BY_ID.tomato.base,
};

function fmtDelta(n) {
  if (n > 0) return "▲ +" + n;
  if (n < 0) return "▼ " + n;
  return "● 0";
}

function showToast(text, ms = 2800) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("hidden");
  requestAnimationFrame(() => t.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.classList.add("hidden"), 250);
  }, ms);
}

function pickSelectedStock() {
  return sim.getStock(selectedStockId);
}

/* ---------------- stock ticker ---------------- */
function buildTicker() {
  const ticker = $("#stockTicker");
  ticker.innerHTML = "";
  for (const s of STOCKS) {
    const btn = document.createElement("button");
    btn.className = "stock-chip" + (s.id === selectedStockId ? " selected" : "");
    btn.innerHTML = `
      <span class="chip-emoji">${s.emoji}</span>
      <span class="chip-name">${s.name}</span>
      <span class="chip-price">₹${sim.getStock(s.id).price}</span>
      <span class="chip-delta up">&#x25B2; +0</span>
    `;
    btn.addEventListener("click", () => selectStock(s.id));
    ticker.appendChild(btn);
  }
}

function refreshTicker() {
  const chips = $$(".stock-chip");
  chips.forEach((chip, i) => {
    const s = STOCKS[i];
    const stock = sim.getStock(s.id);
    const delta = stock.price - stock.prevPrice;
    chip.classList.toggle("selected", s.id === selectedStockId);
    chip.querySelector(".chip-price").textContent = `₹${stock.price}`;
    const el = chip.querySelector(".chip-delta");
    el.className = "chip-delta " + (delta >= 0 ? "up" : "down");
    el.textContent = fmtDelta(delta);
  });
}

function selectStock(id) {
  selectedStockId = id;
  const stock = sim.getStock(id);
  state.price = stock.price;
  state.quantity = Math.min(state.quantity, Math.max(1, sim.capacityFor(sim.you || { role: "buyer" }, id)));
  chart.setStock(id);
  chart.update(stock, stock.history);
  buildTicker();
  refreshTradingPanel();
  refreshPriceBounds(true);
}

/* ---------------- trading panel ---------------- */
function refreshPriceBounds(reset = false) {
  const stock = pickSelectedStock();
  const slider = $("#priceSlider");
  const min = Math.max(1, stock.price - 25);
  const max = Math.max(min + 2, stock.price + 25);
  if (reset || state.price < min || state.price > max) {
    state.price = stock.price;
    slider.min = min;
    slider.max = max;
    slider.value = state.price;
    $("#priceValue").textContent = state.price;
  } else {
    slider.min = min;
    slider.max = max;
  }
  updatePriceHint();
  updateRotWarning();
}

function updatePriceHint() {
  const stock = pickSelectedStock();
  const hint = $("#priceHint");
  if (state.price > stock.bestAsk + 2) {
    hint.className = "price-hint bad-high";
    hint.textContent = "😢 दाम बहुत ज़्यादा है, ग्राहक भाग जाएँगे!";
  } else if (state.price < stock.bestBid - 2) {
    hint.className = "price-hint bad-low";
    hint.textContent = "🙅 दाम बहुत कम है, दुकानदार नहीं मानेगा!";
  } else {
    hint.className = "price-hint neutral";
    hint.textContent = "👍 दाम मंडी के भाव के करीब है, सौदा पक्का हो सकता है।";
  }
}

function updateRotWarning() {
  const stock = pickSelectedStock();
  const warn = $("#rotWarning");
  if (currentSide === "buy" && sim.you) {
    const remain = sim.capacityRemaining(sim.you, stock.id);
    if (state.quantity > remain) {
      warn.classList.remove("hidden");
      warn.innerHTML = `⚠️ बास्केट में सिर्फ <b>${remain}</b> क्रेट की जगह है! <b>${state.quantity - remain}</b> क्रेट <b>सड़ जाएँगे</b> और उनके पैसे हमेशा के लिए चले जाएँगे।`;
      return;
    }
  }
  warn.classList.add("hidden");
}

function updateTopStats() {
  if (!sim.you) return;
  const you = sim.you;
  $("#cashValue").textContent = fmt(you.cash);
  $("#netWorth").textContent = fmt(sim.netWorth(you));
}

function refreshSide() {
  $$(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === currentSide));
  const btn = $("#orderButton");
  btn.className = "order-button " + (currentSide === "buy" ? "buy" : "sell");
  btn.textContent = currentSide === "buy" ? "🟢 ख़रीदने का ऑर्डर फेरो!" : "🔴 बेचने का ऑर्डर फेरो!";
  updateRotWarning();
  $("#orderStatus").classList.add("hidden");
}

function setSide(side) {
  currentSide = side;
  refreshSide();
}

function refreshTradingPanel() {
  if (!sim.you) return;
  const stock = pickSelectedStock();
  $("#panelCash").textContent = fmt(sim.you.cash);
  const totalUnits = Object.values(sim.you.inventory).reduce((a, b) => a + b, 0);
  $("#panelInventory").textContent = totalUnits;
  $("#selectedEmoji").textContent = stock.emoji;
  $("#selectedName").textContent = stock.name;
  $("#selectedHindi").textContent = stock.hindi;
  $("#selectedPrice").textContent = "₹" + stock.price;
  const delta = stock.price - stock.prevPrice;
  const change = $("#selectedChange");
  change.className = "change-pill " + (delta >= 0 ? "up" : "down");
  change.textContent = fmtDelta(delta);

  const demandPct = (stock.demand / (stock.demand + stock.supply + 1e-6)) * 100;
  $("#demandBar").style.width = demandPct + "%";
  $("#supplyBar").style.width = (100 - demandPct) + "%";
  $("#demandVal").textContent = stock.demand;
  $("#supplyVal").textContent = stock.supply;

  $("#qtySlider").max = String(Math.min(10, sim.capacityFor(sim.you, stock.id)));
  $("#qtySlider").value = String(Math.min(state.quantity, Number($("#qtySlider").max)));
  $("#qtyValue").textContent = state.quantity;
  $("#priceValue").textContent = state.price;

  updatePriceHint();
  updateRotWarning();
  renderPendingOrders();
  renderInventory();
  updateTopStats();
}

function renderPendingOrders() {
  if (!sim.you) return;
  const list = $("#pendingOrders");
  list.innerHTML = "";
  for (const o of sim.you.pending) {
    const s = STOCKS_BY_ID[o.stockId];
    const el = document.createElement("div");
    el.className = "pending-item";
    el.innerHTML = `<span>⏳ ${o.side === "buy" ? "ख़रीद" : "बेचें"} ${s.emoji} ${s.name} × ${o.qty}</span><span>₹${o.price} पर लटका</span>`;
    list.appendChild(el);
  }
  if (sim.you.pending.length) $("#pendingOrders").classList.remove("hidden");
  else $("#pendingOrders").classList.add("hidden");
}

function renderInventory() {
  const tbody = $("#inventoryTable tbody");
  tbody.innerHTML = "";
  if (!sim.you) return;
  const rows = Object.entries(sim.you.inventory)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty, s: STOCKS_BY_ID[id], stock: sim.getStock(id) }));
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#8a988f">टोकरी ख़ाली है 🧺</td></tr>`;
    return;
  }
  for (const { id, qty, s, stock } of rows) {
    const avg = sim.you.avgCost[id] || 0;
    const pnl = (stock.price - avg) * qty;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.emoji} ${s.name}</td>
      <td>${qty}</td>
      <td>₹${avg}</td>
      <td style="color:${pnl >= 0 ? "#2c974b" : "#a63226"}">₹${stock.price} ${fmtDelta(Math.round(pnl))}</td>
    `;
    tbody.appendChild(tr);
  }
}

/* ---------------- leaderboard ---------------- */
function refreshLeaderboard() {
  const list = $("#leaderboard");
  list.innerHTML = "";
  const ranking = sim.ranking();
  ranking.forEach((p, i) => {
    const profit = sim.profit(p);
    const div = document.createElement("div");
    div.className = "lb-item" + (p.isHuman ? " you" : "");
    div.innerHTML = `
      <div class="lb-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}</div>
      <div class="lb-details">
        <div class="lb-name">${p.emoji} ${p.name}</div>
        <div class="lb-value">${fmt(sim.netWorth(p))} <span style="color:${profit >= 0 ? "#2c974b" : "#a63226"}">(${profit >= 0 ? "+" : ""}${Math.round(profit)})</span></div>
      </div>
    `;
    list.appendChild(div);
  });
}

/* ---------------- order placement ---------------- */
function placeOrder() {
  if (!sim.you || !gameStarted || endShown) return;
  const stock = pickSelectedStock();
  const status = $("#orderStatus");
  status.classList.remove("hidden", "error");

  const result = sim.placePlayerOrder(sim.you, {
    side: currentSide,
    stockId: stock.id,
    qty: state.quantity,
    price: state.price,
  });

  if (!result.ok) {
    status.className = "order-status error";
    status.textContent = result.msg;
    showToast("❌ " + result.msg);
    return;
  }

  if (result.pending) {
    status.className = "order-status";
    status.textContent = `🧺 ऑर्डर मंडी में लटका है: ${stock.emoji} ${currentSide === "buy" ? "ख़रीद" : "बेचें"} ${state.quantity} @ ₹${state.price}। जब दाम मैच होगा, सौदा पक्का होगा।`;
    showToast("⏳ ऑर्डर मंडी में लटका दिया!");
    renderPendingOrders();
  } else {
    const price = result.price;
    if (currentSide === "buy") {
      status.className = "order-status";
      status.textContent = `✅ सौदा पक्का! ${stock.emoji} ${stock.name} के ${result.qty} क्रेट ₹${price} में मिले।`;
      if (result.rot > 0) {
        status.textContent += ` ⚠️ ${result.rot} क्रेट सड़ गए (₹${result.rot * price} गए)!`;
      }
      showToast(`🎉 ख़रीद हो गई! ${result.qty} क्रेट @ ₹${price}`);
    } else {
      status.className = "order-status";
      status.textContent = `✅ बिक गया! ${stock.emoji} ${stock.name} के ${result.qty} क्रेट ₹${price} में बेचे।`;
      showToast(`💰 बिक गया! ${result.qty} क्रेट @ ₹${price}`);
    }
    state.price = Math.min(Math.max(state.price, Number($("#priceSlider").min)), Number($("#priceSlider").max));
    refreshTradeState();
  }

  refreshTradingPanel();
  refreshLeaderboard();
}

function refreshTradeState() {
  const stock = pickSelectedStock();
  chart.update(stock, stock.history);
  refreshTicker();
  refreshLeaderboard();
}

/* ---------------- lifecycle ---------------- */
function startGame() {
  const role = selectedRole;
  const you = createPlayer({ id: "you", name: "आप", emoji: roleEmoji[role], isHuman: true, role });
  const bots = [
    createPlayer({ id: "ravi", name: "रवि", emoji: "🧒", strategy: "momentum", color: "#4f8ac9" }),
    createPlayer({ id: "priya", name: "प्रिया", emoji: "🧑‍🎓", strategy: "value", color: "#d16a9a" }),
    createPlayer({ id: "chintu", name: "चिंटू", emoji: "👦", strategy: "random", color: "#c7a13c" }),
  ];
  sim.start([you, ...bots]);
  sim.you = you;

  $("#roleEmoji").textContent = roleEmoji[role];
  $("#roleTitle").textContent = roleTitle[role];
  $("#roleHint").textContent = roleHint[role];

  state.quantity = 1;
  state.price = sim.getStock(selectedStockId).price;
  currentSide = "buy";
  refreshSide();

  $("#introOverlay").classList.add("hidden");
  $("#endOverlay").classList.add("hidden");
  $("#rotWarning").classList.add("hidden");
  $("#orderStatus").classList.add("hidden");

  gameStarted = true;
  endShown = false;

  const stock = sim.getStock(selectedStockId);
  chart.setStock(selectedStockId);
  chart.update(stock, stock.history);
  refreshTicker();
  refreshTradingPanel();
  refreshLeaderboard();

  showToast(`${you.emoji} ${role === "buyer" ? "Buyer Kid" : "Seller Kid"} के तौर पर मंडी में आए! मज़े करो!`, 3500);

  intervalId = setInterval(() => {
    sim.tick();
    updateAfterTick();
    if (!sim.running && !endShown) {
      endGame();
    }
  }, sim.tickMs);
}

function updateAfterTick() {
  const stock = pickSelectedStock();
  chart.update(stock, stock.history);
  refreshTicker();
  refreshTradingPanel();
  refreshLeaderboard();
  renderTimer();
}

function renderTimer() {
  const seconds = sim.timeLeft;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const el = $("#timer");
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.parentElement.style.background = seconds <= 10 ? "#ffd9d4" : "";
}

function endGame() {
  if (endShown) return;
  endShown = true;
  clearInterval(intervalId);
  sim.stop();
  renderTimer();

  const ranking = sim.ranking();
  const you = sim.you;
  const yourRank = ranking.findIndex((p) => p.isHuman) + 1;
  const profit = sim.profit(you);
  const results = $("#endResults");
  results.innerHTML = `
    <div class="result-row ${yourRank === 1 ? "win" : ""}">
      <span>🏆 आपकी र‍ैंकिंग</span>
      <span>#${yourRank} / ${ranking.length}</span>
    </div>
    <div class="result-row">
      <span>💰 आपकी कुल दौलत</span>
      <span class="net">${fmt(sim.netWorth(you))}</span>
    </div>
    <div class="result-row">
      <span>📈 इस मंडी में मुनाफ़ा</span>
      <span class="net" style="color:${profit >= 0 ? "#2c974b" : "#a63226"}">${profit >= 0 ? "+" : ""}${Math.round(profit)}</span>
    </div>
  `;

  for (const p of ranking) {
    const row = document.createElement("div");
    row.className = "result-row" + (p.isHuman ? " win" : "");
    row.innerHTML = `<span>${p.emoji} ${p.name}</span><span class="net">${fmt(sim.netWorth(p))} (${sim.profit(p) >= 0 ? "+" : ""}${Math.round(sim.profit(p))})</span>`;
    results.appendChild(row);
  }

  if (yourRank === 1) {
    showToast("🎉 तुम मंडी के चैंपियन बने!", 5000);
  } else if (profit < 0) {
    showToast("अगली बार ध्यान से सोचो — कम भाव पर ख़रीदो, ऊँचे पर बेचो!", 5000);
  }

  $("#endOverlay").classList.remove("hidden");
}

/* ---------------- event wiring ---------------- */
function bindEvents() {
  // role selection
  $$(".role-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedRole = card.dataset.role;
      $$(".role-card").forEach((c) => c.classList.toggle("selected", c === card));
    });
  });
  $("#startGame").addEventListener("click", startGame);
  $("#replayButton").addEventListener("click", () => location.reload());

  // side toggle
  $$(".side-btn").forEach((b) => b.addEventListener("click", () => setSide(b.dataset.side)));

  // quantity slider
  $("#qtySlider").addEventListener("input", (e) => {
    state.quantity = Number(e.target.value);
    $("#qtyValue").textContent = state.quantity;
    updateRotWarning();
  });

  // price slider + plus/minus
  $("#priceSlider").addEventListener("input", (e) => {
    state.price = Number(e.target.value);
    $("#priceValue").textContent = state.price;
    updatePriceHint();
    updateRotWarning();
  });
  $("#priceMinus").addEventListener("click", () => stepPrice(-1));
  $("#pricePlus").addEventListener("click", () => stepPrice(1));
  $("#orderButton").addEventListener("click", placeOrder);

  // engine callbacks
  sim.onTrade = (trade) => {
    if (!trade.isHuman) return;
    refreshTradingPanel();
    refreshLeaderboard();
  };
  sim.onOrder = (order, status) => {
    if (status === "filled") {
      const s = STOCKS_BY_ID[order.stockId];
      showToast(`✅ सौदा पक्का! ${s.emoji} ${order.side === "buy" ? "ख़रीद" : "बेचें"} ${order.qty} @ ₹${order.price} पर मैच हुआ।`);
    }
    renderPendingOrders();
  };
  sim.onEvent = (title, detail) => {
    showToast(`📢 ${title} — ${detail}`, 5000);
  };
}

function stepPrice(delta) {
  const slider = $("#priceSlider");
  const min = Number(slider.min);
  const max = Number(slider.max);
  state.price = Math.min(Math.max(min, state.price + delta), max);
  slider.value = state.price;
  $("#priceValue").textContent = state.price;
  updatePriceHint();
  updateRotWarning();
}

/* ---------------- boot ---------------- */
function boot() {
  chart = new CrateChart($("#chart3d"));
  const loading = $("#chart3d .canvas-loading");
  if (loading) loading.remove();

  // pre-select buyer role by default
  const buyerCard = document.querySelector('.role-card[data-role="buyer"]');
  buyerCard.classList.add("selected");

  buildTicker();
  selectStock("tomato");
  bindEvents();
  renderTimer();
  refreshTradingPanel();
  refreshLeaderboard();
}

boot();
