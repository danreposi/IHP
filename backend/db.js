/* ==========================================================
   BANCO DE DADOS (arquivo JSON local em /backend/data/db.json)
   Simples, sem dependências nativas — fácil de rodar em qualquer
   hospedagem (Render, Railway, VPS, etc). Pode futuramente ser
   trocado por Postgres/Mongo mantendo a mesma interface (get/save).
   ========================================================== */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(__dirname, "data", "db.json");

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, usedSalt, 64).toString("hex");
  return `${usedSalt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

const SEED = {
  categories: [
    { id: "cat-impressoes", name: "Impressões", icon: "🖨️", order: 0 },
    { id: "cat-papelaria", name: "Papelaria", icon: "📓", order: 1 },
    { id: "cat-materiais", name: "Materiais", icon: "✏️", order: 2 },
  ],
  products: [
    { id: "prod-impressao", name: "Impressão de Documento", description: "Impressão avulsa por folha A4.", price: 0.5, categoryId: "cat-impressoes", image: "🖨️", variations: ["Preto e Branco", "Colorida", "Fotográfica"], stock: null, featured: true, views: 0, order: 0 },
    { id: "prod-bloco-notas", name: "Bloco de Notas", description: "Bloco de notas 80 folhas, capa resistente.", price: 12.9, categoryId: "cat-papelaria", image: "📓", variations: ["Pautado", "Pontilhado", "Quadriculado"], stock: 24, featured: true, views: 0, order: 1 },
    { id: "prod-caneta", name: "Caneta Esferográfica", description: "Escrita macia, ponta 1.0mm.", price: 2.9, categoryId: "cat-materiais", image: "🖊️", variations: ["Azul", "Preta", "Vermelha"], stock: 50, featured: true, views: 0, order: 2 },
  ],
  orders: [],
  settings: {
    storeName: "Papelaria & Impressões",
    whatsappNumber: "",
    adminPasswordHash: hashPassword("1234"),
    paymentMethods: {
      pix: { enabled: true, details: "A chave PIX será enviada pelo WhatsApp após a confirmação do pedido." },
      credito: { enabled: true, details: "Pagamento realizado presencialmente na maquininha, na retirada." },
      debito: { enabled: true, details: "Pagamento realizado presencialmente na maquininha, na retirada." },
    },
    githubToken: "",
    githubRepo: "",
    githubTokenExpiresAt: "",
    supportEmail: "leodanialves@gmail.com",
  },
  stats: { visits: 0 },
};

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(SEED, null, 2));
}

function readDb() {
  ensureDbFile();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb, hashPassword, verifyPassword };
