const express = require("express");
const { readDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { putFile } = require("../githubBackup");

const router = express.Router();

router.post("/publish", requireAuth, async (req, res) => {
  const db = readDb();
  const { githubRepo, githubToken, backupOrdersToGithub } = db.settings;
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
    if (backupOrdersToGithub) {
      await putFile(githubRepo, githubToken, "frontend/data/orders-backup.json", db.orders, "chore: backup de pedidos via painel admin");
    }

    res.json({ message: "Publicado com sucesso." });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
