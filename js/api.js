// ==========================================
// API.JS - Único punto de contacto con el backend
// ------------------------------------------
// El navegador ya NO conoce Supabase: solo llama a /api/... con el
// token JWT que entrega /api/login. Las llaves viven en el servidor.
// ==========================================

// En Vercel el backend vive en el mismo dominio, así que basta "/api".
// Para probar el frontend en local contra un backend distinto, ejecuta
// en la consola: localStorage.setItem('pos_api_base', 'http://localhost:3000/api')
const API_BASE = localStorage.getItem('pos_api_base') || '/api';

const TOKEN_KEY = 'pos_token';   // sessionStorage: se borra al cerrar la pestaña
const ROL_KEY = 'pos_rol';

function guardarSesion(token, rol) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ROL_KEY, rol);
}
function borrarSesion() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROL_KEY);
}
function tokenActual() { return sessionStorage.getItem(TOKEN_KEY); }
function rolActual() { return sessionStorage.getItem(ROL_KEY); }
function esAdmin() { return rolActual() === 'admin'; }

async function apiRequest(path, { method = 'GET', body, silencioso = false } = {}) {
  const token = tokenActual();

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (_) {
    throw new Error('No se pudo contactar el servidor. Revisa tu conexión.');
  }

  // Sesión caída: se vuelve a pedir el PIN
  if (res.status === 401 && !silencioso) {
    borrarSesion();
    if (typeof manejarSesionExpirada === 'function') manejarSesionExpirada();
    throw new Error('Tu sesión expiró. Ingresa el PIN nuevamente.');
  }

  let datos = null;
  try { datos = await res.json(); } catch (_) { datos = null; }

  if (!res.ok) throw new Error((datos && datos.error) || 'Error del servidor');
  return datos;
}

const API = {
  base: API_BASE,

  login: (pin) => apiRequest('/login', { method: 'POST', body: { pin }, silencioso: true }),
  me: () => apiRequest('/me', { silencioso: true }),

  productos: {
    listar: () => apiRequest('/productos'),
    crear: (p) => apiRequest('/productos', { method: 'POST', body: p }),
    actualizar: (id, p) => apiRequest(`/productos/${id}`, { method: 'PUT', body: p }),
    eliminar: (id) => apiRequest(`/productos/${id}`, { method: 'DELETE' }),
    eliminarTodos: () => apiRequest('/productos/todos', { method: 'DELETE' }),
    importar: (productos) => apiRequest('/productos/bulk', { method: 'POST', body: { productos } })
  },

  ventas: {
    listar: (desde, hasta, estado) => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (estado) q.set('estado', estado);
      const cadena = q.toString();
      return apiRequest('/ventas' + (cadena ? `?${cadena}` : ''));
    },
    registrarPago: (id, metodo) => apiRequest(`/ventas/${id}/pago`, { method: 'POST', body: { metodo_pago_final: metodo } }),
    importar: (ventas) => apiRequest('/ventas/importar', { method: 'POST', body: { ventas } }),
    detalle: (id) => apiRequest(`/ventas/${id}`),
    crear: (venta) => apiRequest('/ventas', { method: 'POST', body: venta }),
    actualizar: (id, cambios) => apiRequest(`/ventas/${id}`, { method: 'PUT', body: cambios }),
    eliminar: (id) => apiRequest(`/ventas/${id}`, { method: 'DELETE' }),
    eliminarPeriodo: (desde, hasta) => apiRequest(`/ventas?desde=${desde}&hasta=${hasta}`, { method: 'DELETE' }),
    eliminarTodo: () => apiRequest('/ventas?todo=true', { method: 'DELETE' })
  },

  compras: {
    listar: (filtros = {}) => {
      const q = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) q.set(k, v); });
      const cadena = q.toString();
      return apiRequest('/compras' + (cadena ? `?${cadena}` : ''));
    },
    crear: (c) => apiRequest('/compras', { method: 'POST', body: c }),
    actualizar: (id, c) => apiRequest(`/compras/${id}`, { method: 'PUT', body: c }),
    eliminar: (id) => apiRequest(`/compras/${id}`, { method: 'DELETE' }),
    subirArchivo: (nombre, tipo, base64) => apiRequest('/compras/archivo', { method: 'POST', body: { nombre, tipo, base64 } })
  },

  ot: {
    listar: (estado, buscar) => {
      const q = new URLSearchParams();
      if (estado) q.set('estado', estado);
      if (buscar) q.set('buscar', buscar);
      const cadena = q.toString();
      return apiRequest('/ot' + (cadena ? `?${cadena}` : ''));
    },
    detalle: (id) => apiRequest(`/ot/${id}`),
    crear: (ot) => apiRequest('/ot', { method: 'POST', body: ot }),
    actualizar: (id, ot) => apiRequest(`/ot/${id}`, { method: 'PUT', body: ot }),
    entregar: (id, datos) => apiRequest(`/ot/${id}/entrega`, { method: 'POST', body: datos }),
    eliminar: (id) => apiRequest(`/ot/${id}`, { method: 'DELETE' })
  }
};
