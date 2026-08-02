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
      <p>Comprobante interno de venta</p>
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
    <p class="t-center t-small">${escaparHTML(NEGOCIO_NOMBRE)} · ${todayISO()}</p>
    <div class="t-feed"></div>
  `;
}

/* Imprime el ticket. Se usa al finalizar la venta y al reimprimir. */
function imprimirTicketVenta(venta, items) {
  const container = document.getElementById('ticketContainer');
  if (!container) return;

  aplicarAnchoTicket();
  container.innerHTML = construirTicketHTML(venta, items);

  // Pequeño respiro para que el navegador pinte el ticket antes del diálogo
  setTimeout(() => window.print(), 120);
}

function reimprimirTicket(venta, items) {
  imprimirTicketVenta(venta, items);
}

document.addEventListener('DOMContentLoaded', aplicarAnchoTicket);
