/* ==========================================================
   TEMA: Claro / Escuro / Padrão do Sistema
   Detecta o tema do dispositivo (prefers-color-scheme) e salva
   a preferência do usuário em localStorage.
   ========================================================== */

const THEME_KEY = "papelaria_theme"; // "light" | "dark" | "system"

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref) {
  const resolved = pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", resolved);
}

function getThemePreference() {
  return localStorage.getItem(THEME_KEY) || "system";
}

function setThemePreference(pref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
  document.querySelectorAll("[data-theme-option]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeOption === pref);
  });
}

// aplica imediatamente (antes do resto carregar) para evitar "flash" de tema errado
applyTheme(getThemePreference());

// escuta mudança do tema do sistema em tempo real, se o usuário estiver no modo "system"
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "system") applyTheme("system");
  });
}

function initThemeMenu() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const menu = document.getElementById("theme-menu");
  if (!toggleBtn || !menu) return;

  document.querySelectorAll("[data-theme-option]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeOption === getThemePreference());
    btn.addEventListener("click", () => {
      setThemePreference(btn.dataset.themeOption);
      menu.classList.remove("open");
    });
  });

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));
}

document.addEventListener("DOMContentLoaded", initThemeMenu);
