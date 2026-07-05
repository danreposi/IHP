/* ==========================================================
   CAMADA DE DADOS (DB)
   Funciona em dois modos, transparentes para o resto do site:
     1) MODO LOCAL   -> tudo salvo em localStorage (ideal p/ GitHub Pages)
     2) MODO BACKEND -> tudo salvo via API (Node + banco de dados),
                        ativado colocando uma URL em CONFIG.API_BASE_URL
   ========================================================== */

const LS_KEYS = {
  categories: "papelaria_categories",
  products: "papelaria_products",
  orders: "papelaria_orders",
  settings: "papelaria_settings",
  cart: "papelaria_cart",
  session: "papelaria_admin_session",
  stats: "papelaria_stats",
};

const USE_API = !!(window.CONFIG && CONFIG.API_BASE_URL);

/* ---------- utilitário: hash simples de senha (SHA-256) ---------- */
async function hashText(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- helpers localStorage ---------- */
function lsGet(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- helper fetch (modo backend) ---------- */
async function api(path, options = {}) {
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken() ? { Authorization: `Bearer ${sessionToken()}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro na API (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function sessionToken() {
  return lsGet(LS_KEYS.session, null)?.token || null;
}

/* ---------- inicialização (seed na primeira visita, modo local) ---------- */
async function ensureSeed() {
  if (USE_API) return;
  if (!localStorage.getItem(LS_KEYS.categories)) lsSet(LS_KEYS.categories, SEED_CATEGORIES);
  if (!localStorage.getItem(LS_KEYS.products)) lsSet(LS_KEYS.products, SEED_PRODUCTS);
  if (!localStorage.getItem(LS_KEYS.orders)) lsSet(LS_KEYS.orders, []);
  if (!localStorage.getItem(LS_KEYS.settings)) {
    const settings = { ...SEED_SETTINGS };
    settings.adminPasswordHash = await hashText("1234");
    lsSet(LS_KEYS.settings, settings);
  }
  if (!localStorage.getItem(LS_KEYS.stats)) {
    lsSet(LS_KEYS.stats, { visits: 0 });
  }
}

const DB = {
  async init() {
    await ensureSeed();
  },

  /* ---------------- CATEGORIAS ---------------- */
  async getCategories() {
    if (USE_API) return api("/categories");
    return lsGet(LS_KEYS.categories, []).sort((a, b) => a.order - b.order);
  },
  async saveCategories(list) {
    if (USE_API) return api("/categories", { method: "PUT", body: JSON.stringify(list) });
    lsSet(LS_KEYS.categories, list);
  },
  async addCategory(cat) {
    if (USE_API) return api("/categories", { method: "POST", body: JSON.stringify(cat) });
    const list = lsGet(LS_KEYS.categories, []);
    const newCat = { id: uid("cat"), order: list.length, ...cat };
    list.push(newCat);
    lsSet(LS_KEYS.categories, list);
    return newCat;
  },
  async deleteCategory(id) {
    if (USE_API) return api(`/categories/${id}`, { method: "DELETE" });
    lsSet(LS_KEYS.categories, lsGet(LS_KEYS.categories, []).filter((c) => c.id !== id));
  },

  /* ---------------- PRODUTOS ---------------- */
  async getProducts() {
    if (USE_API) return api("/products");
    return lsGet(LS_KEYS.products, []).sort((a, b) => a.order - b.order);
  },
  async saveProducts(list) {
    if (USE_API) return api("/products", { method: "PUT", body: JSON.stringify(list) });
    lsSet(LS_KEYS.products, list);
  },
  async addProduct(prod) {
    if (USE_API) return api("/products", { method: "POST", body: JSON.stringify(prod) });
    const list = lsGet(LS_KEYS.products, []);
    const newProd = { id: uid("prod"), views: 0, order: list.length, ...prod };
    list.push(newProd);
    lsSet(LS_KEYS.products, list);
    return newProd;
  },
  async updateProduct(id, patch) {
    if (USE_API) return api(`/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    const list = lsGet(LS_KEYS.products, []);
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...patch };
    lsSet(LS_KEYS.products, list);
  },
  async deleteProduct(id) {
    if (USE_API) return api(`/products/${id}`, { method: "DELETE" });
    lsSet(LS_KEYS.products, lsGet(LS_KEYS.products, []).filter((p) => p.id !== id));
  },
  async registerProductView(id) {
    if (USE_API) return api(`/products/${id}/view`, { method: "POST" });
    const list = lsGet(LS_KEYS.products, []);
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) { list[idx].views = (list[idx].views || 0) + 1; lsSet(LS_KEYS.products, list); }
  },

  /* ---------------- PEDIDOS ---------------- */
  async getOrders() {
    if (USE_API) return api("/orders");
    return lsGet(LS_KEYS.orders, []).sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  async addOrder(order) {
    const fullOrder = { id: uid("ord"), date: new Date().toISOString(), status: "pendente", ...order };
    if (USE_API) return api("/orders", { method: "POST", body: JSON.stringify(fullOrder) });
    const list = lsGet(LS_KEYS.orders, []);
    list.push(fullOrder);
    lsSet(LS_KEYS.orders, list);
    return fullOrder;
  },
  async updateOrderStatus(id, status) {
    if (USE_API) return api(`/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    const list = lsGet(LS_KEYS.orders, []);
    const idx = list.findIndex((o) => o.id === id);
    if (idx >= 0) list[idx].status = status;
    lsSet(LS_KEYS.orders, list);
  },

  /* ---------------- CONFIGURAÇÕES ---------------- */
  async getSettings() {
    if (USE_API) return api("/settings");
    return lsGet(LS_KEYS.settings, SEED_SETTINGS);
  },
  async saveSettings(patch) {
    if (USE_API) return api("/settings", { method: "PATCH", body: JSON.stringify(patch) });
    const current = lsGet(LS_KEYS.settings, SEED_SETTINGS);
    lsSet(LS_KEYS.settings, { ...current, ...patch });
  },

  /* ---------------- ESTATÍSTICAS ---------------- */
  async registerVisit() {
    if (USE_API) return api("/stats/visit", { method: "POST" });
    const stats = lsGet(LS_KEYS.stats, { visits: 0 });
    stats.visits += 1;
    lsSet(LS_KEYS.stats, stats);
  },
  async getStats() {
    if (USE_API) return api("/stats");
    return lsGet(LS_KEYS.stats, { visits: 0 });
  },

  /* ---------------- ADMIN / AUTENTICAÇÃO ---------------- */
  async login(password) {
    if (USE_API) {
      const res = await api("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      lsSet(LS_KEYS.session, { token: res.token, at: Date.now() });
      return true;
    }
    const settings = lsGet(LS_KEYS.settings, SEED_SETTINGS);
    const hash = await hashText(password);
    if (hash === settings.adminPasswordHash) {
      lsSet(LS_KEYS.session, { token: "local-session", at: Date.now() });
      return true;
    }
    return false;
  },
  isLoggedIn() {
    const session = lsGet(LS_KEYS.session, null);
    if (!session) return false;
    // sessão expira em 8h
    return Date.now() - session.at < 8 * 60 * 60 * 1000;
  },
  logout() {
    localStorage.removeItem(LS_KEYS.session);
  },
  async changePassword(current, next) {
    if (USE_API) return api("/admin/password", { method: "POST", body: JSON.stringify({ current, next }) });
    const settings = lsGet(LS_KEYS.settings, SEED_SETTINGS);
    const currentHash = await hashText(current);
    if (currentHash !== settings.adminPasswordHash) throw new Error("Senha atual incorreta.");
    settings.adminPasswordHash = await hashText(next);
    lsSet(LS_KEYS.settings, settings);
  },

  /* ---------------- CARRINHO (sempre local, mesmo em modo backend) ---------------- */
  getCart() {
    return lsGet(LS_KEYS.cart, []);
  },
  saveCart(items) {
    lsSet(LS_KEYS.cart, items);
  },
};
