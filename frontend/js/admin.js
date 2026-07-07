/* ==========================================================
   PAINEL ADMINISTRATIVO
   showToast/formatBRL/formatDate/escapeHtml/openModal/closeModal
   vêm de utils.js (compartilhado com a loja).
   ========================================================== */

let ADMIN_STATE = {
  categories: [],
  products: [],
  orders: [],
  settings: {},
  stats: {},
};

let ORDERS_FILTER = { search: "", status: "todos" };
let variationRowSeq = 0;

/* ---------------- Boot / Login ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await DB.init();
  if (DB.isLoggedIn()) {
    await enterAdmin();
  } else {
    document.getElementById("login-shell").classList.remove("hidden");
  }

  document.getElementById("login-btn").addEventListener("click", doLogin);
  document.getElementById("login-password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  document.getElementById("forgot-password-btn").addEventListener("click", forgotPassword);
  document.getElementById("logout-btn").addEventListener("click", () => { DB.logout(); location.reload(); });
  document.getElementById("admin-theme-btn").addEventListener("click", (e) => { e.stopPropagation(); document.getElementById("theme-menu").classList.toggle("open"); });

  document.querySelectorAll(".admin-nav-btn[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));
  document.getElementById("overlay").addEventListener("click", () => { closeModal("product-modal"); closeModal("category-modal"); });
});

async function doLogin() {
  const pass = document.getElementById("login-password").value;
  const ok = await DB.login(pass);
  const errorEl = document.getElementById("login-error");
  if (ok) {
    errorEl.classList.add("hidden");
    await enterAdmin();
  } else {
    errorEl.textContent = "Senha incorreta. Tente novamente.";
    errorEl.classList.remove("hidden");
  }
}

async function forgotPassword() {
  const settings = await DB.getSettings();
  const email = settings.supportEmail || "leodanialves@gmail.com";
  window.location.href = `mailto:${email}?subject=${encodeURIComponent("Esqueci a senha do painel administrativo")}&body=${encodeURIComponent("Olá, esqueci a senha do painel administrativo da papelaria. Poderia me ajudar a redefinir?")}`;
  showToast(`Abrindo seu e-mail para contato com ${email}...`);
}

async function enterAdmin() {
  document.getElementById("login-shell").classList.add("hidden");
  document.getElementById("admin-shell").classList.remove("hidden");
  await loadAllData();
  renderDashboard();
  renderProductsTable();
  renderCategoriesTable();
  renderOrdersTable();
  renderConfig();
  bindProductModal();
  bindCategoryModal();
  bindOrdersFilters();
  checkGithubTokenExpiry();
}

async function loadAllData() {
  ADMIN_STATE.categories = await DB.getCategories();
  ADMIN_STATE.products = await DB.getProducts();
  ADMIN_STATE.orders = await DB.getOrders();
  ADMIN_STATE.settings = await DB.getSettings();
  ADMIN_STATE.stats = await DB.getStats();
}

function switchTab(tab) {
  document.querySelectorAll("[id^='tab-']").forEach((s) => s.classList.add("hidden"));
  document.getElementById(`tab-${tab}`).classList.remove("hidden");
  document.querySelectorAll(".admin-nav-btn[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
}

/* ---------------- Ações rápidas de status (Dashboard + Pedidos) ---------------- */
function orderQuickActionsHTML(o) {
  const opt = (status, icon, label) =>
    `<button title="${label}" data-order-id="${o.id}" data-set-status="${status}" style="opacity:${o.status === status ? 1 : 0.35};">${icon}</button>`;
  return `<div class="row-actions">${opt("pendente", "⏳", "Marcar pendente")}${opt("concluido", "✅", "Marcar concluído")}${opt("cancelado", "❌", "Marcar cancelado")}</div>`;
}

function bindOrderQuickActions(container, afterUpdate) {
  container.querySelectorAll("[data-set-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await DB.updateOrderStatus(btn.dataset.orderId, btn.dataset.setStatus);
      await loadAllData();
      await autoBackupIfEnabled();
      afterUpdate();
      showToast("Status do pedido atualizado.", "success");
    });
  });
}

/* ---------------- Dashboard ---------------- */
function renderSalesChart(orders) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const totals = days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return orders
      .filter((o) => o.status !== "cancelado" && new Date(o.date) >= day && new Date(o.date) < next)
      .reduce((sum, o) => sum + o.total, 0);
  });
  const max = Math.max(...totals, 1);

  const bars = totals
    .map((total, i) => {
      const heightPct = Math.max(4, Math.round((total / max) * 100));
      const label = days[i].toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
        <span class="mono" style="font-size:.68rem; color:var(--text-muted);">${total > 0 ? formatBRL(total) : ""}</span>
        <div style="width:100%; max-width:34px; height:120px; display:flex; align-items:flex-end;">
          <div style="width:100%; height:${heightPct}%; background:linear-gradient(180deg, var(--accent), var(--navy)); border-radius:6px 6px 2px 2px;"></div>
        </div>
        <span style="font-size:.72rem; color:var(--text-muted); text-transform:capitalize;">${label}</span>
      </div>`;
    })
    .join("");

  document.getElementById("sales-chart").innerHTML = `<div style="display:flex; gap:10px; align-items:flex-end;">${bars}</div>`;
}

function renderDashboard() {
  const orders = ADMIN_STATE.orders;
  const completed = orders.filter((o) => o.status === "concluido");
  const cancelled = orders.filter((o) => o.status === "cancelado");
  const revenue = completed.reduce((s, o) => s + o.total, 0);
  const avgTicket = completed.length ? revenue / completed.length : 0;
  const promoCount = ADMIN_STATE.products.filter((p) => p.promo && p.promo.active).length;

  const productSales = {};
  const productViews = {};
  orders.forEach((o) => o.items.forEach((i) => { productSales[i.name] = (productSales[i.name] || 0) + i.qty; }));
  ADMIN_STATE.products.forEach((p) => { productViews[p.name] = p.views || 0; });
  const topSelling = Object.entries(productSales).sort((a, b) => b[1] - a[1])[0];
  const topViewed = Object.entries(productViews).sort((a, b) => b[1] - a[1])[0];
  const paymentCounts = {};
  orders.forEach((o) => { paymentCounts[o.payment] = (paymentCounts[o.payment] || 0) + 1; });
  const topPayment = Object.entries(paymentCounts).sort((a, b) => b[1] - a[1])[0];
  const lowStock = ADMIN_STATE.products.filter((p) => typeof p.stock === "number" && p.stock <= 5).length;

  const stats = [
    { label: "Acessos ao site", value: ADMIN_STATE.stats.visits || 0 },
    { label: "Pedidos enviados", value: orders.length },
    { label: "Pedidos concluídos", value: completed.length },
    { label: "Pedidos cancelados", value: cancelled.length },
    { label: "Receita estimada", value: formatBRL(revenue) },
    { label: "Ticket médio", value: formatBRL(avgTicket) },
    { label: "Produto mais vendido", value: topSelling ? escapeHtml(topSelling[0]) : "—" },
    { label: "Produto mais visualizado", value: topViewed ? escapeHtml(topViewed[0]) : "—" },
    { label: "Pagamento mais usado", value: topPayment ? topPayment[0].toUpperCase() : "—" },
    { label: "Produtos com estoque baixo", value: lowStock },
    { label: "Produtos em promoção", value: promoCount },
  ];
  document.getElementById("stat-grid").innerHTML = stats
    .map((s) => `<div class="stat-card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`)
    .join("");

  renderSalesChart(orders);

  const tbody = document.querySelector("#recent-orders-table tbody");
  tbody.innerHTML = orders
    .slice(0, 8)
    .map(
      (o) => `<tr>
        <td>${escapeHtml(o.customer.name)}</td>
        <td>${o.items.reduce((s, i) => s + i.qty, 0)} item(ns)</td>
        <td>${formatBRL(o.total)}</td>
        <td>${o.payment.toUpperCase()}</td>
        <td><span class="pill-status ${o.status}">${o.status}</span></td>
        <td>${formatDate(o.date)}</td>
        <td>${orderQuickActionsHTML(o)}</td>
      </tr>`
    )
    .join("") || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum pedido ainda.</td></tr>`;

  bindOrderQuickActions(tbody, () => { renderDashboard(); renderOrdersTable(); });
}

/* ---------------- Produtos ---------------- */
function limitLabel(p) {
  const min = p.minQty && p.minQty > 1 ? p.minQty : null;
  const max = p.maxQty || null;
  if (!min && !max) return "—";
  return `${min || 1}–${max || "∞"}`;
}

function promoLabel(p) {
  if (!p.promo || !p.promo.active) return "";
  const v = p.promo.type === "percent" ? `-${p.promo.value}%` : `-${formatBRL(p.promo.value)}`;
  return `<span style="color:var(--danger); font-weight:700;">🔥 ${v}</span>`;
}

function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  const sorted = [...ADMIN_STATE.products].sort((a, b) => a.order - b.order);
  tbody.innerHTML = sorted
    .map((p, idx) => {
      const cat = ADMIN_STATE.categories.find((c) => c.id === p.categoryId);
      return `<tr data-id="${p.id}">
        <td class="row-actions">
          <button title="Mover para cima" data-move-product="${p.id}:-1" ${idx === 0 ? "disabled" : ""}>▲</button>
          <button title="Mover para baixo" data-move-product="${p.id}:1" ${idx === sorted.length - 1 ? "disabled" : ""}>▼</button>
        </td>
        <td>${p.image && p.image.startsWith("http") ? "🖼️" : escapeHtml(p.image || "📦")} ${escapeHtml(p.name)}</td>
        <td>${escapeHtml(cat ? cat.name : "—")}</td>
        <td>${formatBRL(p.price)}</td>
        <td>${typeof p.stock === "number" ? p.stock : "—"}</td>
        <td class="mono">${limitLabel(p)}</td>
        <td>${p.featured ? "⭐" : ""}</td>
        <td>${promoLabel(p)}</td>
        <td>${p.views || 0}</td>
        <td class="row-actions">
          <button title="Duplicar" data-duplicate-product="${p.id}">⧉</button>
          <button title="Editar" data-edit-product="${p.id}">✏️</button>
          <button title="Excluir" data-delete-product="${p.id}">🗑️</button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">Nenhum produto cadastrado.</td></tr>`;

  tbody.querySelectorAll("[data-edit-product]").forEach((btn) => btn.addEventListener("click", () => openProductModal(btn.dataset.editProduct)));
  tbody.querySelectorAll("[data-delete-product]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este produto?")) return;
      await DB.deleteProduct(btn.dataset.deleteProduct);
      await loadAllData();
      await autoBackupIfEnabled();
      renderProductsTable();
      renderDashboard();
      showToast("Produto excluído.", "success");
    })
  );
  tbody.querySelectorAll("[data-duplicate-product]").forEach((btn) =>
    btn.addEventListener("click", () => duplicateProduct(btn.dataset.duplicateProduct))
  );
  tbody.querySelectorAll("[data-move-product]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [id, dir] = btn.dataset.moveProduct.split(":");
      moveProductOrder(id, parseInt(dir, 10));
    })
  );
}

async function moveProductOrder(id, direction) {
  const list = [...ADMIN_STATE.products].sort((a, b) => a.order - b.order);
  const idx = list.findIndex((p) => p.id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
  const tmp = list[idx].order;
  list[idx].order = list[swapIdx].order;
  list[swapIdx].order = tmp;
  await DB.saveProducts(list);
  await loadAllData();
  await autoBackupIfEnabled();
  renderProductsTable();
}

async function duplicateProduct(id) {
  const product = ADMIN_STATE.products.find((p) => p.id === id);
  if (!product) return;
  const clone = { ...product, name: `${product.name} (cópia)` };
  delete clone.id;
  delete clone.order;
  delete clone.views;
  await DB.addProduct(clone);
  await loadAllData();
  await autoBackupIfEnabled();
  renderProductsTable();
  renderDashboard();
  showToast("Produto duplicado! Edite a cópia para ajustar o que for preciso.", "success");
}

function fillCategorySelect() {
  const select = document.getElementById("product-category");
  select.innerHTML = ADMIN_STATE.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

/* ---------- Editor de variações (linhas dinâmicas) ---------- */
function variationRowHTML(v, rowId) {
  return `
  <div class="variation-row" data-row-id="${rowId}" style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
    <input type="text" data-v-name value="${escapeHtml(v.name || "")}" placeholder="Nome (ex: Colorida)" style="flex:2; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-soft); color:var(--text);" />
    <input type="number" step="0.01" data-v-price value="${v.price != null ? v.price : ""}" placeholder="Preço" style="flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-soft); color:var(--text);" />
    <input type="number" min="1" data-v-min value="${v.minQty != null ? v.minQty : ""}" placeholder="Mín." style="flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-soft); color:var(--text);" />
    <input type="number" min="1" data-v-max value="${v.maxQty != null ? v.maxQty : ""}" placeholder="Máx." style="flex:1; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-soft); color:var(--text);" />
    <button type="button" data-remove-variation="${rowId}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1rem;">✕</button>
  </div>`;
}

function renderVariationsEditor(variations) {
  const wrap = document.getElementById("variations-editor");
  wrap.innerHTML = "";
  variations.forEach((v) => addVariationRow(v));
}

function addVariationRow(v = { name: "", price: null, minQty: null, maxQty: null }) {
  const wrap = document.getElementById("variations-editor");
  const rowId = `vrow-${variationRowSeq++}`;
  wrap.insertAdjacentHTML("beforeend", variationRowHTML(v, rowId));
  wrap.querySelector(`[data-remove-variation="${rowId}"]`).addEventListener("click", () => {
    wrap.querySelector(`[data-row-id="${rowId}"]`).remove();
  });
}

function gatherVariationsFromEditor() {
  const rows = document.querySelectorAll("#variations-editor .variation-row");
  const result = [];
  rows.forEach((row) => {
    const name = row.querySelector("[data-v-name]").value.trim();
    if (!name) return;
    const priceRaw = row.querySelector("[data-v-price]").value;
    const minRaw = row.querySelector("[data-v-min]").value;
    const maxRaw = row.querySelector("[data-v-max]").value;
    result.push({
      name,
      price: priceRaw === "" ? null : parseFloat(priceRaw),
      minQty: minRaw === "" ? null : parseInt(minRaw, 10),
      maxQty: maxRaw === "" ? null : parseInt(maxRaw, 10),
    });
  });
  return result;
}

/* ---------- Imagem: tipo + preview ---------- */
function updateImagePreview() {
  const value = document.getElementById("product-image").value.trim();
  const preview = document.getElementById("product-image-preview");
  if (value.startsWith("http")) {
    preview.innerHTML = `<img src="${escapeHtml(value)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='⚠️'" />`;
  } else {
    preview.textContent = value || "📦";
  }
}

/* ---------- Promoção: preview de preço ---------- */
function updatePromoPreview() {
  const active = document.getElementById("product-promo-active").checked;
  document.getElementById("promo-fields").classList.toggle("hidden", !active);
  const price = parseFloat(document.getElementById("product-price").value) || 0;
  const type = document.getElementById("product-promo-type").value;
  const value = parseFloat(document.getElementById("product-promo-value").value) || 0;
  const previewEl = document.getElementById("promo-preview");
  if (!active || !price) { previewEl.textContent = ""; return; }
  const finalPrice = type === "percent" ? Math.max(0, price * (1 - value / 100)) : Math.max(0, price - value);
  previewEl.textContent = `De ${formatBRL(price)} por ${formatBRL(finalPrice)}`;
}

function openProductModal(id) {
  fillCategorySelect();
  const product = id ? ADMIN_STATE.products.find((p) => p.id === id) : null;
  document.getElementById("product-modal-title").textContent = product ? "Editar produto" : "Novo produto";
  document.getElementById("product-id").value = product ? product.id : "";
  document.getElementById("product-name").value = product ? product.name : "";
  document.getElementById("product-description").value = product ? product.description || "" : "";
  document.getElementById("product-price").value = product ? product.price : "";
  document.getElementById("product-category").value = product ? product.categoryId : (ADMIN_STATE.categories[0]?.id || "");
  document.getElementById("product-image").value = product ? product.image || "" : "";
  document.getElementById("product-stock").value = product && typeof product.stock === "number" ? product.stock : "";
  document.getElementById("product-min-qty").value = product && product.minQty > 1 ? product.minQty : "";
  document.getElementById("product-max-qty").value = product && product.maxQty ? product.maxQty : "";
  document.getElementById("product-featured").checked = product ? !!product.featured : false;

  const isUrl = !!(product && product.image && product.image.startsWith("http"));
  document.getElementById("image-type-emoji").checked = !isUrl;
  document.getElementById("image-type-url").checked = isUrl;
  updateImagePreview();

  const promo = product && product.promo;
  document.getElementById("product-promo-active").checked = !!(promo && promo.active);
  document.getElementById("product-promo-type").value = promo ? promo.type : "percent";
  document.getElementById("product-promo-value").value = promo ? promo.value : "";
  updatePromoPreview();

  renderVariationsEditor(normalizeVariations(product ? product.variations : []));

  openModal("product-modal");
}

function bindProductModal() {
  document.getElementById("new-product-btn").addEventListener("click", () => openProductModal(null));
  document.getElementById("add-variation-btn").addEventListener("click", () => addVariationRow());
  document.getElementById("product-image").addEventListener("input", updateImagePreview);
  document.getElementById("product-promo-active").addEventListener("change", updatePromoPreview);
  document.getElementById("product-promo-type").addEventListener("change", updatePromoPreview);
  document.getElementById("product-promo-value").addEventListener("input", updatePromoPreview);
  document.getElementById("product-price").addEventListener("input", updatePromoPreview);

  document.getElementById("save-product-btn").addEventListener("click", async () => {
    const id = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const price = parseFloat(document.getElementById("product-price").value);
    if (!name || isNaN(price)) { showToast("Preencha nome e preço corretamente.", "error"); return; }
    const stockRaw = document.getElementById("product-stock").value;
    const minRaw = document.getElementById("product-min-qty").value;
    const maxRaw = document.getElementById("product-max-qty").value;
    const promoActive = document.getElementById("product-promo-active").checked;

    const payload = {
      name,
      description: document.getElementById("product-description").value.trim(),
      price,
      categoryId: document.getElementById("product-category").value,
      image: document.getElementById("product-image").value.trim() || "📦",
      stock: stockRaw === "" ? null : parseInt(stockRaw, 10),
      minQty: minRaw === "" ? 1 : Math.max(1, parseInt(minRaw, 10)),
      maxQty: maxRaw === "" ? null : Math.max(1, parseInt(maxRaw, 10)),
      variations: gatherVariationsFromEditor(),
      featured: document.getElementById("product-featured").checked,
      promo: promoActive
        ? { active: true, type: document.getElementById("product-promo-type").value, value: parseFloat(document.getElementById("product-promo-value").value) || 0 }
        : null,
    };
    if (id) await DB.updateProduct(id, payload);
    else await DB.addProduct(payload);
    await loadAllData();
    await autoBackupIfEnabled();
    renderProductsTable();
    renderDashboard();
    closeModal("product-modal");
    showToast("Produto salvo com sucesso!", "success");
  });
}

/* ---------------- Categorias ---------------- */
function renderCategoriesTable() {
  const tbody = document.getElementById("categories-table-body");
  const sorted = [...ADMIN_STATE.categories].sort((a, b) => a.order - b.order);
  tbody.innerHTML = sorted
    .map((c, idx) => {
      const count = ADMIN_STATE.products.filter((p) => p.categoryId === c.id).length;
      return `<tr data-id="${c.id}">
        <td class="row-actions">
          <button title="Mover para cima" data-move-category="${c.id}:-1" ${idx === 0 ? "disabled" : ""}>▲</button>
          <button title="Mover para baixo" data-move-category="${c.id}:1" ${idx === sorted.length - 1 ? "disabled" : ""}>▼</button>
        </td>
        <td>${escapeHtml(c.icon || "")}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${count} produto(s)</td>
        <td class="row-actions">
          <button title="Editar" data-edit-category="${c.id}">✏️</button>
          <button title="Excluir" data-delete-category="${c.id}">🗑️</button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Nenhuma categoria cadastrada.</td></tr>`;

  tbody.querySelectorAll("[data-edit-category]").forEach((btn) => btn.addEventListener("click", () => openCategoryModal(btn.dataset.editCategory)));
  tbody.querySelectorAll("[data-delete-category]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const inUse = ADMIN_STATE.products.some((p) => p.categoryId === btn.dataset.deleteCategory);
      if (inUse && !confirm("Existem produtos nesta categoria. Excluir mesmo assim? Eles ficarão sem categoria.")) return;
      if (!inUse && !confirm("Excluir esta categoria?")) return;
      await DB.deleteCategory(btn.dataset.deleteCategory);
      await loadAllData();
      await autoBackupIfEnabled();
      renderCategoriesTable();
      renderProductsTable();
      showToast("Categoria excluída.", "success");
    })
  );
  tbody.querySelectorAll("[data-move-category]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const [id, dir] = btn.dataset.moveCategory.split(":");
      moveCategoryOrder(id, parseInt(dir, 10));
    })
  );
}

async function moveCategoryOrder(id, direction) {
  const list = [...ADMIN_STATE.categories].sort((a, b) => a.order - b.order);
  const idx = list.findIndex((c) => c.id === id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return;
  const tmp = list[idx].order;
  list[idx].order = list[swapIdx].order;
  list[swapIdx].order = tmp;
  await DB.saveCategories(list);
  await loadAllData();
  await autoBackupIfEnabled();
  renderCategoriesTable();
}

function openCategoryModal(id) {
  const cat = id ? ADMIN_STATE.categories.find((c) => c.id === id) : null;
  document.getElementById("category-modal-title").textContent = cat ? "Editar categoria" : "Nova categoria";
  document.getElementById("category-id").value = cat ? cat.id : "";
  document.getElementById("category-name").value = cat ? cat.name : "";
  document.getElementById("category-icon").value = cat ? cat.icon || "" : "";
  openModal("category-modal");
}

function bindCategoryModal() {
  document.getElementById("new-category-btn").addEventListener("click", () => openCategoryModal(null));
  document.getElementById("save-category-btn").addEventListener("click", async () => {
    const id = document.getElementById("category-id").value;
    const name = document.getElementById("category-name").value.trim();
    if (!name) { showToast("Digite o nome da categoria.", "error"); return; }
    const payload = { name, icon: document.getElementById("category-icon").value.trim() || "🗂️" };
    if (id) {
      const list = ADMIN_STATE.categories.map((c) => (c.id === id ? { ...c, ...payload } : c));
      await DB.saveCategories(list);
    } else {
      await DB.addCategory(payload);
    }
    await loadAllData();
    await autoBackupIfEnabled();
    renderCategoriesTable();
    closeModal("category-modal");
    showToast("Categoria salva!", "success");
  });
}

/* ---------------- Pedidos ---------------- */
function filteredOrders() {
  const term = ORDERS_FILTER.search.trim().toLowerCase();
  return ADMIN_STATE.orders.filter((o) => {
    const matchStatus = ORDERS_FILTER.status === "todos" || o.status === ORDERS_FILTER.status;
    const matchSearch = !term || o.customer.name.toLowerCase().includes(term) || o.customer.phone.toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById("orders-table-body");
  const list = filteredOrders();
  tbody.innerHTML = list
    .map(
      (o) => `<tr data-id="${o.id}">
        <td>${escapeHtml(o.customer.name)}</td>
        <td>${escapeHtml(o.customer.phone)}</td>
        <td>${o.items.map((i) => `${i.qty}x ${escapeHtml(i.name)}${i.variation ? ` (${escapeHtml(i.variation)})` : ""}`).join("<br>")}</td>
        <td>${formatBRL(o.total)}</td>
        <td>${o.payment.toUpperCase()}</td>
        <td><span class="pill-status ${o.status}">${o.status}</span></td>
        <td>${formatDate(o.date)}</td>
        <td>${orderQuickActionsHTML(o)}</td>
      </tr>`
    )
    .join("") || `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Nenhum pedido encontrado.</td></tr>`;

  bindOrderQuickActions(tbody, () => { renderOrdersTable(); renderDashboard(); });
}

function bindOrdersFilters() {
  document.getElementById("orders-search").addEventListener("input", (e) => {
    ORDERS_FILTER.search = e.target.value;
    renderOrdersTable();
  });
  document.getElementById("orders-status-filter").addEventListener("change", (e) => {
    ORDERS_FILTER.status = e.target.value;
    renderOrdersTable();
  });
  document.getElementById("export-orders-btn").addEventListener("click", exportOrdersCSV);
}

function exportOrdersCSV() {
  const list = filteredOrders();
  if (!list.length) { showToast("Não há pedidos para exportar.", "error"); return; }
  const header = ["Cliente", "Telefone", "Itens", "Total", "Pagamento", "Status", "Data"];
  const rows = list.map((o) => [
    o.customer.name,
    o.customer.phone,
    o.items.map((i) => `${i.qty}x ${i.name}${i.variation ? ` (${i.variation})` : ""}`).join(" | "),
    o.total.toFixed(2).replace(".", ","),
    o.payment,
    o.status,
    formatDate(o.date),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Configurações ---------------- */
function renderConfig() {
  const s = ADMIN_STATE.settings;
  document.getElementById("cfg-store-name").value = s.storeName || "";
  document.getElementById("cfg-whatsapp").value = s.whatsappNumber || "";
  document.getElementById("cfg-support-email").value = s.supportEmail || "leodanialves@gmail.com";
  document.getElementById("cfg-github-repo").value = s.githubRepo || "";
  document.getElementById("cfg-github-expiry").value = s.githubTokenExpiresAt || "";
  document.getElementById("cfg-auto-backup").checked = !!s.autoBackupGithub;
  document.getElementById("cfg-backup-orders").checked = !!s.backupOrdersToGithub;

  const tokenStatusEl = document.getElementById("github-token-status");
  const hasTokenConfigured = s.githubTokenConfigured !== undefined ? s.githubTokenConfigured : !!s.githubToken;
  tokenStatusEl.textContent = hasTokenConfigured ? "🔒 Token já configurado (deixe em branco pra manter o atual)." : "Nenhum token salvo ainda.";

  const labels = { pix: "PIX", credito: "Crédito", debito: "Débito" };
  const methods = s.paymentMethods || SEED_SETTINGS.paymentMethods;
  document.getElementById("payment-config").innerHTML = Object.entries(methods)
    .map(
      ([key, m]) => `
      <div class="field" style="border:1px solid var(--border); border-radius:10px; padding:12px;">
        <label style="display:flex; align-items:center; justify-content:space-between;">
          <span>${labels[key]}</span>
          <input type="checkbox" data-pay-enabled="${key}" ${m.enabled ? "checked" : ""} style="width:auto;" />
        </label>
        <textarea data-pay-details="${key}" placeholder="Detalhes exibidos em 'Ler mais'">${escapeHtml(m.details)}</textarea>
      </div>`
    )
    .join("");

  document.getElementById("save-store-btn").onclick = async () => {
    await DB.saveSettings({
      storeName: document.getElementById("cfg-store-name").value.trim(),
      whatsappNumber: document.getElementById("cfg-whatsapp").value.trim(),
    });
    await loadAllData();
    await autoBackupIfEnabled();
    showToast("Configurações da loja salvas!", "success");
  };

  document.getElementById("save-payments-btn").onclick = async () => {
    const newMethods = {};
    Object.keys(methods).forEach((key) => {
      newMethods[key] = {
        enabled: document.querySelector(`[data-pay-enabled="${key}"]`).checked,
        details: document.querySelector(`[data-pay-details="${key}"]`).value.trim(),
      };
    });
    await DB.saveSettings({ paymentMethods: newMethods });
    await loadAllData();
    await autoBackupIfEnabled();
    showToast("Formas de pagamento salvas!", "success");
  };

  document.getElementById("change-pass-btn").onclick = async () => {
    const current = document.getElementById("cfg-current-pass").value;
    const next = document.getElementById("cfg-new-pass").value;
    if (!next || next.length < 4) { showToast("A nova senha deve ter ao menos 4 caracteres.", "error"); return; }
    try {
      await DB.changePassword(current, next);
      document.getElementById("cfg-current-pass").value = "";
      document.getElementById("cfg-new-pass").value = "";
      showToast("Senha alterada com sucesso!", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  document.getElementById("save-email-btn").onclick = async () => {
    await DB.saveSettings({ supportEmail: document.getElementById("cfg-support-email").value.trim() });
    showToast("E-mail de recuperação salvo!", "success");
  };

  document.getElementById("save-github-btn").onclick = async () => {
    const newToken = document.getElementById("cfg-github-token").value.trim();
    await DB.saveSettings({
      githubRepo: document.getElementById("cfg-github-repo").value.trim(),
      ...(newToken ? { githubToken: newToken } : {}),
      githubTokenExpiresAt: document.getElementById("cfg-github-expiry").value,
      autoBackupGithub: document.getElementById("cfg-auto-backup").checked,
      backupOrdersToGithub: document.getElementById("cfg-backup-orders").checked,
    });
    document.getElementById("cfg-github-token").value = "";
    await loadAllData();
    renderConfig();
    checkGithubTokenExpiry();
    showToast("Configuração do GitHub salva!", "success");
  };

  document.getElementById("publish-github-btn").onclick = () => publishToGithub(true);
}

/* ---------------- Backup automático no GitHub ---------------- */
async function autoBackupIfEnabled() {
  const s = ADMIN_STATE.settings;
  if (!s.autoBackupGithub) return;
  if (!s.githubRepo) return;
  if (!USE_API && !s.githubToken) return; // modo local precisa do token na hora
  try {
    await publishToGithub(false);
  } catch {
    // erros do backup silencioso não interrompem o fluxo do admin
  }
}

/* ---------------- Publicação no GitHub ---------------- */
function checkGithubTokenExpiry() {
  const warningEl = document.getElementById("github-warning");
  const expiry = ADMIN_STATE.settings.githubTokenExpiresAt;
  if (!expiry) { warningEl.classList.add("hidden"); return; }
  const daysLeft = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) {
    warningEl.textContent = daysLeft <= 0
      ? "⚠️ Seu token do GitHub já expirou. Gere um novo token para continuar publicando."
      : `⚠️ Seu token do GitHub expira em ${daysLeft} dia(s). Gere um novo token em breve.`;
    warningEl.classList.remove("hidden");
  } else {
    warningEl.classList.add("hidden");
  }
}

async function githubPutFile(repo, token, path, contentObj, message) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };

  let sha;
  const existing = await fetch(apiUrl, { headers });
  if (existing.ok) { const data = await existing.json(); sha = data.sha; }
  else if (existing.status !== 404) {
    const err = await existing.json().catch(() => ({}));
    throw new Error(err.message || `Falha ao consultar ${path}`);
  }

  const contentStr = JSON.stringify(contentObj, null, 2);
  const contentB64 = btoa(unescape(encodeURIComponent(contentStr)));

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: contentB64, sha }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Falha ao publicar ${path}`);
  }
}

async function publishToGithub(showFeedback) {
  const btn = document.getElementById("publish-github-btn");
  if (showFeedback) { btn.disabled = true; btn.textContent = "Publicando..."; }
  try {
    if (USE_API) {
      const token = JSON.parse(localStorage.getItem("papelaria_admin_session") || "{}").token;
      const r = await fetch(`${CONFIG.API_BASE_URL}/github/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Falha ao publicar.");
    } else {
      const s = ADMIN_STATE.settings;
      if (!s.githubRepo || !s.githubToken) {
        if (showFeedback) showToast("Configure o repositório e o token do GitHub antes de publicar.", "error");
        return;
      }
      const publicSettings = { ...s };
      delete publicSettings.githubToken;
      delete publicSettings.adminPasswordHash;

      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/products.json", ADMIN_STATE.products, "chore: atualizar produtos via painel admin");
      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/categories.json", ADMIN_STATE.categories, "chore: atualizar categorias via painel admin");
      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/settings.json", publicSettings, "chore: atualizar configurações via painel admin");
      if (s.backupOrdersToGithub) {
        await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/orders-backup.json", ADMIN_STATE.orders, "chore: backup de pedidos via painel admin");
      }
    }
    if (showFeedback) showToast("Alterações publicadas no GitHub com sucesso! 🚀", "success");
  } catch (e) {
    if (showFeedback) showToast(`Erro ao publicar: ${e.message}`, "error");
    else throw e;
  } finally {
    if (showFeedback) { btn.disabled = false; btn.textContent = "🚀 Publicar alterações agora"; }
  }
}
