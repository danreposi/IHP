const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const db = readDb();
  const { adminPasswordHash, githubToken, ...publicSettings } = db.settings;
  res.json(publicSettings);
});

router.patch("/", requireAuth, (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  const { adminPasswordHash, githubToken, ...publicSettings } = db.settings;
  res.json(publicSettings);
});

module.exports = router;
