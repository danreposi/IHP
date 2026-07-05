const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

router.get("/", (req, res) => {
  const db = readDb();
  res.json(db.categories.sort((a, b) => a.order - b.order));
});

router.put("/", requireAuth, (req, res) => {
  const db = readDb();
  db.categories = req.body;
  writeDb(db);
  res.json(db.categories);
});

router.post("/", requireAuth, (req, res) => {
  const db = readDb();
  const newCat = { id: uid("cat"), order: db.categories.length, ...req.body };
  db.categories.push(newCat);
  writeDb(db);
  res.status(201).json(newCat);
});

router.delete("/:id", requireAuth, (req, res) => {
  const db = readDb();
  db.categories = db.categories.filter((c) => c.id !== req.params.id);
  writeDb(db);
  res.status(204).end();
});

module.exports = router;
