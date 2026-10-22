/*
 * Pago con Mercado Pago para las landings de TITAN BOTAS.
 * Lo usan index.html (botón "Pagar con Mercado Pago" del recuadro de confirmación)
 * y gracias.html (verifica el pago y muestra la confirmación).
 *
 * Cada página declara su producto en la etiqueta <html data-mp="velez-thomas">.
 * Mientras MP_ENDPOINT esté vacío, el botón de Mercado Pago permanece oculto y
 * todo sigue funcionando solo con contraentrega por WhatsApp.
 */
var MP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxUPRSHhFDQF8h3yBGBURpVyx_ulSbgJqX4snee_duV7rfFVIXHcuND2OigjLkftljV/exec';   // ← URL de la aplicación web de Apps Script (termina en /exec)

(function () {
  var PRODUCTO = document.documentElement.getAttribute('data-mp') || '';
  var CLAVE_MP = 'pedidoMP';

  // ---------- estilos del botón y del aviso ----------
  var css = document.createElement('style');
  css.textContent =
    '.mc-mp{display:block;width:100%;background:#009ee3;color:#fff;font-weight:800;font-size:1.02rem;border:none;' +
    'border-radius:12px;padding:15px;cursor:pointer;font-family:inherit;margin-bottom:10px}' +
    '.mc-mp:active{transform:scale(.98)}.mc-mp[disabled]{opacity:.7;cursor:wait}' +
    '.mc-mp[hidden],.mc-o[hidden]{display:none}' +
    '.mc-o{font-size:.74rem;color:#9c9a94;margin:2px 0 10px}' +
    '#mp-estado{margin:0 0 18px;padding:18px;border-radius:16px;text-align:center;border:2px solid #009ee3;background:rgba(0,158,227,.12);color:#f2ede4}' +
    '#mp-estado[hidden]{display:none}#mp-estado h2{font-size:1.2rem;margin-bottom:6px;color:#fff}' +
    '#mp-estado p{font-size:.9rem;margin-bottom:10px}' +
    '#mp-estado.ok{border-color:#20a15e;background:rgba(32,161,94,.15)}' +
    '#mp-estado.mal{border-color:#e0503f;background:rgba(224,80,63,.14)}' +
    '#mp-estado a.mp-wa{display:block;background:#25D366;color:#052e14;font-weight:800;padding:14px;border-radius:12px;text-decoration:none;margin-top:8px}';
  document.head.appendChild(css);

  function disponible() { return !!MP_ENDPOINT && !!PRODUCTO; }

  // ---------- mostrar el botón en el recuadro de confirmación ----------
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('mc-mp'), o = document.getElementById('mc-o');
    if (b && disponible()) { b.hidden = false; if (o) o.hidden = false; }
  });

  function nuevoId() { return 'MP-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); }

  // ---------- pagar ----------
  window.pagarConMercadoPago = function () {
    if (!disponible() || typeof recolectarDatos !== 'function') return;
    var btn = document.getElementById('mc-mp');
    if (btn.disabled) return;
    var textoOriginal = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparando tu pago…';
    var reactivar = function (msg) {
      btn.disabled = false; btn.textContent = textoOriginal;
      if (msg) alert(msg);
    };

    var datos = recolectarDatos();
    var ref = nuevoId();
    var retorno = location.origin + location.pathname.replace(/[^\/]*$/, '') + 'gracias.html';
    var total = (typeof precioActual === 'function') ? precioActual() : 0;
    var oferta = (typeof mesOferta !== 'undefined') ? mesOferta : '';

    try { localStorage.setItem(CLAVE_MP, JSON.stringify({ ref: ref, ts: Date.now(), producto: PRODUCTO })); } catch (e) {}

    // Evento Lead (formulario enviado)
    try { if (window.fbq) fbq('track', 'Lead', { content_name: PRODUCTO, content_type: 'product', currency: 'COP', value: total || undefined }, { eventID: ref + '-lead' }); } catch (e) {}

    // 1) Guardar el pedido como "pago pendiente" (Firestore + hoja existente), sin esperar más de 6 s
    var guardado = Promise.resolve();
    if (window.guardarPedido) {
      guardado = window.guardarPedido({
        tipo: 'formulario', metodoPago: 'mercadopago', estadoPago: 'pendiente', producto: PRODUCTO,
        nombre: datos.nombre, telefono: datos.celular, departamento: datos.departamento,
        ciudad: datos.ciudad, direccion: datos.direccion,
        observaciones: (datos.notas ? datos.notas + ' | ' : '') + (datos.regalo ? 'Regalo: ' + datos.regalo : ''),
        regalo: datos.regalo || '', oferta: oferta,
        pedido: [{ color: datos.color || '', talla: datos.talla, cantidad: 1, precio: total }],
        total: total, pedidoId: ref
      }).catch(function () {});
    }

    // 2) Crear el pago y mandar al cliente a Mercado Pago
    guardado.then(function () {
      return fetch(MP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // sin preflight CORS
        body: JSON.stringify({ action: 'crear', producto: PRODUCTO, ref: ref, datos: datos, retorno: retorno })
      });
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok && res.url) { window.location.href = res.url; return; }
        reactivar('No pudimos abrir Mercado Pago en este momento. Inténtalo de nuevo o elige pagar contraentrega.');
      })
      .catch(function () {
        reactivar('No pudimos abrir Mercado Pago en este momento. Inténtalo de nuevo o elige pagar contraentrega.');
      });
  };

  // ---------- el cliente vuelve de Mercado Pago (gracias.html) ----------
  window.mpGracias = function () {
    var q = new URLSearchParams(location.search);
    var ref = q.get('ref'), pago = q.get('pago');
    if (!ref || !pago || !disponible()) return;
    var caja = document.getElementById('mp-estado');
    if (!caja) return;
    caja.hidden = false;
    // El pedido llegó por Mercado Pago: se oculta el texto de "contraentrega"
    var ok = document.querySelector('.hero-ok p');
    if (pago === 'fallo') {
      caja.className = 'mal';
      caja.innerHTML = '<h2>El pago no se completó</h2><p>No se hizo ningún cobro. Puedes volver a intentarlo o pedir con pago contraentrega.</p>' +
        '<a class="mp-wa" style="background:#009ee3;color:#fff" href="index.html#comprar">Volver a intentarlo</a>';
      return;
    }
    caja.className = '';
    caja.innerHTML = '<h2>⏳ Verificando tu pago…</h2><p>Un momento, estamos confirmando con Mercado Pago.</p>';

    var intentos = 0;
    function consultar() {
      intentos++;
      var url = MP_ENDPOINT + '?action=estado&ref=' + encodeURIComponent(ref) +
        (q.get('payment_id') || q.get('collection_id') ? '&payment_id=' + encodeURIComponent(q.get('payment_id') || q.get('collection_id')) : '');
      fetch(url).then(function (r) { return r.json(); }).then(function (res) {
        if (res && res.ok && res.estado === 'aprobado') return aprobado(res);
        if (res && res.ok && (res.estado === 'rechazado' || res.estado === 'monto_distinto')) {
          caja.className = 'mal';
          caja.innerHTML = '<h2>El pago no fue aprobado</h2><p>Si ya te descontaron, escríbenos por WhatsApp con tu comprobante.</p>';
          return;
        }
        if (intentos < 8) return setTimeout(consultar, 3000);
        caja.innerHTML = '<h2>Pago en proceso</h2><p>Mercado Pago aún no confirma el pago. Apenas se apruebe te lo notificamos; si tienes dudas, escríbenos por WhatsApp.</p>';
      }).catch(function () { if (intentos < 8) setTimeout(consultar, 3000); });
    }

    function aprobado(res) {
      caja.className = 'ok';
      var wa = (typeof WA_NUMERO !== 'undefined' && WA_NUMERO) ? WA_NUMERO : (document.documentElement.getAttribute('data-wa') || '');
      caja.innerHTML = '<h2>✅ ¡Pago aprobado!</h2>' +
        '<p>Ya enviamos la confirmación de tu pago y los datos de envío a nuestro equipo. ID de pago: <b>' + (res.payment_id || '') + '</b></p>' +
        (wa && res.mensaje ? '<a class="mp-wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(res.mensaje) + '">💬 Enviar comprobante por WhatsApp (opcional)</a>' : '');
      // Evento Purchase: una sola vez por pedido y solo con pago aprobado
      try {
        var contados = (localStorage.getItem('pedidosContados') || '').split(',');
        if (contados.indexOf(ref) === -1) {
          contados.push(ref); localStorage.setItem('pedidosContados', contados.slice(-50).join(','));
          if (window.fbq) fbq('track', 'Purchase', {
            content_name: PRODUCTO, content_type: 'product', contents: [{ id: PRODUCTO, quantity: 1 }],
            num_items: 1, value: res.total, currency: 'COP'
          }, { eventID: ref });
        }
      } catch (e) {}
    }
    consultar();
  };
})();
