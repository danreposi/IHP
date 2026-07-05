require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "papelaria-backend" }));

app.use("/api/categories", require("./routes/categories"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/github", require("./routes/github"));

app.use((req, res) => res.status(404).json({ message: "Rota não encontrada." }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno no servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend da Papelaria rodando em http://localhost:${PORT}`);
  console.log(`   Senha padrão do admin: 1234 (troque no painel após o primeiro login)`);
});
