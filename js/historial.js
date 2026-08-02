// ==========================================
// HISTORIAL.JS - Ventas e Historial (Sevelin)
// ------------------------------------------
//  · Muestra por defecto las ventas de HOY
//  · Filtros rápidos (Hoy / Semana / Mes / Año / Personalizado)
//  · KPIs + desglose de medios de pago
//  · PDF y Excel con resumen consolidado
//  · Edición de los ítems de una venta con recálculo de totales (admin)
//  · El trabajador solo ve y reimprime: sin costos, utilidades ni borrado
// ==========================================

let salesHistory = [];
let currentSaleDetails = null;
let accionPendientePeriodo = null;
let periodoActivo = 'hoy';
let periodoModal = 'hoy';
let ventaEditando = null;   // venta abierta en el modal de edición
let itemsEditando = [];     // copia editable de sus ítems

/* ---------- Referencias del DOM ---------- */
const elHistorialTableBody = document.getElementById('historialTableBody');
const elHistFechaDesde = document.getElementById('histFechaDesde');
const elHistFechaHasta = document.getElementById('histFechaHasta');
const elBtnFiltrarHistorial = document.getElementById('btnFiltrarHistorial');
const elHistChips = document.getElementById('histChips');
const elHistPeriodoLabel = document.getElementById('histPeriodoLabel');

const elKpiVentas = document.getElementById('kpiVentasTotales');
const elKpiCantidad = document.getElementById('kpiCantidadVentas');
const elKpiUtilidad = document.getElementById('kpiUtilidadTotal');
const elKpiMargen = document.getElementById('kpiMargen');
const elKpiCosto = document.getElementById('kpiCostoTotal');
const elKpiTicket = document.getElementById('kpiTicketPromedio');
const elKpiRangoTexto = document.getElementById('kpiRangoTexto');
const elPayBar = document.getElementById('payBar');
const elPayLegend = document.getElementById('payLegend');

const elModalDetalleVenta = document.getElementById('modalDetalleVenta');
const elDetalleVentaContent = document.getElementById('detalleVentaContent');
const elBtnCerrarDetalleVenta = document.getElementById('btnCerrarDetalleVenta');

const elBtnExportarHistorialExcel = document.getElementById('btnExportarHistorialExcel');
const elBtnExportarHistorialPDF = document.getElementById('btnExportarHistorialPDF');
const elBtnEliminarHistorialCompleto = document.getElementById('btnEliminarHistorialCompleto');
const elBtnEliminarPorPeriodo = document.getElementById('btnEliminarPorPeriodo');

const elModalExportarHistorial = document.getElementById('modalExportarHistorial');
const elTituloModalPeriodo = document.getElementById('tituloModalPeriodo');
const elHintModalPeriodo = document.getElementById('hintModalPeriodo');
const elModalPeriodoChips = document.getElementById('modalPeriodoChips');
const elModalPeriodoResumen = document.getElementById('modalPeriodoResumen');
const elExportFechasPersonalizadas = document.getElementById('exportFechasPersonalizadas');
const elExportFechaDesde = document.getElementById('exportFechaDesde');
const elExportFechaHasta = document.getElementById('exportFechaHasta');
const elBtnCancelarExportar = document.getElementById('btnCancelarExportar');
const elBtnExportarExcelModal = document.getElementById('btnExportarExcelModal');
const elBtnExportarPDFModal = document.getElementById('btnExportarPDFModal');
const elBtnConfirmarEliminarPeriodo = document.getElementById('btnConfirmarEliminarPeriodo');

const elInputImportarVentas = document.getElementById('inputImportarVentas');
const elBtnImportarVentas = document.getElementById('btnImportarVentas');

const elModalEditarVenta = document.getElementById('modalEditarVenta');
const elEditVentaId = document.getElementById('editVentaId');
const elEditVentaNumero = document.getElementById('editVentaNumero');
const elEditVentaFecha = document.getElementById('editVentaFecha');
const elEditVentaCliente = document.getElementById('editVentaCliente');
const elEditVentaMetodoPago = document.getElementById('editVentaMetodoPago');
const elEditVentaItemsList = document.getElementById('editVentaItemsList');
const elEditVentaTotales = document.getElementById('editVentaTotales');
const elBtnAgregarItemVenta = document.getElementById('btnAgregarItemVenta');
const elBtnCancelarEditarVenta = document.getElementById('btnCancelarEditarVenta');
const elBtnGuardarEdicionVenta = document.getElementById('btnGuardarEdicionVenta');

/* ---------- Íconos ---------- */
const ICONO_VER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONO_EDITAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICONO_ELIMINAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

const COLORES_PAGO = {
  'Efectivo': '#22c55e',
  'Transferencia': '#3b82f6',
  'Tarjeta Débito': '#a78bfa',
  'Tarjeta Crédito': '#fbbf24',
  'Por Pagar': '#ef4444'
};
const COLORES_EXTRA = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#94a3b8'];
const colorMedioPago = (nombre, idx) => COLORES_PAGO[nombre] || COLORES_EXTRA[idx % COLORES_EXTRA.length];

const ETIQUETAS_PERIODO = {
  hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', anio: 'Este año', personalizado: 'Rango personalizado'
};

document.addEventListener('DOMContentLoaded', () => {
  setDefaultDatesHistorial();
  setupHistorialEventListeners();
});

function setDefaultDatesHistorial() {
  if (elHistFechaDesde) elHistFechaDesde.value = todayISO();
  if (elHistFechaHasta) elHistFechaHasta.value = todayISO();
  marcarChipActivo(elHistChips, 'hoy');
  actualizarEtiquetaPeriodo();
}

function setupHistorialEventListeners() {
  if (elBtnFiltrarHistorial) elBtnFiltrarHistorial.addEventListener('click', () => {
    periodoActivo = 'personalizado';
    marcarChipActivo(elHistChips, 'personalizado');
    cargarHistorial();
  });

  if (elHistChips) {
    elHistChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => aplicarPeriodoVista(chip.dataset.periodo));
    });
  }

  // Calendario nativo: se abre al hacer clic en cualquier parte del campo
  [elHistFechaDesde, elHistFechaHasta, elExportFechaDesde, elExportFechaHasta, elEditVentaFecha].forEach(el => {
    if (!el) return;
    el.addEventListener('click', () => { if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (_) {} } });
  });

  [elHistFechaDesde, elHistFechaHasta].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      periodoActivo = 'personalizado';
      marcarChipActivo(elHistChips, 'personalizado');
      cargarHistorial();
    });
  });

  if (elBtnCerrarDetalleVenta) elBtnCerrarDetalleVenta.addEventListener('click', cerrarDetalleVenta);
  if (elBtnEliminarHistorialCompleto) elBtnEliminarHistorialCompleto.addEventListener('click', eliminarTodoHistorial);

  if (elBtnExportarHistorialExcel) elBtnExportarHistorialExcel.addEventListener('click', () => abrirModalPeriodo('exportar', 'xlsx'));
  if (elBtnExportarHistorialPDF) elBtnExportarHistorialPDF.addEventListener('click', () => abrirModalPeriodo('exportar', 'pdf'));
  if (elBtnEliminarPorPeriodo) elBtnEliminarPorPeriodo.addEventListener('click', () => abrirModalPeriodo('eliminar'));

  if (elModalPeriodoChips) {
    elModalPeriodoChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => seleccionarPeriodoModal(chip.dataset.periodo));
    });
  }

  if (elBtnCancelarExportar) elBtnCancelarExportar.addEventListener('click', cerrarModalPeriodo);
  if (elBtnExportarExcelModal) elBtnExportarExcelModal.addEventListener('click', () => ejecutarAccionModal('xlsx'));
  if (elBtnExportarPDFModal) elBtnExportarPDFModal.addEventListener('click', () => ejecutarAccionModal('pdf'));
  if (elBtnConfirmarEliminarPeriodo) elBtnConfirmarEliminarPeriodo.addEventListener('click', () => ejecutarAccionModal('eliminar'));

  [elModalExportarHistorial, elModalDetalleVenta, elModalEditarVenta].forEach(overlay => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });
  });

  if (elBtnImportarVentas) elBtnImportarVentas.addEventListener('click', () => elInputImportarVentas?.click());
  if (elInputImportarVentas) elInputImportarVentas.addEventListener('change', handleImportarVentas);

  if (elBtnCancelarEditarVenta) elBtnCancelarEditarVenta.addEventListener('click', cerrarModalEditarVenta);
  if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.addEventListener('click', guardarEdicionVenta);
  if (elBtnAgregarItemVenta) elBtnAgregarItemVenta.addEventListener('click', agregarItemAVentaEditada);
}

// ============================================================
// PERÍODOS
// ============================================================
function calcularRangoPeriodo(periodo) {
  const hoy = new Date();
  const hoyISO = todayISO();
  let desde = hoyISO;

  if (periodo === 'semana') {
    const dia = hoy.getDay();
    const diffLunes = (dia === 0 ? 6 : dia - 1);
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diffLunes);
    desde = isoLocal(lunes);
  } else if (periodo === 'mes') {
    desde = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  } else if (periodo === 'anio') {
    desde = isoLocal(new Date(hoy.getFullYear(), 0, 1));
  }

  return { desde, hasta: hoyISO };
}

function marcarChipActivo(contenedor, periodo) {
  if (!contenedor) return;
  contenedor.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.periodo === periodo));
}

function aplicarPeriodoVista(periodo) {
  periodoActivo = periodo;
  marcarChipActivo(elHistChips, periodo);

  if (periodo !== 'personalizado') {
    const { desde, hasta } = calcularRangoPeriodo(periodo);
    if (elHistFechaDesde) elHistFechaDesde.value = desde;
    if (elHistFechaHasta) elHistFechaHasta.value = hasta;
    cargarHistorial();
  } else {
    actualizarEtiquetaPeriodo();
    try { elHistFechaDesde?.focus(); } catch (_) {}
  }
}

function actualizarEtiquetaPeriodo() {
  if (!elHistPeriodoLabel) return;
  const desde = elHistFechaDesde?.value || todayISO();
  const hasta = elHistFechaHasta?.value || todayISO();
  const etiqueta = ETIQUETAS_PERIODO[periodoActivo] || 'Período';
  elHistPeriodoLabel.textContent = desde === hasta ? `${etiqueta} · ${desde}` : `${etiqueta} · ${desde} a ${hasta}`;
  if (elKpiRangoTexto) elKpiRangoTexto.textContent = desde === hasta ? desde : `${desde} → ${hasta}`;
}

// ============================================================
// MODAL DE PERÍODO (Exportar / Eliminar)
// ============================================================
function abrirModalPeriodo(accion, formatoSugerido) {
  if (!esAdmin()) { showToast('Acción disponible solo para el administrador', 'err'); return; }

  accionPendientePeriodo = accion;
  const esEliminar = accion === 'eliminar';

  periodoModal = periodoActivo;
  marcarChipActivo(elModalPeriodoChips, periodoModal);
  if (elExportFechaDesde) elExportFechaDesde.value = elHistFechaDesde?.value || todayISO();
  if (elExportFechaHasta) elExportFechaHasta.value = elHistFechaHasta?.value || todayISO();
  actualizarVisibilidadFechasPersonalizadas();

  if (elTituloModalPeriodo) elTituloModalPeriodo.textContent = esEliminar ? 'Eliminar Ventas por Período' : 'Exportar Historial de Ventas';
  if (elHintModalPeriodo) {
    elHintModalPeriodo.textContent = esEliminar
      ? 'Elige el período que quieres eliminar. Esta acción no se puede deshacer.'
      : 'Elige el período y luego el formato de exportación.';
  }

  if (elBtnExportarExcelModal) elBtnExportarExcelModal.style.display = esEliminar ? 'none' : '';
  if (elBtnExportarPDFModal) elBtnExportarPDFModal.style.display = esEliminar ? 'none' : '';
  if (elBtnConfirmarEliminarPeriodo) elBtnConfirmarEliminarPeriodo.style.display = esEliminar ? '' : 'none';

  if (!esEliminar) {
    if (elBtnExportarExcelModal) elBtnExportarExcelModal.className = formatoSugerido === 'xlsx' ? 'btn btn-green' : 'btn btn-outline';
    if (elBtnExportarPDFModal) elBtnExportarPDFModal.className = formatoSugerido === 'pdf' ? 'btn btn-green' : 'btn btn-outline';
  }

  if (elModalExportarHistorial) elModalExportarHistorial.classList.add('show');
}

function cerrarModalPeriodo() {
  if (elModalExportarHistorial) elModalExportarHistorial.classList.remove('show');
}

function seleccionarPeriodoModal(periodo) {
  periodoModal = periodo;
  marcarChipActivo(elModalPeriodoChips, periodo);

  if (periodo !== 'personalizado') {
    const { desde, hasta } = calcularRangoPeriodo(periodo);
    if (elExportFechaDesde) elExportFechaDesde.value = desde;
    if (elExportFechaHasta) elExportFechaHasta.value = hasta;
  }
  actualizarVisibilidadFechasPersonalizadas();
}

function actualizarVisibilidadFechasPersonalizadas() {
  const esPersonalizado = periodoModal === 'personalizado';
  if (elExportFechasPersonalizadas) elExportFechasPersonalizadas.style.display = esPersonalizado ? 'grid' : 'none';
  if (elModalPeriodoResumen) {
    const d = elExportFechaDesde?.value || todayISO();
    const h = elExportFechaHasta?.value || todayISO();
    elModalPeriodoResumen.textContent = d === h ? `Período seleccionado: ${d}` : `Período seleccionado: ${d} a ${h}`;
  }
}

async function ejecutarAccionModal(formato) {
  let desde = elExportFechaDesde?.value;
  let hasta = elExportFechaHasta?.value;

  if (periodoModal !== 'personalizado') ({ desde, hasta } = calcularRangoPeriodo(periodoModal));
  if (!desde || !hasta) { showToast('Selecciona ambas fechas', 'err'); return; }
  if (desde > hasta) { showToast('La fecha "Desde" no puede ser mayor que "Hasta"', 'err'); return; }

  if (formato === 'eliminar') await ejecutarEliminarPorPeriodo(desde, hasta);
  else await ejecutarExportarPorPeriodo(formato, desde, hasta);
}

async function ejecutarExportarPorPeriodo(formato, desde, hasta) {
  try {
    const ventas = await API.ventas.listar(desde, hasta);
    if (!ventas || ventas.length === 0) { showToast('No hay ventas en ese período', 'err'); return; }

    if (formato === 'pdf') exportarHistorialPDF(ventas, desde, hasta);
    else exportarHistorial(formato, ventas, desde, hasta);

    cerrarModalPeriodo();
  } catch (err) {
    console.error('Error al exportar por período:', err.message || err);
    showToast(err.message || 'Error al exportar', 'err');
  }
}

async function ejecutarEliminarPorPeriodo(desde, hasta) {
  if (!confirm(`¿Eliminar TODAS las ventas entre ${desde} y ${hasta}? Esta acción no se puede deshacer.`)) return;

  try {
    await API.ventas.eliminarPeriodo(desde, hasta);
    showToast('Ventas del período eliminadas', 'ok');
    cerrarModalPeriodo();
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar ventas por período:', err.message || err);
    showToast(err.message || 'No se pudo eliminar', 'err');
  }
}

// ============================================================
// RESUMEN / KPIs
// ============================================================
function calcularResumen(ventas) {
  const lista = ventas || [];
  const total = lista.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const costo = lista.reduce((a, v) => a + (Number(v.costo_total) || 0), 0);
  const utilidad = lista.reduce((a, v) => {
    const u = (v.utilidad !== null && v.utilidad !== undefined)
      ? Number(v.utilidad)
      : (Number(v.total) || 0) - (Number(v.costo_total) || 0);
    return a + (u || 0);
  }, 0);

  const mapa = {};
  lista.forEach(v => {
    const metodo = v.metodo_pago || 'Sin especificar';
    if (!mapa[metodo]) mapa[metodo] = { nombre: metodo, monto: 0, cantidad: 0 };
    mapa[metodo].monto += Number(v.total) || 0;
    mapa[metodo].cantidad += 1;
  });

  const metodos = Object.values(mapa)
    .sort((a, b) => b.monto - a.monto)
    .map((m, i) => ({
      ...m,
      pct: total > 0 ? (m.monto / total) * 100 : (lista.length ? (m.cantidad / lista.length) * 100 : 0),
      color: colorMedioPago(m.nombre, i)
    }));

  return {
    cantidad: lista.length,
    total, costo, utilidad,
    margen: total > 0 ? (utilidad / total) * 100 : 0,
    ticketPromedio: lista.length ? total / lista.length : 0,
    metodos
  };
}

function animarValor(el, valorFinal) {
  if (!el) return;
  const inicio = Number(el.dataset.valor) || 0;
  const duracion = 420;
  const t0 = performance.now();
  el.dataset.valor = valorFinal;

  const sinAnimacion = typeof requestAnimationFrame !== 'function' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (sinAnimacion) { el.textContent = fmtCLP(valorFinal); return; }

  function paso(t) {
    const p = Math.min((t - t0) / duracion, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtCLP(inicio + (valorFinal - inicio) * eased);
    if (p < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

function renderResumenHistorial(ventas) {
  const r = calcularResumen(ventas);

  animarValor(elKpiVentas, r.total);
  animarValor(elKpiUtilidad, r.utilidad);
  animarValor(elKpiCosto, r.costo);
  animarValor(elKpiTicket, r.ticketPromedio);

  if (elKpiCantidad) elKpiCantidad.textContent = `${r.cantidad} ${r.cantidad === 1 ? 'venta registrada' : 'ventas registradas'}`;
  if (elKpiMargen) elKpiMargen.textContent = `Margen ${r.margen.toFixed(1)}%`;

  if (elPayBar) {
    elPayBar.innerHTML = r.metodos.map(m =>
      `<span style="width:${m.pct}%; background:${m.color};" title="${m.nombre}: ${m.pct.toFixed(1)}%"></span>`
    ).join('');
  }
  if (elPayLegend) {
    elPayLegend.innerHTML = r.metodos.length
      ? r.metodos.map(m => `
          <span class="pay-item">
            <span class="dot" style="background:${m.color};"></span>
            ${m.nombre} <b>${m.pct.toFixed(0)}%</b>
            <span style="color:var(--text-muted);">(${fmtCLP(m.monto)})</span>
          </span>`).join('')
      : '<span class="pay-item" style="color:var(--text-muted);">Sin ventas en el período</span>';
  }

  actualizarEtiquetaPeriodo();
  return r;
}

// ============================================================
// EXPORTAR (Excel / CSV / PDF)
// ============================================================
function obtenerFilasHistorialParaExportar(ventas) {
  return (ventas || []).map(v => ({
    'N° Orden': v.numero_orden ?? v.id,
    Fecha: v.fecha || '',
    Hora: v.hora || '',
    Cliente: v.cliente || 'Consumidor Final',
    'Método de Pago': v.metodo_pago || '',
    Total: Number(v.total) || 0,
    'Costo Total': Number(v.costo_total) || 0,
    Utilidad: Number(v.utilidad) || 0
  }));
}

function exportarHistorial(formato, ventas, desde, hasta) {
  const filas = obtenerFilasHistorialParaExportar(ventas);
  if (filas.length === 0) { showToast('No hay ventas en este rango para exportar', 'err'); return; }

  const r = calcularResumen(ventas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Ventas');

  const resumen = [
    { Concepto: 'Período', Valor: `${desde} a ${hasta}` },
    { Concepto: 'Cantidad de ventas', Valor: r.cantidad },
    { Concepto: 'Total de Ventas', Valor: r.total },
    { Concepto: 'Costo Total', Valor: r.costo },
    { Concepto: 'Utilidad Total', Valor: r.utilidad },
    { Concepto: 'Margen (%)', Valor: Number(r.margen.toFixed(1)) },
    { Concepto: '', Valor: '' },
    { Concepto: 'MEDIOS DE PAGO', Valor: '% del período' }
  ].concat(r.metodos.map(m => ({ Concepto: m.nombre, Valor: `${m.pct.toFixed(1)}% (${fmtCLP(m.monto)})` })));

  if (formato !== 'csv') XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  XLSX.writeFile(libro, `ventas_${desde}_a_${hasta}.${formato}`, { bookType: formato === 'csv' ? 'csv' : 'xlsx' });
  showToast('Exportación generada', 'ok');
}

function exportarHistorialPDF(ventas, desde, hasta) {
  const filas = obtenerFilasHistorialParaExportar(ventas);
  if (filas.length === 0) { showToast('No hay ventas en este rango para exportar', 'err'); return; }
  if (typeof window.jspdf === 'undefined') { showToast('No se pudo cargar el generador de PDF', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  const r = calcularResumen(ventas);

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(`Historial de Ventas - ${NEGOCIO_NOMBRE}`, 14, 15);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${desde} a ${hasta}   ·   ${r.cantidad} venta(s)   ·   Generado: ${todayISO()}`, 14, 21);

  const anchoUtil = doc.internal.pageSize.getWidth() - 28;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 25, anchoUtil, 22, 2, 2, 'FD');

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.setFont(undefined, 'bold');
  doc.text(`Total de Ventas: ${fmtCLP(r.total)}`, 19, 32);
  doc.text(`Costo Total: ${fmtCLP(r.costo)}`, 105, 32);
  doc.text(`Utilidad Total: ${fmtCLP(r.utilidad)}  (margen ${r.margen.toFixed(1)}%)`, 180, 32);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const desglose = r.metodos.length
    ? r.metodos.map(m => `${m.pct.toFixed(0)}% ${m.nombre} (${fmtCLP(m.monto)})`).join('   ·   ')
    : 'Sin registros';
  doc.text(`Medios de pago:  ${desglose}`, 19, 41, { maxWidth: anchoUtil - 10 });

  doc.autoTable({
    startY: 52,
    head: [['N° Orden', 'Fecha', 'Hora', 'Cliente', 'Método de Pago', 'Total', 'Costo', 'Utilidad']],
    body: filas.map(f => [
      String(f['N° Orden']).padStart(5, '0'), f.Fecha, f.Hora, f.Cliente, f['Método de Pago'],
      fmtCLP(f.Total), fmtCLP(f['Costo Total']), fmtCLP(f.Utilidad)
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    foot: [['', '', '', '', 'TOTALES', fmtCLP(r.total), fmtCLP(r.costo), fmtCLP(r.utilidad)]],
    footStyles: { fillColor: [15, 23, 42], textColor: [251, 191, 36], fontStyle: 'bold', halign: 'right' }
  });

  doc.save(`ventas_${desde}_a_${hasta}.pdf`);
  showToast('PDF generado', 'ok');
}

// ============================================================
// IMPORTAR ventas desde CSV / Excel
// ============================================================
function normalizarEncabezadoVenta(txt) {
  return String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parsearFechaImportada(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isoLocal(valor);

  const str = String(valor).trim();
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) { const [, d, m, y] = dmy; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  return null;
}

function mapearFilaVentaImportada(fila) {
  const claves = {};
  Object.keys(fila).forEach(k => { claves[normalizarEncabezadoVenta(k)] = fila[k]; });

  const buscar = (...nombres) => {
    for (const n of nombres) {
      if (claves[n] !== undefined && claves[n] !== null && String(claves[n]).trim() !== '') return claves[n];
    }
    return null;
  };

  const fecha = parsearFechaImportada(buscar('fecha', 'date'));
  const total = Number(buscar('total', 'monto')) || 0;
  if (!fecha || total <= 0) return null;

  const costoTotal = Number(buscar('costo total', 'costo', 'cost')) || 0;

  return {
    fecha,
    hora: buscar('hora', 'time') || null,
    cliente: buscar('cliente', 'client', 'customer') || null,
    metodo_pago: buscar('metodo de pago', 'medio de pago', 'payment') || 'Efectivo',
    items: [{
      producto_id: null,
      nombre: 'Venta importada',
      cantidad: 1,
      costo_unitario: costoTotal,
      precio_unitario: total,
      serial_number: null
    }]
  };
}

async function handleImportarVentas(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!esAdmin()) { showToast('Solo el administrador puede importar ventas', 'err'); e.target.value = ''; return; }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    const ventasNuevas = filas.map(mapearFilaVentaImportada).filter(Boolean);

    if (ventasNuevas.length === 0) {
      showToast('El archivo no tiene filas válidas (revisa columnas Fecha y Total)', 'err');
      e.target.value = '';
      return;
    }

    if (!confirm(`Se importarán ${ventasNuevas.length} venta(s), respetando las fechas del archivo. ¿Continuar?`)) {
      e.target.value = '';
      return;
    }

    let importadas = 0;
    for (const venta of ventasNuevas) {
      await API.ventas.crear(venta);
      importadas++;
    }

    showToast(`${importadas} venta(s) importada(s) con éxito`, 'ok');
    cargarHistorial();
  } catch (err) {
    console.error('Error al importar ventas:', err.message || err);
    showToast('Error al importar: ' + (err.message || 'formato no reconocido'), 'err');
  } finally {
    e.target.value = '';
  }
}

// ============================================================
// CARGA Y RENDER
// ============================================================
async function cargarHistorial() {
  if (!tokenActual()) return;

  if (elHistFechaDesde && !elHistFechaDesde.value) elHistFechaDesde.value = todayISO();
  if (elHistFechaHasta && !elHistFechaHasta.value) elHistFechaHasta.value = todayISO();

  try {
    salesHistory = await API.ventas.listar(elHistFechaDesde?.value, elHistFechaHasta?.value);
    renderHistorialTabla(salesHistory);
    renderResumenHistorial(salesHistory);
  } catch (err) {
    console.error('Error al cargar historial de ventas:', err.message || err);
    showToast(err.message || 'Error al consultar las ventas', 'err');
  }
}

function loadSalesHistory() { return cargarHistorial(); }

function renderHistorialTabla(ventas) {
  if (!elHistorialTableBody) return;

  if (!ventas || ventas.length === 0) {
    elHistorialTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay ventas en este período. Prueba con otro filtro o registra una venta nueva.</td></tr>';
    return;
  }

  elHistorialTableBody.innerHTML = ventas.map(v => `
    <tr class="row-in">
      <td class="strong">#${String(v.numero_orden ?? v.id).padStart(5, '0')}</td>
      <td>${v.fecha || '-'}${v.hora ? ' · ' + v.hora : ''}</td>
      <td>${v.cliente || 'Consumidor Final'}</td>
      <td><span class="badge badge-blue">${v.metodo_pago || '-'}</span></td>
      <td class="num strong">${fmtCLP(v.total)}</td>
      <td class="num admin-only" style="color:var(--green); font-weight:600;">${fmtCLP(v.utilidad)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-icon btn-icon-view" data-ver="${v.id}" title="Ver detalle y reimprimir">${ICONO_VER}</button>
          <button class="btn btn-icon btn-icon-edit admin-only" data-editar="${v.id}" title="Editar venta">${ICONO_EDITAR}</button>
          <button class="btn btn-icon btn-icon-del admin-only" data-eliminar="${v.id}" title="Eliminar venta">${ICONO_ELIMINAR}</button>
        </div>
      </td>
    </tr>
  `).join('');

  elHistorialTableBody.querySelectorAll('button[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => verDetalleVenta(btn.dataset.ver));
  });
  elHistorialTableBody.querySelectorAll('button[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarVenta(btn.dataset.editar));
  });
  elHistorialTableBody.querySelectorAll('button[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => eliminarVentaIndividual(btn.dataset.eliminar));
  });
}

// ---------- Eliminar ----------
async function eliminarVentaIndividual(id) {
  if (!confirm('¿Eliminar esta venta del historial? Esta acción no se puede deshacer.')) return;

  try {
    await API.ventas.eliminar(id);
    showToast('Venta eliminada', 'ok');
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar la venta:', err.message || err);
    showToast(err.message || 'No se pudo eliminar la venta', 'err');
  }
}

async function eliminarTodoHistorial() {
  if (!confirm('⚠️ Esto eliminará TODO el historial de ventas (incluye el detalle de cada venta). ¿Continuar?')) return;
  if (!confirm('Esta acción no se puede deshacer. ¿Confirmas que quieres borrar todas las ventas registradas?')) return;

  try {
    await API.ventas.eliminarTodo();
    showToast('Historial de ventas eliminado', 'ok');
    salesHistory = [];
    cargarHistorial();
  } catch (err) {
    console.error('Error al eliminar el historial:', err.message || err);
    showToast(err.message || 'No se pudo eliminar el historial', 'err');
  }
}

// ============================================================
// EDITAR VENTA: cabecera + ítems con recálculo de totales
// ============================================================
async function abrirModalEditarVenta(ventaId) {
  if (!esAdmin()) { showToast('Solo el administrador puede editar ventas', 'err'); return; }

  try {
    const venta = await API.ventas.detalle(ventaId);
    ventaEditando = venta;
    itemsEditando = (venta.items || []).map(it => ({
      producto_id: it.producto_id || null,
      sku: it.sku || null,
      nombre: it.nombre || '',
      cantidad: Number(it.cantidad) || 1,
      costo_unitario: Number(it.costo_unitario) || 0,
      precio_unitario: Number(it.precio_unitario) || 0,
      serial_number: it.serial_number || null
    }));

    if (elEditVentaId) elEditVentaId.value = venta.id;
    if (elEditVentaNumero) elEditVentaNumero.textContent = String(venta.numero_orden ?? venta.id).padStart(5, '0');
    if (elEditVentaFecha) elEditVentaFecha.value = venta.fecha || todayISO();
    if (elEditVentaCliente) elEditVentaCliente.value = venta.cliente || '';
    if (elEditVentaMetodoPago) elEditVentaMetodoPago.value = venta.metodo_pago || 'Efectivo';

    renderItemsEditables();
    if (elModalEditarVenta) elModalEditarVenta.classList.add('show');
  } catch (err) {
    console.error('Error al abrir la venta:', err.message || err);
    showToast(err.message || 'No se pudo cargar la venta', 'err');
  }
}

function renderItemsEditables() {
  if (!elEditVentaItemsList) return;

  if (itemsEditando.length === 0) {
    elEditVentaItemsList.innerHTML = '<p class="modal-hint">La venta quedó sin productos. Agrega al menos uno para poder guardar.</p>';
  } else {
    elEditVentaItemsList.innerHTML = itemsEditando.map((it, i) => `
      <div class="edit-item-row" data-idx="${i}">
        <div class="field edit-item-nombre">
          <label>Producto</label>
          <input type="text" data-campo="nombre" value="${String(it.nombre).replace(/"/g, '&quot;')}">
        </div>
        <div class="field edit-item-num">
          <label>Cant.</label>
          <input type="number" min="1" step="1" data-campo="cantidad" value="${it.cantidad}">
        </div>
        <div class="field edit-item-num">
          <label>Costo unit.</label>
          <input type="number" min="0" step="1" data-campo="costo_unitario" value="${it.costo_unitario}">
        </div>
        <div class="field edit-item-num">
          <label>Precio unit.</label>
          <input type="number" min="0" step="1" data-campo="precio_unitario" value="${it.precio_unitario}">
        </div>
        <div class="edit-item-sub">
          <label>Subtotal</label>
          <strong>${fmtCLP(it.precio_unitario * it.cantidad)}</strong>
        </div>
        <button class="btn btn-icon btn-icon-del" data-quitar="${i}" title="Quitar de la venta">${ICONO_ELIMINAR}</button>
      </div>
    `).join('');

    elEditVentaItemsList.querySelectorAll('.edit-item-row input').forEach(input => {
      input.addEventListener('input', () => {
        const fila = input.closest('.edit-item-row');
        const idx = Number(fila.dataset.idx);
        const campo = input.dataset.campo;
        itemsEditando[idx][campo] = campo === 'nombre' ? input.value : (Number(input.value) || 0);

        // Actualiza subtotal y totales sin volver a dibujar todo (no pierde el foco)
        const sub = fila.querySelector('.edit-item-sub strong');
        if (sub) sub.textContent = fmtCLP(itemsEditando[idx].precio_unitario * itemsEditando[idx].cantidad);
        actualizarTotalesEdicion();
      });
    });

    elEditVentaItemsList.querySelectorAll('button[data-quitar]').forEach(btn => {
      btn.addEventListener('click', () => {
        itemsEditando.splice(Number(btn.dataset.quitar), 1);
        renderItemsEditables();
      });
    });
  }

  actualizarTotalesEdicion();
}

function totalesEdicion() {
  const total = itemsEditando.reduce((a, i) => a + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 0), 0);
  const costo = itemsEditando.reduce((a, i) => a + (Number(i.costo_unitario) || 0) * (Number(i.cantidad) || 0), 0);
  return { total, costo, utilidad: total - costo };
}

function actualizarTotalesEdicion() {
  if (!elEditVentaTotales) return;
  const t = totalesEdicion();
  elEditVentaTotales.innerHTML = `
    <span>Total <b>${fmtCLP(t.total)}</b></span>
    <span>Costo <b>${fmtCLP(t.costo)}</b></span>
    <span>Utilidad <b style="color:var(--green);">${fmtCLP(t.utilidad)}</b></span>
  `;
}

function agregarItemAVentaEditada() {
  itemsEditando.push({
    producto_id: null, sku: null, nombre: 'Nuevo producto',
    cantidad: 1, costo_unitario: 0, precio_unitario: 0, serial_number: null
  });
  renderItemsEditables();
}

function cerrarModalEditarVenta() {
  if (elModalEditarVenta) elModalEditarVenta.classList.remove('show');
  ventaEditando = null;
  itemsEditando = [];
}

async function guardarEdicionVenta() {
  const id = elEditVentaId?.value;
  if (!id) return;

  if (itemsEditando.length === 0) { showToast('La venta debe tener al menos un producto', 'err'); return; }
  const invalido = itemsEditando.find(i => !String(i.nombre).trim() || i.cantidad <= 0 || i.precio_unitario < 0);
  if (invalido) { showToast('Revisa nombres, cantidades y precios de los ítems', 'err'); return; }

  if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.disabled = true;

  try {
    // El backend reemplaza el detalle y recalcula total, costo_total y utilidad
    await API.ventas.actualizar(id, {
      fecha: elEditVentaFecha?.value || todayISO(),
      cliente: elEditVentaCliente?.value.trim() || null,
      metodo_pago: elEditVentaMetodoPago?.value || null,
      items: itemsEditando
    });

    showToast('Venta actualizada y totales recalculados', 'ok');
    cerrarModalEditarVenta();
    cargarHistorial();
  } catch (err) {
    console.error('Error al editar la venta:', err.message || err);
    showToast(err.message || 'No se pudo actualizar la venta', 'err');
  } finally {
    if (elBtnGuardarEdicionVenta) elBtnGuardarEdicionVenta.disabled = false;
  }
}

// ---------- Detalle / reimpresión ----------
async function verDetalleVenta(ventaId) {
  try {
    const venta = await API.ventas.detalle(ventaId);
    currentSaleDetails = venta;
    renderDetalleVenta(venta);
    if (elModalDetalleVenta) elModalDetalleVenta.classList.add('show');
  } catch (err) {
    console.error('Error al obtener el detalle de la venta:', err.message || err);
    showToast(err.message || 'No se pudo cargar el detalle de esta venta', 'err');
  }
}

function renderDetalleVenta(venta) {
  if (!elDetalleVentaContent) return;

  const filas = (venta.items || []).map(it => `
    <tr>
      <td style="padding:8px 0;">${it.cantidad}x ${it.nombre}${it.serial_number ? '<br><small style="color:var(--text-muted);">S/N: ' + it.serial_number + '</small>' : ''}</td>
      <td style="text-align:right; padding:8px 0;">${fmtCLP(it.subtotal)}</td>
    </tr>
  `).join('');

  elDetalleVentaContent.innerHTML = `
    <div class="grid grid-2" style="gap:8px 18px; margin-bottom:12px;">
      <p><b>Orden:</b> #${String(venta.numero_orden ?? venta.id).padStart(5, '0')}</p>
      <p><b>Fecha:</b> ${venta.fecha || '-'}${venta.hora ? ' · ' + venta.hora : ''}</p>
      <p><b>Cliente:</b> ${venta.cliente || 'Consumidor Final'}</p>
      <p><b>Pago:</b> ${venta.metodo_pago || '-'}</p>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <tbody>${filas}</tbody>
    </table>
    <div style="border-top:1px solid var(--border); margin-top:12px; padding-top:12px; display:flex; justify-content:space-between; font-weight:bold; font-size:17px;">
      <span>TOTAL</span><span>${fmtCLP(venta.total)}</span>
    </div>
    ${venta.utilidad !== undefined ? `<p class="modal-hint admin-only">Costo ${fmtCLP(venta.costo_total)} · Utilidad ${fmtCLP(venta.utilidad)}</p>` : ''}
    <div class="row-actions" style="justify-content:flex-end; margin-top:16px;">
      <button class="btn btn-gold" id="btnReimprimirDesdeDetalle">🖨️ Reimprimir Ticket</button>
    </div>
  `;

  const btnReimprimir = document.getElementById('btnReimprimirDesdeDetalle');
  if (btnReimprimir) {
    btnReimprimir.addEventListener('click', () => imprimirTicketVenta(venta, venta.items));
  }
}

function cerrarDetalleVenta() {
  if (elModalDetalleVenta) elModalDetalleVenta.classList.remove('show');
  currentSaleDetails = null;
}
