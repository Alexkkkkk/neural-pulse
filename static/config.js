// --- ⚙️ NEURAL PULSE ENGINE CONFIG V10.6 ---
window.PULSE_CONFIG = {
  // 🧮 МАТЕМАТИКА ЗДОРОВЬЯ
  MATH: {
    HEALTH_BASE: 100,
    CPU_WEIGHT: 0.4,       // Влияние CPU (чем выше, тем быстрее падает здоровье)
    LATENCY_WEIGHT: 0.15,  // Влияние пинга
    RAM_LIMIT: 450,        // МБ, после которых здоровье начинает снижаться
    PRECISION: 1           // Округление (знаков после запятой)
  },

  // 💎 МАГАЗИН И TON
  SHOP: {
    RECEIVER: "ТВОЙ_АДРЕС_TON_КОШЕЛЬКА", // ЗАМЕНИ НА СВОЙ
    NETWORK: "mainnet",
    PACKS: [
      { id: "p_min", name: "MINI PULSE", credits: 500, price: 0.5, color: "#00f2fe" },
      { id: "p_med", name: "MEDIUM PULSE", credits: 2000, price: 1.5, color: "#7000ff" },
      { id: "p_max", name: "ULTRA PULSE", credits: 10000, price: 5.0, color: "#39ff14" }
    ]
  }
};
