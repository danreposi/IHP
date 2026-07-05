const express = require("express");
const { readDb, writeDb } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const db = readDb();
  res.json(db.stats);
});

router.post("/visit", (req, res) => {
  const db = readDb();
  db.stats.visits = (db.stats.visits || 0) + 1;
  writeDb(db);
  res.status(204).end();
});

module.exports = router;
