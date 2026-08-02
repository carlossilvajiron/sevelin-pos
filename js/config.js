/* ============================================================
   CONFIG.JS - Utilidades globales y arranque de la interfaz
   ------------------------------------------------------------
   IMPORTANTE: aquí ya NO hay URL ni llaves de Supabase. Toda la
   comunicación con la base de datos pasa por el backend (api.js →
   /api/...), que es el único que conoce las credenciales.
   ============================================================ */

var NEGOCIO_NOMBRE = 'Sevelin'; // el backend puede sobrescribirlo al iniciar sesión

function setSyncBadge(type, msg) {
  const el = document.getElementById('syncBadge');
  if (el) {
    el.className = 'sync-badge sync-' + type;
    el.textContent = msg;
  }
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function fmtCLP(v) {
  v = Number(v) || 0;
  return '$' + v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/* ------------------------------------------------------------
   FECHAS EN HORA LOCAL
   toISOString() convierte a UTC: en Chile, después de las 20:00 la
   fecha saltaba al día siguiente. isoLocal() usa la fecha local real.
   ------------------------------------------------------------ */
function isoLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function todayISO() { return isoLocal(new Date()); }

function horaActualCorta() {
  // Formato 24 h ("19:14"), que es el que usa el ticket y el historial
  return new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ---------- Tema claro / oscuro ---------- */
function aplicarTema(tema) {
  const esClaro = tema === 'light';
  document.body.classList.toggle('theme-light', esClaro);
  const btn = document.getElementById('btnTema');
  if (btn) {
    btn.textContent = esClaro ? '☀️' : '🌙';
    btn.title = esClaro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
  }
  localStorage.setItem('sevelin_tema', esClaro ? 'light' : 'dark');
}

function initTema() {
  aplicarTema(localStorage.getItem('sevelin_tema') || 'dark');
  const btn = document.getElementById('btnTema');
  if (btn) btn.addEventListener('click', () => {
    aplicarTema(document.body.classList.contains('theme-light') ? 'dark' : 'light');
  });
}

/* ---------- Comprobación del backend ---------- */
async function verificarBackend() {
  try {
    const res = await fetch(API.base + '/health');
    if (!res.ok) throw new Error();
    setSyncBadge('ok', '🟢 Servidor conectado');
  } catch (_) {
    setSyncBadge('bad', '🔴 Sin conexión al servidor');
  }
}

/* ---------- Navegación entre vistas ---------- */
function initNavegacion() {
  document.querySelectorAll('.nav-links .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = btn.getAttribute('data-view');
      const targetView = document.getElementById(viewId);
      if (!targetView) return;

      // Un trabajador no puede abrir vistas marcadas como admin-only
      if (targetView.classList.contains('admin-only') && !esAdmin()) {
        showToast('Solo el administrador puede ver esta sección', 'err');
        return;
      }

      document.querySelectorAll('.nav-links .nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      targetView.classList.add('active');

      if (viewId === 'view-historial' && typeof cargarHistorial === 'function') cargarHistorial();
      if (viewId === 'view-productos' && typeof cargarProductos === 'function') cargarProductos();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTema();
  initNavegacion();
  verificarBackend();
});

/* Los datos se cargan recién cuando hay sesión válida (evento de auth.js) */
document.addEventListener('pos:sesion-iniciada', () => {
  if (typeof cargarProductos === 'function') cargarProductos();
  if (typeof cargarHistorial === 'function') cargarHistorial();
});
