/*
 * API de conversiones de Meta (servidor) — píxel CAT Campero 1664973935026649.
 * Envía los mismos eventos del píxel (Lead, Purchase) a un pequeño servidor
 * propio (Google Apps Script, ver capi/Code.gs) con el MISMO event_id, para que
 * Meta los deduplique. Ayuda mucho en iPhone/Safari, donde el píxel del navegador pierde datos.
 * Mientras CAPI_ENDPOINT esté vacío no hace nada.
 */
var CAPI_ENDPOINT = '';   // ← URL de la app web de Apps Script (termina en /exec)

(function () {
  function cookie(n) {
    var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function fbc() {
    var c = cookie('_fbc');
    if (c) return c;
    var q = location.search.match(/[?&]fbclid=([^&]+)/);
    if (q) {
      var v = 'fb.1.' + Date.now() + '.' + q[1];
      try { document.cookie = '_fbc=' + v + ';path=/;max-age=7776000;SameSite=Lax'; } catch (e) {}
      return v;
    }
    return '';
  }
  window.capiEnviar = function (evento, eventId, custom, usuario) {
    if (!CAPI_ENDPOINT) return;
    try {
      var cuerpo = JSON.stringify({
        evento: evento, event_id: eventId, url: location.href,
        ts: Math.floor(Date.now() / 1000),
        fbp: cookie('_fbp'), fbc: fbc(), ua: navigator.userAgent,
        custom: custom || {}, usuario: usuario || {}
      });
      var blob = new Blob([cuerpo], { type: 'text/plain;charset=UTF-8' });
      // sendBeacon sobrevive al cambio de página (importante en iPhone)
      if (!(navigator.sendBeacon && navigator.sendBeacon(CAPI_ENDPOINT, blob))) {
        fetch(CAPI_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body: cuerpo }).catch(function () {});
      }
    } catch (e) {}
  };
})();
