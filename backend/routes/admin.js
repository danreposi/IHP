const express = require("express");
const jwt = require("jsonwebtoken");
const { readDb, writeDb, hashPassword, verifyPassword } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body;
  const db = readDb();
  if (!verifyPassword(password || "", db.settings.adminPasswordHash)) {
    return res.status(401).json({ message: "Senha incorreta." });
  }
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "8h" });
  res.json({ token });
});

router.post("/password", requireAuth, (req, res) => {
  const { current, next } = req.body;
  const db = readDb();
  if (!verifyPassword(current || "", db.settings.adminPasswordHash)) {
    return res.status(400).json({ message: "Senha atual incorreta." });
  }
  if (!next || next.length < 4) {
    return res.status(400).json({ message: "A nova senha deve ter ao menos 4 caracteres." });
  }
  db.settings.adminPasswordHash = hashPassword(next);
  writeDb(db);
  res.status(204).end();
});

module.exports = router;
