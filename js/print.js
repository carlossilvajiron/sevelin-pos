/* ============================================================
   PRINT.JS — Ticket térmico (58 mm por defecto, 80 mm opcional)
   ------------------------------------------------------------
   La impresión directa al finalizar la venta está restaurada:
   pos.js llama a imprimirTicketVenta() apenas se registra la venta,
   y el historial puede reimprimir el mismo ticket cuando se quiera.

   Para cambiar el ancho del papel, en la consola del navegador:
     localStorage.setItem('pos_ticket_ancho', '80mm')
   ============================================================ */

function anchoTicket() {
  return localStorage.getItem('pos_ticket_ancho') || '58mm';
}

function aplicarAnchoTicket() {
  document.documentElement.style.setProperty('--ticket-ancho', anchoTicket());
}

function escaparHTML(txt) {
  return String(txt ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function construirTicketHTML(venta, items) {
  const lista = items || venta.items || [];
  const numero = String(venta.numero_orden ?? venta.id ?? 0).padStart(5, '0');
  const totalCalculado = venta.total ?? lista.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);

  const filas = lista.map(it => `
    <tr>
      <td class="t-desc">
        ${it.cantidad}x ${escaparHTML(it.nombre)}
        ${it.serial_number ? `<div class="t-sn">S/N: ${escaparHTML(it.serial_number)}</div>` : ''}
      </td>
      <td class="t-right">${fmtCLP(it.subtotal)}</td>
    </tr>
  `).join('');

  return `
    <div class="t-head">
      <h3>${escaparHTML(NEGOCIO_NOMBRE)}</h3>
      <p>Comprobante</p>
      <p><b>Orden #${numero}</b></p>
    </div>
    <div class="t-line"></div>
    <p><b>Fecha:</b> ${escaparHTML(venta.fecha || todayISO())}${venta.hora ? ' ' + escaparHTML(venta.hora) : ''}</p>
    ${venta.cliente && String(venta.cliente).trim() ? `<p><b>Cliente:</b> ${escaparHTML(venta.cliente)}</p>` : ''}
    <p><b>Pago:</b> ${escaparHTML(venta.metodo_pago || '-')}</p>
    <div class="t-line"></div>
    <table>
      <tbody>${filas}</tbody>
    </table>
    <div class="t-line"></div>
    <div class="t-total">
      <span>TOTAL</span>
      <span>${fmtCLP(totalCalculado)}</span>
    </div>
    <div class="t-line"></div>
    <p class="t-center">¡Gracias por su compra!</p>
    <p class="t-center t-small">${escaparHTML(NEGOCIO_NOMBRE)} · ${fechaHoraChile()}</p>
    <div class="t-feed"></div>
  `;
}

/* El nombre del archivo al "Guardar como PDF" lo toma el navegador del
   título del documento, así que se cambia justo antes de imprimir y se
   restaura al terminar. */
const TITULO_ORIGINAL = document.title || 'Sistema POS - Sevelin';

function ponerTituloImpresion(titulo) {
  document.title = titulo;
}

function restaurarTitulo() {
  document.title = TITULO_ORIGINAL;
}

/* Imprime el ticket. Se usa al finalizar la venta y al reimprimir. */
function imprimirTicketVenta(venta, items) {
  const container = document.getElementById('ticketContainer');
  if (!container) return;

  aplicarAnchoTicket();
  container.innerHTML = construirTicketHTML(venta, items);

  // La clase indica QUÉ se imprime: ticket de 58 mm u orden de trabajo
  document.body.classList.remove('print-ot');
  document.body.classList.add('print-ticket');

  const numero = String(venta.numero_orden ?? venta.id ?? 0).padStart(5, '0');
  ponerTituloImpresion(`Ticket ${numero} - SEVELIN`);

  // Pequeño respiro para que el navegador pinte el ticket antes del diálogo
  setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);   // por si no llega el evento afterprint
  }, 120);
}

function reimprimirTicket(venta, items) {
  imprimirTicketVenta(venta, items);
}

/* ============================================================
   ORDEN DE TRABAJO — Copia Cliente + Copia Taller
   Mantiene el estilo visual de la aplicación y deja el recuadro
   para la firma manuscrita de conformidad.
   ============================================================ */
function filaOT(etiqueta, valor) {
  if (valor === null || valor === undefined || valor === '' || valor === false) return '';
  return `<div class="ot-dato"><span>${etiqueta}</span><b>${escaparHTML(valor)}</b></div>`;
}

function construirComprobanteOT(ot, etiquetaCopia) {
  const entregado = ot.estado === 'ENTREGADO';
  const cargador = ot.cargador_deja
    ? [ot.cargador_tipo, ot.cargador_voltaje ? ot.cargador_voltaje + 'V' : '', ot.cargador_amperaje ? ot.cargador_amperaje + 'A' : '',
       ot.cargador_cable ? 'con cable' : ''].filter(Boolean).join(' · ') || 'Sí'
    : 'No deja cargador';

  return `
    <div class="ot-doc">
      <div class="ot-doc-head">
        <div>
          <h3>${escaparHTML(NEGOCIO_NOMBRE)}</h3>
          <p>Orden de Trabajo · Servicio Técnico</p>
        </div>
        <div class="ot-doc-num">
          <strong>${escaparHTML(ot.numero_ot || '—')}</strong>
          <span>${etiquetaCopia}</span>
        </div>
      </div>

      <div class="ot-doc-meta">
        <span>Ingreso: <b>${tsAChile(ot.fecha_ingreso)}</b></span>
        <span>Estado: <b>${escaparHTML(ot.estado || 'PENDIENTE')}</b></span>
        ${entregado ? `<span>Entrega: <b>${tsAChile(ot.fecha_entrega)}</b></span>` : ''}
      </div>

      <div class="ot-doc-grid">
        <section>
          <h4>Cliente</h4>
          ${filaOT('Nombre', ot.cliente_nombre)}
          ${filaOT('RUT / ID', ot.cliente_rut)}
          ${filaOT('Teléfono', ot.cliente_telefono)}
          ${filaOT('Correo', ot.cliente_correo)}
          ${filaOT('Dirección', ot.cliente_direccion)}
        </section>

        <section>
          <h4>Equipo</h4>
          ${filaOT('Categoría', ot.dispositivo_categoria)}
          ${filaOT('Modelo', ot.dispositivo_modelo)}
          ${filaOT('N° de serie', ot.dispositivo_sn)}
          ${filaOT('Encendido', ot.dispositivo_enciende)}
          ${filaOT('PIN / Clave', ot.dispositivo_pin)}
          ${filaOT('Cargador', cargador)}
          ${filaOT('Accesorios', ot.accesorios)}
        </section>
      </div>

      <section class="ot-doc-bloque">
        <h4>Falla reportada</h4>
        <p>${escaparHTML(ot.falla_reportada || '—')}</p>
        ${ot.obs_cliente ? `<h4>Observaciones del cliente</h4><p>${escaparHTML(ot.obs_cliente)}</p>` : ''}
        ${ot.obs_tecnico ? `<h4>Observaciones del técnico</h4><p>${escaparHTML(ot.obs_tecnico)}</p>` : ''}
      </section>

      <p class="ot-doc-legal">
        ${ot.acepta_responsabilidad
          ? 'El cliente autoriza la revisión del equipo y, de ser necesario, el formateo o reinstalación del sistema. Declara haber respaldado su información. El taller no responde por pérdida de datos ni por fallas ocultas preexistentes. Equipos no retirados dentro de 90 días quedan sujetos a costo de bodegaje.'
          : 'El cliente NO autorizó formateo ni reinstalación del sistema.'}
      </p>

      <div class="ot-doc-firmas">
        <div class="ot-firma-box">
          ${ot.retira_firma_base64
            ? `<img src="${ot.retira_firma_base64}" alt="Firma de conformidad">`
            : '<span class="ot-firma-vacia"></span>'}
          <span class="ot-firma-linea"></span>
          <small>Firma de conformidad del cliente</small>
          ${ot.retira_nombre ? `<small><b>${escaparHTML(ot.retira_nombre)}</b>${ot.retira_rut ? ' · ' + escaparHTML(ot.retira_rut) : ''}</small>` : ''}
        </div>
        <div class="ot-firma-box">
          <span class="ot-firma-vacia"></span>
          <span class="ot-firma-linea"></span>
          <small>Recepción / Técnico responsable</small>
        </div>
      </div>
    </div>
  `;
}

function imprimirOrdenTrabajo(ot) {
  const area = document.getElementById('otPrintArea');
  if (!area) return;

  area.innerHTML = `
    ${construirComprobanteOT(ot, 'COPIA CLIENTE')}
    <div class="ot-corte">—————————————  corte aquí  —————————————</div>
    ${construirComprobanteOT(ot, 'COPIA TALLER')}
  `;

  document.body.classList.remove('print-ticket');
  document.body.classList.add('print-ot');

  // Nombre por defecto al guardar como PDF: "OT-000002 - SEVELIN"
  ponerTituloImpresion(`${ot.numero_ot || 'OT'} - SEVELIN`);

  setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);
  }, 150);
}

/* Al cerrar el diálogo de impresión se limpian los modos */
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-ticket', 'print-ot');
  restaurarTitulo();
});

/* Respaldo por si el navegador no dispara afterprint (algunos móviles) */
function restaurarEstadoImpresion() {
  document.body.classList.remove('print-ticket', 'print-ot');
  restaurarTitulo();
}

document.addEventListener('DOMContentLoaded', aplicarAnchoTicket);
