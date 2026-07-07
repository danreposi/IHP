const express = require("express");
const { readDb, writeDb } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { scheduleBackup } = require("../githubBackup");

const router = express.Router();

// Nunca devolve o token/senha reais — só um booleano indicando se já
// existe um token salvo, pra o admin saber sem o segredo trafegar de volta.
function toPublicSettings(settings) {
  const { adminPasswordHash, githubToken, ...rest } = settings;
  return { ...rest, githubTokenConfigured: !!githubToken };
}

router.get("/", (req, res) => {
  const db = readDb();
  res.json(toPublicSettings(db.settings));
});

router.patch("/", requireAuth, (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  scheduleBackup(readDb);
  res.json(toPublicSettings(db.settings));
});

module.exports = router;
