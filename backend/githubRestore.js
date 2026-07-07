/* ==========================================================
   RESTAURAÇÃO AUTOMÁTICA A PARTIR DO GITHUB
   Resolve o problema de hospedagens gratuitas (ex: Render free tier)
   que apagam o disco a cada reinício: se o banco de dados local não
   existir (servidor "do zero"), tentamos restaurar o último backup
   publicado no GitHub (frontend/data/*.json) antes de criar os dados
   de exemplo padrão.

   Configuração (opcional, em variáveis de ambiente):
     GITHUB_BACKUP_REPO=usuario/repositorio
     GITHUB_BACKUP_BRANCH=main   (opcional, padrão "main")

   Não precisa de token se o repositório for público (lemos os
   arquivos "crus" via raw.githubusercontent.com).
   ========================================================== */

const fs = require("fs");
const path = require("path");
const { DB_FILE, SEED, hashPassword } = require("./db");

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function restoreFromGithubIfNeeded() {
  if (fs.existsSync(DB_FILE)) return; // já existe um banco local, nada a fazer

  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!repo) return; // sem configuração — o db.js cria o seed padrão normalmente

  const branch = process.env.GITHUB_BACKUP_BRANCH || "main";
  const base = `https://raw.githubusercontent.com/${repo}/${branch}/frontend/data`;

  console.log(`🔄 Nenhum banco local encontrado — tentando restaurar de ${repo}@${branch}...`);

  const [categories, products, settings] = await Promise.all([
    fetchJsonSafe(`${base}/categories.json`),
    fetchJsonSafe(`${base}/products.json`),
    fetchJsonSafe(`${base}/settings.json`),
  ]);

  if (!categories && !products) {
    console.log("⚠️ Nenhum backup encontrado no GitHub ainda — usando dados de exemplo padrão.");
    return;
  }

  const mergedSettings = { ...SEED.settings, ...(settings || {}) };
  if (!mergedSettings.adminPasswordHash) mergedSettings.adminPasswordHash = hashPassword("1234");

  const merged = {
    categories: categories || SEED.categories,
    products: products || SEED.products,
    orders: [], // pedidos não são restaurados por padrão (dados de clientes)
    settings: mergedSettings,
    stats: { visits: 0 },
  };

  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2));
  console.log(`✅ Catálogo restaurado automaticamente do GitHub (${repo}@${branch}).`);
}

module.exports = { restoreFromGithubIfNeeded };
