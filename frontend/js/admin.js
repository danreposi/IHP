/* ==========================================================
   PAINEL ADMINISTRATIVO
   ========================================================== */

let ADMIN_STATE = {
  categories: [],
  products: [],
  orders: [],
  settings: {},
  stats: {},
};

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}
function formatBRL(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatDate(iso) { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function openModal(id) { document.getElementById(id).classList.add("open"); document.getElementById("overlay").classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); document.getElementById("overlay").classList.remove("open"); }

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

/* ---------------- Dashboard ---------------- */
function renderDashboard() {
  const orders = ADMIN_STATE.orders;
  const completed = orders.filter((o) => o.status === "concluido");
  const cancelled = orders.filter((o) => o.status === "cancelado");
  const revenue = completed.reduce((s, o) => s + o.total, 0);

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
    { label: "Produto mais vendido", value: topSelling ? topSelling[0] : "—" },
    { label: "Produto mais visualizado", value: topViewed ? topViewed[0] : "—" },
    { label: "Pagamento mais usado", value: topPayment ? topPayment[0].toUpperCase() : "—" },
    { label: "Produtos com estoque baixo", value: lowStock },
  ];
  document.getElementById("stat-grid").innerHTML = stats
    .map((s) => `<div class="stat-card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`)
    .join("");

  const tbody = document.querySelector("#recent-orders-table tbody");
  tbody.innerHTML = orders
    .slice(0, 8)
    .map(
      (o) => `<tr>
        <td>${o.customer.name}</td>
        <td>${o.items.reduce((s, i) => s + i.qty, 0)} item(ns)</td>
        <td>${formatBRL(o.total)}</td>
        <td>${o.payment.toUpperCase()}</td>
        <td><span class="pill-status ${o.status}">${o.status}</span></td>
        <td>${formatDate(o.date)}</td>
      </tr>`
    )
    .join("") || `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum pedido ainda.</td></tr>`;
}

/* ---------------- Produtos ---------------- */
function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  tbody.innerHTML = ADMIN_STATE.products
    .map((p, idx) => {
      const cat = ADMIN_STATE.categories.find((c) => c.id === p.categoryId);
      return `<tr data-id="${p.id}">
        <td class="drag-handle">⠿</td>
        <td>${p.image && p.image.startsWith("http") ? "🖼️" : p.image || "📦"} ${p.name}</td>
        <td>${cat ? cat.name : "—"}</td>
        <td>${formatBRL(p.price)}</td>
        <td>${typeof p.stock === "number" ? p.stock : "—"}</td>
        <td>${p.featured ? "⭐" : ""}</td>
        <td>${p.views || 0}</td>
        <td class="row-actions">
          <button title="Editar" data-edit-product="${p.id}">✏️</button>
          <button title="Excluir" data-delete-product="${p.id}">🗑️</button>
        </td>
      </tr>`;
    })
    .join("") || `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Nenhum produto cadastrado.</td></tr>`;

  tbody.querySelectorAll("[data-edit-product]").forEach((btn) => btn.addEventListener("click", () => openProductModal(btn.dataset.editProduct)));
  tbody.querySelectorAll("[data-delete-product]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este produto?")) return;
      await DB.deleteProduct(btn.dataset.deleteProduct);
      await loadAllData();
      renderProductsTable();
      renderDashboard();
      showToast("Produto excluído.", "success");
    })
  );
}

function fillCategorySelect() {
  const select = document.getElementById("product-category");
  select.innerHTML = ADMIN_STATE.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
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
  document.getElementById("product-variations").value = product && product.variations ? product.variations.join(", ") : "";
  document.getElementById("product-featured").checked = product ? !!product.featured : false;
  openModal("product-modal");
}

function bindProductModal() {
  document.getElementById("new-product-btn").addEventListener("click", () => openProductModal(null));
  document.getElementById("save-product-btn").addEventListener("click", async () => {
    const id = document.getElementById("product-id").value;
    const name = document.getElementById("product-name").value.trim();
    const price = parseFloat(document.getElementById("product-price").value);
    if (!name || isNaN(price)) { showToast("Preencha nome e preço corretamente.", "error"); return; }
    const stockRaw = document.getElementById("product-stock").value;
    const payload = {
      name,
      description: document.getElementById("product-description").value.trim(),
      price,
      categoryId: document.getElementById("product-category").value,
      image: document.getElementById("product-image").value.trim() || "📦",
      stock: stockRaw === "" ? null : parseInt(stockRaw, 10),
      variations: document.getElementById("product-variations").value.split(",").map((v) => v.trim()).filter(Boolean),
      featured: document.getElementById("product-featured").checked,
    };
    if (id) await DB.updateProduct(id, payload);
    else await DB.addProduct(payload);
    await loadAllData();
    renderProductsTable();
    renderDashboard();
    closeModal("product-modal");
    showToast("Produto salvo com sucesso!", "success");
  });
}

/* ---------------- Categorias ---------------- */
function renderCategoriesTable() {
  const tbody = document.getElementById("categories-table-body");
  tbody.innerHTML = ADMIN_STATE.categories
    .map((c) => {
      const count = ADMIN_STATE.products.filter((p) => p.categoryId === c.id).length;
      return `<tr data-id="${c.id}">
        <td class="drag-handle">⠿</td>
        <td>${c.icon || ""}</td>
        <td>${c.name}</td>
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
      if (inUse && !confirm("Existem produtos nesta categoria. Excluir mesmo assim?")) return;
      if (!inUse && !confirm("Excluir esta categoria?")) return;
      await DB.deleteCategory(btn.dataset.deleteCategory);
      await loadAllData();
      renderCategoriesTable();
      showToast("Categoria excluída.", "success");
    })
  );
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
    renderCategoriesTable();
    closeModal("category-modal");
    showToast("Categoria salva!", "success");
  });
}

/* ---------------- Pedidos ---------------- */
function renderOrdersTable() {
  const tbody = document.getElementById("orders-table-body");
  tbody.innerHTML = ADMIN_STATE.orders
    .map(
      (o) => `<tr data-id="${o.id}">
        <td>${o.customer.name}</td>
        <td>${o.customer.phone}</td>
        <td>${o.items.map((i) => `${i.qty}x ${i.name}${i.variation ? ` (${i.variation})` : ""}`).join("<br>")}</td>
        <td>${formatBRL(o.total)}</td>
        <td>${o.payment.toUpperCase()}</td>
        <td>
          <select class="status-select" data-status-for="${o.id}">
            <option value="pendente" ${o.status === "pendente" ? "selected" : ""}>Pendente</option>
            <option value="concluido" ${o.status === "concluido" ? "selected" : ""}>Concluído</option>
            <option value="cancelado" ${o.status === "cancelado" ? "selected" : ""}>Cancelado</option>
          </select>
        </td>
        <td>${formatDate(o.date)}</td>
        <td></td>
      </tr>`
    )
    .join("") || `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Nenhum pedido ainda.</td></tr>`;

  tbody.querySelectorAll("[data-status-for]").forEach((select) => {
    select.addEventListener("change", async () => {
      await DB.updateOrderStatus(select.dataset.statusFor, select.value);
      await loadAllData();
      renderDashboard();
      showToast("Status do pedido atualizado.", "success");
    });
  });
}

/* ---------------- Configurações ---------------- */
function renderConfig() {
  const s = ADMIN_STATE.settings;
  document.getElementById("cfg-store-name").value = s.storeName || "";
  document.getElementById("cfg-whatsapp").value = s.whatsappNumber || "";
  document.getElementById("cfg-support-email").value = s.supportEmail || "leodanialves@gmail.com";
  document.getElementById("cfg-github-repo").value = s.githubRepo || "";
  document.getElementById("cfg-github-expiry").value = s.githubTokenExpiresAt || "";

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
        <textarea data-pay-details="${key}" placeholder="Detalhes exibidos em 'Ler mais'">${m.details}</textarea>
      </div>`
    )
    .join("");

  document.getElementById("save-store-btn").onclick = async () => {
    await DB.saveSettings({
      storeName: document.getElementById("cfg-store-name").value.trim(),
      whatsappNumber: document.getElementById("cfg-whatsapp").value.trim(),
    });
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
    await DB.saveSettings({
      githubRepo: document.getElementById("cfg-github-repo").value.trim(),
      githubToken: document.getElementById("cfg-github-token").value.trim() || ADMIN_STATE.settings.githubToken,
      githubTokenExpiresAt: document.getElementById("cfg-github-expiry").value,
    });
    await loadAllData();
    checkGithubTokenExpiry();
    showToast("Configuração do GitHub salva!", "success");
  };

  document.getElementById("publish-github-btn").onclick = publishToGithub;
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

async function publishToGithub() {
  const btn = document.getElementById("publish-github-btn");
  btn.disabled = true;
  btn.textContent = "Publicando...";
  try {
    if (window.CONFIG && CONFIG.API_BASE_URL) {
      const token = JSON.parse(localStorage.getItem("papelaria_admin_session") || "{}").token;
      const r = await fetch(`${CONFIG.API_BASE_URL}/github/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Falha ao publicar.");
    } else {
      const s = ADMIN_STATE.settings;
      if (!s.githubRepo || !s.githubToken) {
        showToast("Configure o repositório e o token do GitHub antes de publicar.", "error");
        return;
      }
      const publicSettings = { ...s };
      delete publicSettings.githubToken;

      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/products.json", ADMIN_STATE.products, "chore: atualizar produtos via painel admin");
      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/categories.json", ADMIN_STATE.categories, "chore: atualizar categorias via painel admin");
      await githubPutFile(s.githubRepo, s.githubToken, "frontend/data/settings.json", publicSettings, "chore: atualizar configurações via painel admin");
    }
    showToast("Alterações publicadas no GitHub com sucesso! 🚀", "success");
  } catch (e) {
    showToast(`Erro ao publicar: ${e.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Publicar alterações agora";
  }
}
