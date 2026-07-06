/* ==========================================================
   CONFIGURAÇÃO GERAL DO SITE
   ==========================================================
   - Enquanto o site estiver hospedado só no GitHub Pages (sem
     servidor), deixe API_BASE_URL = "" para funcionar 100% no
     navegador (localStorage).
   - Quando você hospedar o backend (pasta /backend) em algum
     serviço (Render, Railway, VPS, etc.), coloque a URL aqui,
     ex: "https://sua-api.onrender.com/api"
     O site passa a usar o backend + banco de dados automaticamente.
   ========================================================== */
const CONFIG = {
  API_BASE_URL: "https://ihp-ebf0.onrender.com/api", // "" = modo local (localStorage) | "https://..." = modo backend
  WHATSAPP_NUMBER_FALLBACK: "5500000000000", // usado só se não houver nada salvo ainda
  STORE_NAME: "Papelaria & Impressões",
};
// IMPORTANTE: "const" não vira propriedade de window automaticamente.
// Atribuímos explicitamente para que outros arquivos (db.js, admin.js)
// consigam checar "window.CONFIG" com segurança.
window.CONFIG = CONFIG;
