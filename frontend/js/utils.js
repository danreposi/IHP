/* ==========================================================
   UTILITÁRIOS COMPARTILHADOS (loja + admin)
   Centraliza funções repetidas e a proteção contra XSS: qualquer
   texto vindo de clientes (nome, telefone, observações) ou
   cadastrado no admin (produto, categoria) passa por escapeHtml()
   antes de entrar no HTML da página.
   ========================================================== */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBRL(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.getElementById("overlay").classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

/* ---------- Variações: aceita tanto o formato antigo (string) quanto o
   novo (objeto {name, price, minQty, maxQty}) — mantém compatibilidade
   com catálogos publicados antes dessa atualização. ---------- */
function normalizeVariation(v) {
  if (typeof v === "string") return { name: v, price: null, minQty: null, maxQty: null };
  return { name: v.name, price: v.price ?? null, minQty: v.minQty ?? null, maxQty: v.maxQty ?? null };
}
function normalizeVariations(list) {
  return (list || []).map(normalizeVariation);
}

/* ---------- Preço/limite efetivo, já considerando promoção e variação ---------- */
function basePriceOf(product) {
  return product.promo && product.promo.active
    ? promoPriceOf(product.price, product.promo)
    : product.price;
}
function promoPriceOf(price, promo) {
  if (!promo || !promo.active) return price;
  if (promo.type === "percent") return Math.max(0, price * (1 - (Number(promo.value) || 0) / 100));
  return Math.max(0, price - (Number(promo.value) || 0));
}
function effectivePrice(product, variation) {
  if (variation && variation.price != null && variation.price !== "") return Number(variation.price);
  return basePriceOf(product);
}
function effectiveMinQty(product, variation) {
  const v = variation && variation.minQty != null && variation.minQty !== "" ? Number(variation.minQty) : null;
  const p = product.minQty != null && product.minQty !== "" ? Number(product.minQty) : null;
  return v ?? p ?? 1;
}
function effectiveMaxQty(product, variation) {
  const v = variation && variation.maxQty != null && variation.maxQty !== "" ? Number(variation.maxQty) : null;
  const p = product.maxQty != null && product.maxQty !== "" ? Number(product.maxQty) : null;
  const limit = v ?? p ?? null; // null = sem limite definido pelo admin
  if (typeof product.stock === "number") {
    return limit != null ? Math.min(limit, product.stock) : product.stock;
  }
  return limit; // pode ser null (sem limite nenhum)
}
