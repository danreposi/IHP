const express = require("express");
const { readDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

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

router.post("/publish", requireAuth, async (req, res) => {
  const db = readDb();
  const { githubRepo, githubToken } = db.settings;
  if (!githubRepo || !githubToken) {
    return res.status(400).json({ message: "Configure o repositório e o token do GitHub antes de publicar." });
  }
  try {
    const publicSettings = { ...db.settings };
    delete publicSettings.githubToken;
    delete publicSettings.adminPasswordHash;

    await putFile(githubRepo, githubToken, "frontend/data/products.json", db.products, "chore: atualizar produtos via painel admin");
    await putFile(githubRepo, githubToken, "frontend/data/categories.json", db.categories, "chore: atualizar categorias via painel admin");
    await putFile(githubRepo, githubToken, "frontend/data/settings.json", publicSettings, "chore: atualizar configurações via painel admin");

    res.json({ message: "Publicado com sucesso." });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
