/* ============================================================
   SEVELIN POS — BACKEND (Express sobre funciones serverless de Vercel)
   ------------------------------------------------------------
   Las llaves de Supabase viven SOLO aquí (variables de entorno).
   El navegador nunca las ve: habla con estos endpoints usando un JWT.

   Variables de entorno necesarias (Vercel → Settings → Environment Variables):
     SUPABASE_URL              https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY eyJhbGciOi...   (¡secreta! nunca al frontend)
     JWT_SECRET                cadena larga y aleatoria
     ADMIN_PIN                 9067
     WORKER_PIN                0495
     CORS_ORIGINS              https://tu-pos.vercel.app,http://localhost:5500
     NEGOCIO_NOMBRE            Sevelin            (opcional)
   ============================================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();

/* ---------- Configuración ---------- */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  ADMIN_PIN = '9067',
  WORKER_PIN = '0495',
  CORS_ORIGINS = '*',
  NEGOCIO_NOMBRE = 'Sevelin'
} = process.env;

const TOKEN_TTL = '12h';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[POS] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}
if (!JWT_SECRET) {
  console.warn('[POS] Falta JWT_SECRET: define uno largo y aleatorio en producción.');
}

// El cliente service_role omite RLS, por eso solo puede existir en el servidor.
const db = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_SERVICE_ROLE_KEY || 'sin-key', {
  auth: { persistSession: false, autoRefreshToken: false }
});

/* ---------- Middlewares base ---------- */
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '2mb' }));

const origenesPermitidos = CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Permite herramientas sin Origin (curl, Postman) y el mismo dominio de Vercel
    if (!origin || origenesPermitidos.includes('*') || origenesPermitidos.includes(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

/* ---------- Utilidades ---------- */
const num = v => Number(v) || 0;
const enviarError = (res, code, msg) => res.status(code).json({ error: msg });

function firmarToken(rol) {
  return jwt.sign({ rol }, JWT_SECRET || 'dev-secret-cambiar', { expiresIn: TOKEN_TTL });
}

// Autenticación por JWT. requiereAdmin = true bloquea a los trabajadores.
function auth(requiereAdmin = false) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return enviarError(res, 401, 'Falta el token de sesión');

    try {
      req.usuario = jwt.verify(token, JWT_SECRET || 'dev-secret-cambiar');
    } catch (_) {
      return enviarError(res, 401, 'Sesión inválida o expirada');
    }
    if (requiereAdmin && req.usuario.rol !== 'admin') {
      return enviarError(res, 403, 'Esta acción es solo para el administrador');
    }
    next();
  };
}

// Los trabajadores nunca reciben costos ni utilidades: se limpian en el servidor.
function limpiarParaRol(fila, rol) {
  if (!fila || rol === 'admin') return fila;
  const { costo_total, utilidad, costo_unitario, ...visible } = fila;
  return visible;
}
const limpiarLista = (filas, rol) => (filas || []).map(f => limpiarParaRol(f, rol));

/* Intentos de PIN fallidos por IP (memoria del proceso; en serverless es por
   instancia, suficiente como freno básico ante fuerza bruta). */
const intentos = new Map();
function frenoLogin(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.ip || 'anon';
  const ahora = Date.now();
  const reg = intentos.get(ip) || { n: 0, hasta: 0 };

  if (reg.hasta > ahora) {
    return enviarError(res, 429, 'Demasiados intentos. Espera un minuto.');
  }
  if (ahora - (reg.ts || 0) > 10 * 60 * 1000) reg.n = 0;

  reg.ts = ahora;
  req._registroIntento = { ip, reg };
  intentos.set(ip, reg);
  next();
}

/* ============================================================
   SESIÓN
   ============================================================ */
app.post('/api/login', frenoLogin, (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  const { ip, reg } = req._registroIntento || {};

  let rol = null;
  if (pin && pin === String(ADMIN_PIN)) rol = 'admin';
  else if (pin && pin === String(WORKER_PIN)) rol = 'trabajador';

  if (!rol) {
    if (reg) {
      reg.n += 1;
      if (reg.n >= 5) { reg.hasta = Date.now() + 60 * 1000; reg.n = 0; }
      intentos.set(ip, reg);
    }
    return enviarError(res, 401, 'PIN incorrecto');
  }

  if (reg) { reg.n = 0; intentos.set(ip, reg); }
  res.json({ token: firmarToken(rol), rol, negocio: NEGOCIO_NOMBRE, expiraEn: TOKEN_TTL });
});

// Permite al frontend saber si el token guardado sigue siendo válido
app.get('/api/me', auth(), (req, res) => {
  res.json({ rol: req.usuario.rol, negocio: NEGOCIO_NOMBRE });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, servicio: 'sevelin-pos-api' }));

/* ============================================================
   PRODUCTOS
   Lectura: admin y trabajador · Escritura: solo admin
   ============================================================ */
const CAMPOS_PRODUCTO = [
  'sku', 'codigo_barras', 'nombre', 'costo_unitario', 'precio_unitario', 'stock',
  'requiere_sn', 'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm', 'descripcion'
];

function sanearProducto(body = {}) {
  const p = {};
  CAMPOS_PRODUCTO.forEach(k => { if (body[k] !== undefined) p[k] = body[k]; });

  if (!p.nombre || !String(p.nombre).trim()) return null;
  p.nombre = String(p.nombre).trim();
  ['costo_unitario', 'precio_unitario', 'stock', 'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm']
    .forEach(k => { if (p[k] !== undefined) p[k] = num(p[k]); });
  p.requiere_sn = !!p.requiere_sn;
  ['sku', 'codigo_barras', 'descripcion'].forEach(k => {
    if (p[k] !== undefined) p[k] = String(p[k]).trim() || null;
  });
  return p;
}

app.get('/api/productos', auth(), async (req, res) => {
  const { data, error } = await db.from('productos').select('*').order('nombre', { ascending: true });
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

app.post('/api/productos', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  const { data, error } = await db.from('productos').insert([producto]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

// Importación masiva (CSV / Excel de Tiendanube)
app.post('/api/productos/bulk', auth(true), async (req, res) => {
  const lista = Array.isArray(req.body?.productos) ? req.body.productos : [];
  const productos = lista.map(sanearProducto).filter(Boolean);
  if (productos.length === 0) return enviarError(res, 400, 'No hay productos válidos para importar');

  const { error } = await db.from('productos').insert(productos);
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json({ importados: productos.length });
});

app.put('/api/productos/:id', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  const { data, error } = await db.from('productos').update(producto).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

app.delete('/api/productos/:id', auth(true), async (req, res) => {
  if (req.params.id === 'todos') {
    const { error } = await db.from('productos').delete().gt('id', 0);
    if (error) return enviarError(res, 500, error.message);
    return res.json({ ok: true, alcance: 'todos' });
  }
  const { error } = await db.from('productos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   VENTAS
   Ver y registrar: admin y trabajador
   Editar y eliminar: solo admin
   ============================================================ */

// Los totales SIEMPRE se calculan en el servidor a partir de los ítems.
async function normalizarItems(items, rolSolicitante) {
  const lista = Array.isArray(items) ? items : [];
  if (lista.length === 0) throw new Error('La venta no tiene productos');

  // Para trabajadores el costo lo pone el catálogo, no el navegador
  let costosCatalogo = {};
  const ids = [...new Set(lista.map(i => i.producto_id).filter(Boolean))];
  if (ids.length) {
    const { data } = await db.from('productos').select('id, costo_unitario').in('id', ids);
    (data || []).forEach(p => { costosCatalogo[p.id] = num(p.costo_unitario); });
  }

  return lista.map(it => {
    const cantidad = Math.max(1, Math.round(num(it.cantidad) || 1));
    const precio = num(it.precio_unitario);
    const costoCliente = num(it.costo_unitario);
    const costoCatalogo = it.producto_id ? (costosCatalogo[it.producto_id] || 0) : 0;
    const costo = rolSolicitante === 'admin' ? costoCliente : (costoCatalogo || costoCliente);

    return {
      producto_id: it.producto_id || null,
      sku: it.sku || null,
      nombre: String(it.nombre || 'Producto').trim(),
      cantidad,
      costo_unitario: costo,
      precio_unitario: precio,
      subtotal: precio * cantidad,
      serial_number: it.serial_number || null
    };
  });
}

function totalizar(items) {
  const total = items.reduce((a, i) => a + i.subtotal, 0);
  const costoTotal = items.reduce((a, i) => a + i.costo_unitario * i.cantidad, 0);
  return { total, costo_total: costoTotal, utilidad: total - costoTotal };
}

app.get('/api/ventas', auth(), async (req, res) => {
  const { desde, hasta } = req.query;
  let q = db.from('ventas').select('*').order('id', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

// Detalle: venta + ítems (el ticket lo necesita para reimprimir)
app.get('/api/ventas/:id', auth(), async (req, res) => {
  const { data: venta, error } = await db.from('ventas').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Venta no encontrada');

  const { data: items, error: errItems } = await db.from('venta_items').select('*').eq('venta_id', req.params.id).order('id');
  if (errItems) return enviarError(res, 500, errItems.message);

  res.json({
    ...limpiarParaRol(venta, req.usuario.rol),
    items: limpiarLista(items, req.usuario.rol)
  });
});

app.post('/api/ventas', auth(), async (req, res) => {
  try {
    const items = await normalizarItems(req.body?.items, req.usuario.rol);
    const totales = totalizar(items);

    const cabecera = {
      fecha: req.body?.fecha || new Date().toISOString().slice(0, 10),
      hora: req.body?.hora || null,
      cliente: (req.body?.cliente || '').trim() || null,
      metodo_pago: req.body?.metodo_pago || 'Efectivo',
      ...totales,
      impreso: false
    };

    const { data: venta, error } = await db.from('ventas').insert([cabecera]).select().single();
    if (error) throw new Error(error.message);

    const { error: errItems } = await db.from('venta_items')
      .insert(items.map(i => ({ ...i, venta_id: venta.id })));

    if (errItems) {
      // Evita dejar una venta huérfana si falla el detalle
      await db.from('ventas').delete().eq('id', venta.id);
      throw new Error(errItems.message);
    }

    res.status(201).json({ ...venta, items });
  } catch (err) {
    enviarError(res, 400, err.message || 'No se pudo registrar la venta');
  }
});

/* Editar venta (solo admin).
   Acepta cabecera y, opcionalmente, la lista completa de ítems:
   si viene "items", se reemplaza el detalle y se recalculan
   total, costo_total y utilidad. */
app.put('/api/ventas/:id', auth(true), async (req, res) => {
  try {
    const id = req.params.id;
    const cambios = {};
    if (req.body?.fecha) cambios.fecha = req.body.fecha;
    if (req.body?.hora !== undefined) cambios.hora = req.body.hora || null;
    if (req.body?.cliente !== undefined) cambios.cliente = (req.body.cliente || '').trim() || null;
    if (req.body?.metodo_pago) cambios.metodo_pago = req.body.metodo_pago;

    if (Array.isArray(req.body?.items)) {
      const items = await normalizarItems(req.body.items, 'admin');
      Object.assign(cambios, totalizar(items));

      const { error: errDel } = await db.from('venta_items').delete().eq('venta_id', id);
      if (errDel) throw new Error(errDel.message);

      const { error: errIns } = await db.from('venta_items')
        .insert(items.map(i => ({ ...i, venta_id: Number(id) })));
      if (errIns) throw new Error(errIns.message);
    }

    const { data, error } = await db.from('ventas').update(cambios).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    const { data: items } = await db.from('venta_items').select('*').eq('venta_id', id).order('id');
    res.json({ ...data, items: items || [] });
  } catch (err) {
    enviarError(res, 400, err.message || 'No se pudo actualizar la venta');
  }
});

// Eliminar por período o todo el historial (solo admin)
app.delete('/api/ventas', auth(true), async (req, res) => {
  const { desde, hasta, todo } = req.query;

  let q = db.from('ventas').delete();
  if (todo === 'true') q = q.gt('id', 0);
  else if (desde && hasta) q = q.gte('fecha', desde).lte('fecha', hasta);
  else return enviarError(res, 400, 'Indica un rango de fechas o todo=true');

  const { error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

app.delete('/api/ventas/:id', auth(true), async (req, res) => {
  const { error } = await db.from('ventas').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ---------- 404 y errores ---------- */
app.use('/api', (_req, res) => enviarError(res, 404, 'Endpoint no encontrado'));
app.use((err, _req, res, _next) => {
  console.error('[POS] Error no controlado:', err.message);
  enviarError(res, 500, 'Error interno del servidor');
});

/* Vercel importa el app; en local se levanta con `npm run dev` */
module.exports = app;

if (require.main === module) {
  const puerto = process.env.PORT || 3000;
  app.listen(puerto, () => console.log(`API POS escuchando en http://localhost:${puerto}`));
}
