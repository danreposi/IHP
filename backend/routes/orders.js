const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { scheduleBackup } = require("../githubBackup");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const db = readDb();
  res.json(db.orders.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// criação de pedido é pública (o cliente faz isso na loja, sem login)
router.post("/", (req, res) => {
  const db = readDb();
  const order = { status: "pendente", date: new Date().toISOString(), ...req.body };
  db.orders.push(order);
  writeDb(db);
  scheduleBackup(readDb); // só age de fato se autoBackupGithub + backupOrdersToGithub estiverem ligados
  res.status(201).json(order);
});

router.patch("/:id", requireAuth, (req, res) => {
  const db = readDb();
  const idx = db.orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Pedido não encontrado." });
  db.orders[idx] = { ...db.orders[idx], ...req.body };
  writeDb(db);
  scheduleBackup(readDb);
  res.json(db.orders[idx]);
});

module.exports = router;
