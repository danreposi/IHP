/* ==========================================================
   LÓGICA DA LOJA (fluxo do cliente)
   Início -> Categorias -> Vitrine -> Variação -> Quantidade ->
   Carrinho -> Checkout -> Finalizar Pedido -> WhatsApp
   ========================================================== */

let STATE = {
  categories: [],
  products: [],
  settings: {},
  activeCategory: "all",
  searchTerm: "",
  cart: [], // { productId, name, price, variation, qty, image }
  variationTarget: null, // produto em edição no modal de variação
  selectedVariation: null,
  variationQty: 1,
  selectedPayment: "pix",
};

function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------------- Inicialização ---------------- */
async function initStore() {
  await DB.init();
  STATE.categories = await DB.getCategories();
  STATE.products = await DB.getProducts();
  STATE.settings = await DB.getSettings();
  STATE.cart = DB.getCart();

  document.getElementById("brand-name").textContent = STATE.settings.storeName || CONFIG.STORE_NAME;
  document.getElementById("footer-store-name").textContent = STATE.settings.storeName || CONFIG.STORE_NAME;
  document.getElementById("year").textContent = new Date().getFullYear();

  DB.registerVisit();

  renderCategoryNav();
  renderFeatured();
  renderCatalog();
  renderPaymentOptions();
  updateCartUI();
  bindEvents();
}

/* ---------------- Categorias ---------------- */
function renderCategoryNav() {
  const nav = document.getElementById("category-nav");
  const pills = [{ id: "all", name: "Todas", icon: "🗂️" }, ...STATE.categories];
  nav.innerHTML = pills
    .map(
      (c) => `<button class="cat-pill ${STATE.activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon || ""} ${c.name}</button>`
    )
    .join("");
  nav.querySelectorAll(".cat-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      STATE.activeCategory = btn.dataset.cat;
      renderCategoryNav();
      renderCatalog();
      document.getElementById("catalog-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---------------- Produtos ---------------- */
function productCardHTML(p) {
  const cat = STATE.categories.find((c) => c.id === p.categoryId);
  const lowStock = typeof p.stock === "number" && p.stock <= 5;
  const image = p.image && p.image.startsWith("http")
    ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" />`
    : (p.image || "📦");
  return `
  <article class="product-card" data-product="${p.id}">
    <div class="product-thumb">
      ${p.featured ? '<span class="badge-featured">Destaque</span>' : ""}
      ${lowStock ? '<span class="badge-stock-low">Últimas unidades</span>' : ""}
      ${image}
    </div>
    <div class="product-body">
      <span class="product-cat">${cat ? cat.name : ""}</span>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-desc">${p.description || ""}</p>
      <div class="product-footer">
        <span class="product-price">${formatBRL(p.price)}</span>
        <button class="btn btn-navy btn-sm" data-open-product="${p.id}">Escolher</button>
      </div>
    </div>
  </article>`;
}

function renderFeatured() {
  const featured = STATE.products.filter((p) => p.featured);
  const section = document.getElementById("featured-section");
  if (!featured.length) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  document.getElementById("featured-grid").innerHTML = featured.map(productCardHTML).join("");
  bindProductCardEvents(document.getElementById("featured-grid"));
}

function filteredProducts() {
  return STATE.products.filter((p) => {
    const matchCat = STATE.activeCategory === "all" || p.categoryId === STATE.activeCategory;
    const matchSearch = !STATE.searchTerm || p.name.toLowerCase().includes(STATE.searchTerm) || (p.description || "").toLowerCase().includes(STATE.searchTerm);
    return matchCat && matchSearch;
  });
}

function renderCatalog() {
  const list = filteredProducts();
  const grid = document.getElementById("catalog-grid");
  const empty = document.getElementById("catalog-empty");
  const catName = STATE.activeCategory === "all" ? "Todos os produtos" : (STATE.categories.find((c) => c.id === STATE.activeCategory)?.name || "Produtos");
  document.getElementById("catalog-title").textContent = catName;

  if (!list.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  grid.innerHTML = list.map(productCardHTML).join("");
  bindProductCardEvents(grid);
}

function bindProductCardEvents(container) {
  container.querySelectorAll("[data-open-product]").forEach((btn) => {
    btn.addEventListener("click", () => openVariationModal(btn.dataset.openProduct));
  });
}

/* ---------------- Modal de Variação + Quantidade ---------------- */
function openVariationModal(productId) {
  const product = STATE.products.find((p) => p.id === productId);
  if (!product) return;
  DB.registerProductView(productId);

  STATE.variationTarget = product;
  STATE.variationQty = 1;
  STATE.selectedVariation = product.variations && product.variations.length ? product.variations[0] : null;

  document.getElementById("variation-product-name").textContent = product.name;
  document.getElementById("variation-product-desc").textContent = product.description || "";
  document.getElementById("variation-qty").textContent = STATE.variationQty;

  const optionsWrap = document.getElementById("variation-options");
  if (product.variations && product.variations.length) {
    optionsWrap.parentElement.classList.remove("hidden");
    optionsWrap.innerHTML = product.variations
      .map((v) => `<button type="button" class="variation-chip ${v === STATE.selectedVariation ? "selected" : ""}" data-variation="${v}">${v}</button>`)
      .join("");
    optionsWrap.querySelectorAll(".variation-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        STATE.selectedVariation = chip.dataset.variation;
        optionsWrap.querySelectorAll(".variation-chip").forEach((c) => c.classList.toggle("selected", c === chip));
      });
    });
  } else {
    optionsWrap.parentElement.classList.add("hidden");
  }

  openModal("variation-modal");
}

function bindVariationStepper() {
  document.getElementById("variation-qty-stepper").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;
    const step = parseInt(btn.dataset.step, 10);
    STATE.variationQty = Math.max(1, STATE.variationQty + step);
    document.getElementById("variation-qty").textContent = STATE.variationQty;
  });

  document.getElementById("variation-add-btn").addEventListener("click", () => {
    const product = STATE.variationTarget;
    if (!product) return;
    if (typeof product.stock === "number" && product.stock <= 0) {
      showToast("Produto sem estoque no momento.", "error");
      return;
    }
    addToCart(product, STATE.selectedVariation, STATE.variationQty);
    closeModal("variation-modal");
    showToast(`${product.name} adicionado ao carrinho!`, "success");
  });
}

/* ---------------- Carrinho ---------------- */
function addToCart(product, variation, qty) {
  const key = `${product.id}::${variation || "-"}`;
  const existing = STATE.cart.find((i) => i.key === key);
  if (existing) {
    existing.qty += qty;
  } else {
    STATE.cart.push({
      key,
      productId: product.id,
      name: product.name,
      price: product.price,
      variation,
      image: product.image,
      qty,
    });
  }
  DB.saveCart(STATE.cart);
  updateCartUI();
}

function removeFromCart(key) {
  STATE.cart = STATE.cart.filter((i) => i.key !== key);
  DB.saveCart(STATE.cart);
  updateCartUI();
}

function changeCartQty(key, delta) {
  const item = STATE.cart.find((i) => i.key === key);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  DB.saveCart(STATE.cart);
  updateCartUI();
}

function cartTotal() {
  return STATE.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function updateCartUI() {
  const countEl = document.getElementById("cart-count");
  const totalCount = STATE.cart.reduce((s, i) => s + i.qty, 0);
  countEl.textContent = totalCount;
  countEl.classList.toggle("hidden", totalCount === 0);

  const itemsWrap = document.getElementById("cart-items");
  if (!STATE.cart.length) {
    itemsWrap.innerHTML = `<p class="empty-state"><span class="emoji">🧾</span>Seu carrinho está vazio.<br>Adicione produtos para continuar.</p>`;
  } else {
    itemsWrap.innerHTML = STATE.cart
      .map(
        (i) => `
      <div class="cart-item" data-key="${i.key}">
        <div class="cart-item-thumb">${i.image && i.image.startsWith("http") ? `<img src="${i.image}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : i.image || "📦"}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          ${i.variation ? `<div class="cart-item-variant">${i.variation}</div>` : ""}
          <div class="cart-item-row">
            <div class="qty-stepper">
              <button data-cart-step="-1">−</button>
              <span>${i.qty}</span>
              <button data-cart-step="1">+</button>
            </div>
            <span class="cart-subtotal">${formatBRL(i.price * i.qty)}</span>
          </div>
          <button class="cart-item-remove" data-remove>Remover</button>
        </div>
      </div>`
      )
      .join("");

    itemsWrap.querySelectorAll(".cart-item").forEach((el) => {
      const key = el.dataset.key;
      el.querySelector("[data-cart-step='-1']").addEventListener("click", () => changeCartQty(key, -1));
      el.querySelector("[data-cart-step='1']").addEventListener("click", () => changeCartQty(key, 1));
      el.querySelector("[data-remove]").addEventListener("click", () => removeFromCart(key));
    });
  }

  document.getElementById("cart-total").textContent = formatBRL(cartTotal());
  document.getElementById("checkout-btn").disabled = STATE.cart.length === 0;
}

function toggleCartDrawer(open) {
  document.getElementById("overlay").classList.toggle("open", open);
  document.getElementById("cart-drawer").classList.toggle("open", open);
}

/* ---------------- Modal genérico ---------------- */
function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.getElementById("overlay").classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

/* ---------------- Checkout ---------------- */
function renderPaymentOptions() {
  const methods = STATE.settings.paymentMethods || SEED_SETTINGS.paymentMethods;
  const labels = { pix: "PIX", credito: "Crédito", debito: "Débito" };
  const wrap = document.getElementById("payment-options");
  wrap.innerHTML = Object.entries(methods)
    .filter(([, m]) => m.enabled)
    .map(
      ([key, m]) => `
      <div class="payment-option ${STATE.selectedPayment === key ? "selected" : ""}" data-payment="${key}">
        <div class="payment-option-head">
          <label><input type="radio" name="payment" ${STATE.selectedPayment === key ? "checked" : ""} style="margin-right:8px;" />${labels[key]}</label>
          <button type="button" class="link-btn" data-readmore="${key}">Ler mais</button>
        </div>
        <p class="payment-option-details ${STATE.selectedPayment === key ? "" : ""}" id="details-${key}">${m.details}</p>
      </div>`
    )
    .join("");

  wrap.querySelectorAll(".payment-option").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-readmore]")) return;
      STATE.selectedPayment = el.dataset.payment;
      renderPaymentOptions();
    });
  });
  wrap.querySelectorAll("[data-readmore]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById(`details-${btn.dataset.readmore}`).classList.toggle("show");
    });
  });
}

function buildWhatsAppMessage(order) {
  const lines = order.items.map((i) => `• ${i.qty}x ${i.name}${i.variation ? ` (${i.variation})` : ""}`);
  const labels = { pix: "PIX", credito: "Crédito", debito: "Débito" };
  let msg = `Olá! Meu nome é ${order.customer.name}.\n\nGostaria de fazer o seguinte pedido:\n${lines.join("\n")}\n\nTotal: ${formatBRL(order.total)}\n\nForma de pagamento:\n${labels[order.payment] || order.payment}`;
  if (order.notes) msg += `\n\nObservações:\n${order.notes}`;
  msg += `\n\nObrigado!`;
  return msg;
}

async function confirmOrder() {
  const name = document.getElementById("checkout-name").value.trim();
  const phone = document.getElementById("checkout-phone").value.trim();

  if (!name || !phone) {
    showToast("Preencha nome e telefone para continuar.", "error");
    return;
  }
  if (!STATE.cart.length) {
    showToast("Seu carrinho está vazio.", "error");
    return;
  }

  const order = {
    items: STATE.cart.map((i) => ({ productId: i.productId, name: i.name, variation: i.variation, qty: i.qty, price: i.price })),
    total: cartTotal(),
    customer: { name, phone },
    payment: STATE.selectedPayment,
    notes: document.getElementById("checkout-notes").value.trim(),
  };

  await DB.addOrder(order);

  const waNumber = (STATE.settings.whatsappNumber || CONFIG.WHATSAPP_NUMBER_FALLBACK).replace(/\D/g, "");
  const message = encodeURIComponent(buildWhatsAppMessage(order));
  const waUrl = `https://wa.me/${waNumber}?text=${message}`;

  STATE.cart = [];
  DB.saveCart([]);
  updateCartUI();
  closeModal("checkout-modal");

  if (waNumber) window.open(waUrl, "_blank");
  showToast("Pedido enviado com sucesso! Continue o atendimento pelo WhatsApp para concluir sua compra.", "success");
}

/* ---------------- Eventos gerais ---------------- */
function bindEvents() {
  document.getElementById("cart-btn").addEventListener("click", () => toggleCartDrawer(true));
  document.getElementById("close-cart-btn").addEventListener("click", () => toggleCartDrawer(false));
  document.getElementById("overlay").addEventListener("click", () => {
    toggleCartDrawer(false);
    closeModal("variation-modal");
    closeModal("checkout-modal");
  });
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    STATE.searchTerm = e.target.value.trim().toLowerCase();
    renderCatalog();
  });

  document.getElementById("checkout-btn").addEventListener("click", () => {
    toggleCartDrawer(false);
    openModal("checkout-modal");
  });

  document.getElementById("confirm-order-btn").addEventListener("click", confirmOrder);

  bindVariationStepper();
}

document.addEventListener("DOMContentLoaded", initStore);
