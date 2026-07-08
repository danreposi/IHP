require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { restoreFromGithubIfNeeded } = require("./githubRestore");

const app = express();

const allowedOrigins = [
  "https://impressoesnahora.com.br",
  "https://www.impressoesnahora.com.br"
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Bloqueado pelo CORS"));
  }
}));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno no servidor." });
});

const PORT = process.env.PORT || 3000;

restoreFromGithubIfNeeded()
  .catch((e) => console.error("⚠️ Falha ao tentar restaurar do GitHub:", e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`✅ Backend da Papelaria rodando em http://localhost:${PORT}`);
      console.log(`   Senha padrão do admin: 1234 (troque no painel após o primeiro login)`);
    });
  });
