const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { scheduleBackup } = require("../githubBackup");

const router = express.Router();

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

router.get("/", (req, res) => {
  const db = readDb();
  res.json(db.products.sort((a, b) => a.order - b.order));
});

router.put("/", requireAuth, (req, res) => {
  const db = readDb();
  db.products = req.body;
  writeDb(db);
  scheduleBackup(readDb);
  res.json(db.products);
});

router.post("/", requireAuth, (req, res) => {
  const db = readDb();
  const newProd = { id: uid("prod"), views: 0, order: db.products.length, ...req.body };
  db.products.push(newProd);
  writeDb(db);
  scheduleBackup(readDb);
  res.status(201).json(newProd);
});

router.patch("/:id", requireAuth, (req, res) => {
  const db = readDb();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Produto não encontrado." });
  db.products[idx] = { ...db.products[idx], ...req.body };
  writeDb(db);
  scheduleBackup(readDb);
  res.json(db.products[idx]);
});

router.delete("/:id", requireAuth, (req, res) => {
  const db = readDb();
  db.products = db.products.filter((p) => p.id !== req.params.id);
  writeDb(db);
  scheduleBackup(readDb);
  res.status(204).end();
});

// registra visualização de produto (rota pública, usada pela loja)
router.post("/:id/view", (req, res) => {
  const db = readDb();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx >= 0) {
    db.products[idx].views = (db.products[idx].views || 0) + 1;
    writeDb(db);
    // não agenda backup aqui: visualização não é uma mudança de catálogo,
    // e isso evitaria disparar um commit a cada clique de cliente
  }
  res.status(204).end();
});

module.exports = router;
