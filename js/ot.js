// ==========================================
// OT.JS - Servicio Técnico (Check-In / Check-Out)
// ------------------------------------------
// Wizard de 3 pasos, panel de órdenes, entrega con firma digital y
// puente al POS para cobrar la reparación.
// ==========================================

let ordenesList = [];
let pasoActualOT = 1;
let ultimaOTCreada = null;
let otSeleccionadaEntrega = null;
let filtroEstadoOT = 'PENDIENTE';
let firmaDibujada = false;

const ICO_VER_OT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICO_ELIMINAR_OT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

/* ---------- Formulario (wizard) ---------- */
const elWizardSteps = document.getElementById('wizardSteps');
const elBtnOtAnterior = document.getElementById('btnOtAnterior');
const elBtnOtSiguiente = document.getElementById('btnOtSiguiente');
const elBtnOtGuardar = document.getElementById('btnOtGuardar');
const elBtnOtLimpiar = document.getElementById('btnOtLimpiar');
const elOtCargadorDeja = document.getElementById('otCargadorDeja');
const elOtCargadorDatos = document.getElementById('otCargadorDatos');

/* ---------- Panel de órdenes ---------- */
const elOtTableBody = document.getElementById('otTableBody');
const elOtChips = document.getElementById('otChips');
const elOtBuscar = document.getElementById('otBuscar');
const elBtnOtRecargar = document.getElementById('btnOtRecargar');
const elOtResumenLabel = document.getElementById('otResumenLabel');

/* ---------- Modales ---------- */
const elModalOtPreview = document.getElementById('modalOtPreview');
const elOtPreviewTitulo = document.getElementById('otPreviewTitulo');
const elOtPreviewContenido = document.getElementById('otPreviewContenido');
const elBtnCerrarOtPreview = document.getElementById('btnCerrarOtPreview');
const elBtnImprimirOt = document.getElementById('btnImprimirOt');

const elModalOtEntrega = document.getElementById('modalOtEntrega');
const elOtEntregaId = document.getElementById('otEntregaId');
const elOtEntregaResumen = document.getElementById('otEntregaResumen');
const elOtRetiraNombre = document.getElementById('otRetiraNombre');
const elOtRetiraRut = document.getElementById('otRetiraRut');
const elOtFirmaCanvas = document.getElementById('otFirmaCanvas');
const elBtnLimpiarFirma = document.getElementById('btnLimpiarFirma');
const elBtnCancelarOtEntrega = document.getElementById('btnCancelarOtEntrega');
const elBtnConfirmarOtEntrega = document.getElementById('btnConfirmarOtEntrega');

document.addEventListener('DOMContentLoaded', () => {
  setupOtEventListeners();
  initFirmaCanvas();
  irAPasoOT(1);
});

function setupOtEventListeners() {
  if (elBtnOtSiguiente) elBtnOtSiguiente.addEventListener('click', () => avanzarPasoOT(1));
  if (elBtnOtAnterior) elBtnOtAnterior.addEventListener('click', () => avanzarPasoOT(-1));
  if (elBtnOtGuardar) elBtnOtGuardar.addEventListener('click', guardarCheckIn);
  if (elBtnOtLimpiar) elBtnOtLimpiar.addEventListener('click', () => { limpiarFormularioOT(); irAPasoOT(1); });

  // Clic directo sobre el número del paso
  if (elWizardSteps) {
    elWizardSteps.querySelectorAll('.wizard-step').forEach(step => {
      step.addEventListener('click', () => irAPasoOT(Number(step.dataset.paso)));
    });
  }

  if (elOtCargadorDeja) elOtCargadorDeja.addEventListener('change', () => {
    if (elOtCargadorDatos) elOtCargadorDatos.style.display = elOtCargadorDeja.checked ? 'grid' : 'none';
  });

  if (elOtChips) {
    elOtChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoOT = chip.dataset.estado || '';
        elOtChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarOrdenes();
      });
    });
  }
  if (elOtBuscar) elOtBuscar.addEventListener('input', () => renderOrdenesTabla(ordenesList));
  if (elBtnOtRecargar) elBtnOtRecargar.addEventListener('click', cargarOrdenes);

  if (elBtnCerrarOtPreview) elBtnCerrarOtPreview.addEventListener('click', () => elModalOtPreview?.classList.remove('show'));
  if (elBtnImprimirOt) elBtnImprimirOt.addEventListener('click', () => {
    if (ultimaOTCreada) imprimirOrdenTrabajo(ultimaOTCreada);
  });

  if (elBtnCancelarOtEntrega) elBtnCancelarOtEntrega.addEventListener('click', cerrarModalEntrega);
  if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.addEventListener('click', confirmarEntrega);
  if (elBtnLimpiarFirma) elBtnLimpiarFirma.addEventListener('click', limpiarFirma);

  [elModalOtPreview, elModalOtEntrega].forEach(overlay => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });
}

// ============================================================
// WIZARD
// ============================================================
function irAPasoOT(paso) {
  pasoActualOT = Math.min(Math.max(paso, 1), 3);

  document.querySelectorAll('.wizard-panel').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.paso) === pasoActualOT);
  });
  document.querySelectorAll('.wizard-step').forEach(s => {
    const n = Number(s.dataset.paso);
    s.classList.toggle('active', n === pasoActualOT);
    s.classList.toggle('completo', n < pasoActualOT);
  });

  if (elBtnOtAnterior) elBtnOtAnterior.style.display = pasoActualOT === 1 ? 'none' : '';
  if (elBtnOtSiguiente) elBtnOtSiguiente.style.display = pasoActualOT === 3 ? 'none' : '';
  if (elBtnOtGuardar) elBtnOtGuardar.style.display = pasoActualOT === 3 ? '' : 'none';
}

function avanzarPasoOT(delta) {
  if (delta > 0 && !validarPasoOT(pasoActualOT)) return;
  irAPasoOT(pasoActualOT + delta);
}

function validarPasoOT(paso) {
  if (paso === 1 && !document.getElementById('otClienteNombre').value.trim()) {
    showToast('Ingresa el nombre del cliente', 'err');
    document.getElementById('otClienteNombre').focus();
    return false;
  }
  if (paso === 2 && !document.getElementById('otDispositivoModelo').value.trim()) {
    showToast('Indica el modelo del equipo', 'err');
    document.getElementById('otDispositivoModelo').focus();
    return false;
  }
  return true;
}

function leerFormularioOT() {
  const val = id => (document.getElementById(id)?.value || '').trim();
  const chk = id => !!document.getElementById(id)?.checked;

  return {
    cliente_rut: val('otClienteRut'),
    cliente_nombre: val('otClienteNombre'),
    cliente_telefono: val('otClienteTelefono'),
    cliente_correo: val('otClienteCorreo'),
    cliente_direccion: val('otClienteDireccion'),
    dispositivo_categoria: val('otDispositivoCategoria'),
    dispositivo_modelo: val('otDispositivoModelo'),
    dispositivo_sn: val('otDispositivoSN'),
    dispositivo_enciende: val('otDispositivoEnciende'),
    dispositivo_pin: val('otDispositivoPin'),
    cargador_deja: chk('otCargadorDeja'),
    cargador_tipo: val('otCargadorTipo'),
    cargador_voltaje: val('otCargadorVoltaje'),
    cargador_amperaje: val('otCargadorAmperaje'),
    cargador_cable: chk('otCargadorCable'),
    accesorios: val('otAccesorios'),
    falla_reportada: val('otFallaReportada'),
    obs_cliente: val('otObsCliente'),
    obs_tecnico: val('otObsTecnico'),
    acepta_responsabilidad: chk('otAceptaResponsabilidad')
  };
}

function limpiarFormularioOT() {
  ['otClienteRut', 'otClienteNombre', 'otClienteTelefono', 'otClienteCorreo', 'otClienteDireccion',
   'otDispositivoModelo', 'otDispositivoSN', 'otDispositivoPin', 'otCargadorTipo', 'otCargadorVoltaje',
   'otCargadorAmperaje', 'otAccesorios', 'otFallaReportada', 'otObsCliente', 'otObsTecnico']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  ['otCargadorDeja', 'otCargadorCable'].forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
  const acepta = document.getElementById('otAceptaResponsabilidad');
  if (acepta) acepta.checked = true;
  if (elOtCargadorDatos) elOtCargadorDatos.style.display = 'none';
}

async function guardarCheckIn() {
  if (!validarPasoOT(1) || !validarPasoOT(2)) return;

  const datos = leerFormularioOT();
  if (!datos.falla_reportada) {
    showToast('Describe la falla reportada', 'err');
    document.getElementById('otFallaReportada').focus();
    return;
  }

  if (elBtnOtGuardar) elBtnOtGuardar.disabled = true;

  try {
    const ot = await API.ot.crear(datos);
    ultimaOTCreada = ot;

    showToast(`Check-In registrado: ${ot.numero_ot}`, 'ok');
    limpiarFormularioOT();
    irAPasoOT(1);
    cargarOrdenes();

    // La impresión es opcional: se ofrece, no se dispara sola
    mostrarPreviewOT(ot);
  } catch (err) {
    console.error('Error al registrar el check-in:', err.message || err);
    showToast(err.message || 'No se pudo registrar la orden', 'err');
  } finally {
    if (elBtnOtGuardar) elBtnOtGuardar.disabled = false;
  }
}

function mostrarPreviewOT(ot) {
  ultimaOTCreada = ot;
  if (elOtPreviewTitulo) elOtPreviewTitulo.textContent = `Orden de Trabajo ${ot.numero_ot}`;
  if (elOtPreviewContenido) elOtPreviewContenido.innerHTML = construirComprobanteOT(ot, 'VISTA PREVIA');
  if (elModalOtPreview) elModalOtPreview.classList.add('show');
}

// ============================================================
// PANEL DE ÓRDENES
// ============================================================
async function cargarOrdenes() {
  if (!tokenActual()) return;

  try {
    ordenesList = await API.ot.listar(filtroEstadoOT);
    renderOrdenesTabla(ordenesList);
  } catch (err) {
    console.error('Error al cargar las órdenes:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las órdenes', 'err');
  }
}

function renderOrdenesTabla(lista) {
  if (!elOtTableBody) return;

  const filtro = (elOtBuscar?.value || '').trim().toLowerCase();
  const filas = (lista || []).filter(o => !filtro ||
    (o.numero_ot || '').toLowerCase().includes(filtro) ||
    (o.cliente_nombre || '').toLowerCase().includes(filtro) ||
    (o.cliente_rut || '').toLowerCase().includes(filtro) ||
    (o.dispositivo_modelo || '').toLowerCase().includes(filtro) ||
    (o.dispositivo_sn || '').toLowerCase().includes(filtro)
  );

  const pendientes = (lista || []).filter(o => o.estado === 'PENDIENTE').length;
  if (elOtResumenLabel) {
    elOtResumenLabel.textContent = `${filas.length} orden(es) en pantalla · ${pendientes} pendiente(s) en taller`;
  }

  if (filas.length === 0) {
    elOtTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay órdenes con este filtro.</td></tr>';
    return;
  }

  elOtTableBody.innerHTML = filas.map(o => {
    const pendiente = o.estado === 'PENDIENTE';
    return `
    <tr class="row-in${pendiente ? ' fila-pendiente' : ''}">
      <td class="strong">${o.numero_ot}</td>
      <td>${String(o.fecha_ingreso || '').slice(0, 10)}<br><small style="color:var(--text-muted);">${String(o.fecha_ingreso || '').slice(11, 16)}</small></td>
      <td>${o.cliente_nombre || '—'}${o.cliente_telefono ? `<br><small style="color:var(--text-muted);">${o.cliente_telefono}</small>` : ''}</td>
      <td>${o.dispositivo_categoria || ''} ${o.dispositivo_modelo || ''}${o.dispositivo_sn ? `<br><small style="color:var(--text-muted);">S/N: ${o.dispositivo_sn}</small>` : ''}</td>
      <td>${(o.falla_reportada || '').slice(0, 70)}${(o.falla_reportada || '').length > 70 ? '…' : ''}</td>
      <td><span class="badge ${pendiente ? 'badge-gold' : 'badge-green'}">${o.estado}</span></td>
      <td>
        <div class="cell-actions">
          ${pendiente ? `<button class="btn btn-green btn-sm" data-entregar="${o.id}" title="Check-Out / Entregar equipo">📦 Entregar</button>` : ''}
          <button class="btn btn-outline btn-sm" data-cobrar="${o.id}" title="Cobrar la reparación en el POS">💵 Cobrar en POS</button>
          <button class="btn btn-icon btn-icon-view" data-ver="${o.id}" title="Ver e imprimir la orden">${ICO_VER_OT}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${o.id}" title="Eliminar orden">${ICO_ELIMINAR_OT}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  elOtTableBody.querySelectorAll('button[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ot = ordenesList.find(o => String(o.id) === btn.dataset.ver);
      if (ot) mostrarPreviewOT(ot);
    });
  });
  elOtTableBody.querySelectorAll('button[data-entregar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEntrega(btn.dataset.entregar));
  });
  elOtTableBody.querySelectorAll('button[data-cobrar]').forEach(btn => {
    btn.addEventListener('click', () => cobrarEnPOS(btn.dataset.cobrar));
  });
  elOtTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarOrden(btn.dataset.eliminar));
  });
}

async function eliminarOrden(id) {
  if (!confirm('¿Eliminar esta orden de trabajo? Esta acción no se puede deshacer.')) return;
  try {
    await API.ot.eliminar(id);
    showToast('Orden eliminada', 'ok');
    cargarOrdenes();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar la orden', 'err');
  }
}

/* Puente al POS: precarga el cobro del servicio y cambia de pestaña.
   El cobro es independiente del registro de la OT. */
function cobrarEnPOS(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  if (typeof precargarVentaDesdeOT === 'function') precargarVentaDesdeOT(ot);

  const btnPos = document.querySelector('.nav-btn[data-view="view-pos"]');
  if (btnPos) btnPos.click();
  showToast(`POS precargado con ${ot.numero_ot}. Ingresa el monto a cobrar.`, 'ok');
}

// ============================================================
// CHECK-OUT (entrega con firma)
// ============================================================
function abrirModalEntrega(id) {
  const ot = ordenesList.find(o => String(o.id) === String(id));
  if (!ot) return;

  otSeleccionadaEntrega = ot;
  if (elOtEntregaId) elOtEntregaId.value = ot.id;
  if (elOtEntregaResumen) {
    elOtEntregaResumen.innerHTML = `<b>${ot.numero_ot}</b> · ${ot.cliente_nombre || 'Cliente'} · ${ot.dispositivo_modelo || 'Equipo'}`;
  }
  if (elOtRetiraNombre) elOtRetiraNombre.value = ot.cliente_nombre || '';
  if (elOtRetiraRut) elOtRetiraRut.value = ot.cliente_rut || '';

  limpiarFirma();
  if (elModalOtEntrega) elModalOtEntrega.classList.add('show');
}

function cerrarModalEntrega() {
  if (elModalOtEntrega) elModalOtEntrega.classList.remove('show');
  otSeleccionadaEntrega = null;
}

async function confirmarEntrega() {
  const id = elOtEntregaId?.value;
  if (!id) return;

  if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.disabled = true;

  try {
    await API.ot.entregar(id, {
      retira_nombre: elOtRetiraNombre?.value.trim() || null,
      retira_rut: elOtRetiraRut?.value.trim() || null,
      retira_firma_base64: obtenerFirmaBase64()
    });

    showToast('Equipo entregado y registrado', 'ok');
    cerrarModalEntrega();
    cargarOrdenes();
  } catch (err) {
    console.error('Error al registrar la entrega:', err.message || err);
    showToast(err.message || 'No se pudo registrar la entrega', 'err');
  } finally {
    if (elBtnConfirmarOtEntrega) elBtnConfirmarOtEntrega.disabled = false;
  }
}

function obtenerFirmaBase64() {
  if (!firmaDibujada || !elOtFirmaCanvas) return null;
  try { return elOtFirmaCanvas.toDataURL('image/png'); } catch (_) { return null; }
}

/* ---------- Pad de firma ---------- */
function initFirmaCanvas() {
  if (!elOtFirmaCanvas || typeof elOtFirmaCanvas.getContext !== 'function') return;
  const ctx = elOtFirmaCanvas.getContext('2d');
  if (!ctx) return; // navegador sin soporte de canvas
  let dibujando = false;

  const posicion = (e) => {
    const r = elOtFirmaCanvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return {
      x: (punto.clientX - r.left) * (elOtFirmaCanvas.width / r.width),
      y: (punto.clientY - r.top) * (elOtFirmaCanvas.height / r.height)
    };
  };

  const inicio = (e) => {
    e.preventDefault();
    dibujando = true;
    firmaDibujada = true;
    const p = posicion(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const mover = (e) => {
    if (!dibujando) return;
    e.preventDefault();
    const p = posicion(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const fin = () => { dibujando = false; };

  elOtFirmaCanvas.addEventListener('mousedown', inicio);
  elOtFirmaCanvas.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', fin);
  elOtFirmaCanvas.addEventListener('touchstart', inicio, { passive: false });
  elOtFirmaCanvas.addEventListener('touchmove', mover, { passive: false });
  elOtFirmaCanvas.addEventListener('touchend', fin);

  limpiarFirma();
}

function limpiarFirma() {
  if (!elOtFirmaCanvas || typeof elOtFirmaCanvas.getContext !== 'function') return;
  const ctx = elOtFirmaCanvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, elOtFirmaCanvas.width, elOtFirmaCanvas.height);
  firmaDibujada = false;
}

/* Las órdenes se cargan al iniciar sesión (evento de auth.js) */
document.addEventListener('pos:sesion-iniciada', () => cargarOrdenes());
