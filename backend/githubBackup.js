/* ==========================================================
   BACKUP AUTOMÁTICO NO GITHUB (debounced)
   Chamado após qualquer alteração em produtos/categorias/config.
   Só age se settings.autoBackupGithub estiver ativo e houver
   repositório + token configurados. Agrupa várias alterações
   seguidas em um único commit (espera alguns segundos de silêncio).
   ========================================================== */

let pendingTimer = null;
const DEBOUNCE_MS = 4000;

async function putFile(repo, token, filePath, contentObj, message) {
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
  const headers = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };

  let sha;
  const existing = await fetch(url, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  } else if (existing.status !== 404) {
    const err = await existing.json().catch(() => ({}));
    throw new Error(err.message || `Falha ao consultar ${filePath}`);
  }

  const contentB64 = Buffer.from(JSON.stringify(contentObj, null, 2), "utf-8").toString("base64");
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: contentB64, sha }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Falha ao publicar ${filePath}`);
  }
}

async function runBackup(readDb) {
  const db = readDb();
  const { githubRepo, githubToken, backupOrdersToGithub } = db.settings;
  if (!githubRepo || !githubToken) return;

  try {
    const publicSettings = { ...db.settings };
    delete publicSettings.githubToken;
    delete publicSettings.adminPasswordHash;

    await putFile(githubRepo, githubToken, "frontend/data/products.json", db.products, "chore: backup automático (produtos)");
    await putFile(githubRepo, githubToken, "frontend/data/categories.json", db.categories, "chore: backup automático (categorias)");
    await putFile(githubRepo, githubToken, "frontend/data/settings.json", publicSettings, "chore: backup automático (config)");
    if (backupOrdersToGithub) {
      await putFile(githubRepo, githubToken, "frontend/data/orders-backup.json", db.orders, "chore: backup automático (pedidos)");
    }
    console.log("✅ Backup automático enviado ao GitHub.");
  } catch (e) {
    console.error("⚠️ Falha no backup automático pro GitHub:", e.message);
  }
}

/** Agenda um backup (debounced) se autoBackupGithub estiver ativo. */
function scheduleBackup(readDb) {
  const db = readDb();
  if (!db.settings.autoBackupGithub) return;
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => runBackup(readDb), DEBOUNCE_MS);
}

module.exports = { scheduleBackup, putFile };
