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
  cart: [], // { key, productId, name, price, variationName, qty, image }
  variationTarget: null, // produto em edição no modal de variação
  selectedVariation: null, // objeto normalizado {name, price, minQty, maxQty} ou null
  variationQty: 1,
  selectedPayment: "pix",
};

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
      (c) => `<button class="cat-pill ${STATE.activeCategory === c.id ? "active" : ""}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.icon || "")} ${escapeHtml(c.name)}</button>`
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
  const outOfStock = typeof p.stock === "number" && p.stock <= 0;
  const lowStock = typeof p.stock === "number" && p.stock > 0 && p.stock <= 5;
  const image = p.image && p.image.startsWith("http")
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;" />`
    : escapeHtml(p.image || "📦");

  const hasPromo = p.promo && p.promo.active;
  const finalPrice = basePriceOf(p);
  const priceHTML = hasPromo
    ? `<span class="product-price">${formatBRL(finalPrice)}</span> <span style="text-decoration:line-through;color:var(--text-muted);font-size:.78rem;">${formatBRL(p.price)}</span>`
    : `<span class="product-price">${formatBRL(p.price)}</span>`;

  return `
  <article class="product-card" data-product="${p.id}">
    <div class="product-thumb">
      ${p.featured ? '<span class="badge-featured">Destaque</span>' : ""}
      ${hasPromo ? '<span class="badge-featured" style="left:auto; right:8px; background:var(--danger);">OFERTA</span>' : ""}
      ${outOfStock ? '<span class="badge-stock-low">Esgotado</span>' : lowStock ? '<span class="badge-stock-low">Últimas unidades</span>' : ""}
      ${image}
    </div>
    <div class="product-body">
      <span class="product-cat">${escapeHtml(cat ? cat.name : "")}</span>
      <h3 class="product-name">${escapeHtml(p.name)}</h3>
      <p class="product-desc">${escapeHtml(p.description || "")}</p>
      <div class="product-footer">
        <span>${priceHTML}</span>
        <button class="btn btn-navy btn-sm" data-open-product="${p.id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Esgotado" : "Escolher"}</button>
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
  const variations = normalizeVariations(product.variations);
  STATE.selectedVariation = variations.length ? variations[0] : null;
  STATE.variationQty = effectiveMinQty(product, STATE.selectedVariation);

  document.getElementById("variation-product-name").textContent = product.name;
  document.getElementById("variation-product-desc").textContent = product.description || "";
  document.getElementById("variation-qty").textContent = STATE.variationQty;

  const optionsWrap = document.getElementById("variation-options");
  if (variations.length) {
    optionsWrap.parentElement.classList.remove("hidden");
    optionsWrap.innerHTML = variations
      .map((v) => {
        const priceTag = v.price != null ? ` (${formatBRL(v.price)})` : "";
        return `<button type="button" class="variation-chip ${v.name === STATE.selectedVariation.name ? "selected" : ""}" data-variation="${escapeHtml(v.name)}">${escapeHtml(v.name)}${priceTag}</button>`;
      })
      .join("");
    optionsWrap.querySelectorAll(".variation-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        STATE.selectedVariation = variations.find((v) => v.name === chip.dataset.variation);
        STATE.variationQty = effectiveMinQty(product, STATE.selectedVariation);
        document.getElementById("variation-qty").textContent = STATE.variationQty;
        optionsWrap.querySelectorAll(".variation-chip").forEach((c) => c.classList.toggle("selected", c === chip));
        updateVariationPriceHint();
      });
    });
  } else {
    optionsWrap.parentElement.classList.add("hidden");
  }

  updateVariationPriceHint();
  openModal("variation-modal");
}

function updateVariationPriceHint() {
  const product = STATE.variationTarget;
  if (!product) return;
  const unitPrice = effectivePrice(product, STATE.selectedVariation);
  const min = effectiveMinQty(product, STATE.selectedVariation);
  const max = effectiveMaxQty(product, STATE.selectedVariation);
  let hint = `${formatBRL(unitPrice)} / unidade`;
  if (min > 1) hint += ` · mínimo ${min} un.`;
  if (max != null) hint += ` · máximo ${max} un.`;
  const hintEl = document.getElementById("variation-price-hint");
  if (hintEl) hintEl.textContent = hint;
}

function bindVariationStepper() {
  document.getElementById("variation-qty-stepper").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;
    const product = STATE.variationTarget;
    if (!product) return;
    const min = effectiveMinQty(product, STATE.selectedVariation);
    const max = effectiveMaxQty(product, STATE.selectedVariation);
    const step = parseInt(btn.dataset.step, 10);
    let next = STATE.variationQty + step;
    next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    STATE.variationQty = next;
    document.getElementById("variation-qty").textContent = STATE.variationQty;
  });

  document.getElementById("variation-add-btn").addEventListener("click", () => {
    const product = STATE.variationTarget;
    if (!product) return;
    if (typeof product.stock === "number" && product.stock <= 0) {
      showToast("Produto sem estoque no momento.", "error");
      return;
    }
    const min = effectiveMinQty(product, STATE.selectedVariation);
    const max = effectiveMaxQty(product, STATE.selectedVariation);
    if (STATE.variationQty < min) {
      showToast(`A quantidade mínima para este produto é ${min}.`, "error");
      return;
    }
    if (max != null && STATE.variationQty > max) {
      showToast(`A quantidade máxima para este produto é ${max}.`, "error");
      return;
    }
    addToCart(product, STATE.selectedVariation, STATE.variationQty);
    closeModal("variation-modal");
    showToast(`${product.name} adicionado ao carrinho!`, "success");
  });
}

/* ---------------- Carrinho ---------------- */
function addToCart(product, variation, qty) {
  const key = `${product.id}::${variation ? variation.name : "-"}`;
  const existing = STATE.cart.find((i) => i.key === key);
  const unitPrice = effectivePrice(product, variation);
  if (existing) {
    existing.qty += qty;
  } else {
    STATE.cart.push({
      key,
      productId: product.id,
      name: product.name,
      price: unitPrice,
      variation: variation ? variation.name : null,
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

function limitsForCartItem(item) {
  const product = STATE.products.find((p) => p.id === item.productId);
  if (!product) return { min: 1, max: null };
  const variations = normalizeVariations(product.variations);
  const variation = item.variation ? variations.find((v) => v.name === item.variation) : null;
  return { min: effectiveMinQty(product, variation), max: effectiveMaxQty(product, variation) };
}

function changeCartQty(key, delta) {
  const item = STATE.cart.find((i) => i.key === key);
  if (!item) return;
  const { min, max } = limitsForCartItem(item);
  let next = item.qty + delta;
  next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  item.qty = next;
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
      <div class="cart-item" data-key="${escapeHtml(i.key)}">
        <div class="cart-item-thumb">${i.image && i.image.startsWith("http") ? `<img src="${escapeHtml(i.image)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : escapeHtml(i.image || "📦")}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(i.name)}</div>
          ${i.variation ? `<div class="cart-item-variant">${escapeHtml(i.variation)}</div>` : ""}
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
        <p class="payment-option-details" id="details-${key}">${escapeHtml(m.details)}</p>
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
