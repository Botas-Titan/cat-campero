/**
 * Servidor propio de la API de conversiones de Meta — CAT Campero.
 * Pega este código en un proyecto nuevo de Google Apps Script y publícalo como
 * "Aplicación web" (Ejecutar como: yo · Acceso: cualquier persona).
 *
 * En Configuración del proyecto → Propiedades del script crea:
 *   PIXEL_ID    = 1664973935026649
 *   TOKEN       = (token de acceso del conjunto de datos, de Administrador de eventos)
 *   TEST_CODE   = (opcional, solo para probar: código de "Probar eventos")
 */
function doPost(e) {
  try {
    var p = PropertiesService.getScriptProperties();
    var pixel = p.getProperty('PIXEL_ID'), token = p.getProperty('TOKEN');
    if (!pixel || !token) return salida({ ok: false, error: 'faltan propiedades' });
    var d = JSON.parse(e.postData.contents);
    var u = d.usuario || {};
    var user = { client_user_agent: d.ua || '' };
    if (d.fbp) user.fbp = d.fbp;
    if (d.fbc) user.fbc = d.fbc;
    var tel = String(u.celular || '').replace(/\D/g, '');
    if (tel && tel.indexOf('57') !== 0) tel = '57' + tel;
    var partes = String(u.nombre || '').trim().toLowerCase().split(/\s+/);
    if (tel.length > 6) user.ph = [sha(tel)];
    if (partes[0]) user.fn = [sha(partes[0])];
    if (partes.length > 1) user.ln = [sha(partes[partes.length - 1])];
    if (u.ciudad) user.ct = [sha(String(u.ciudad).toLowerCase().replace(/\s+/g, ''))];
    user.country = [sha('co')];
    var evento = {
      event_name: d.evento, event_time: d.ts || Math.floor(Date.now() / 1000),
      event_id: d.event_id, action_source: 'website', event_source_url: d.url,
      user_data: user, custom_data: d.custom || {}
    };
    var cuerpo = { data: [evento] };
    var test = p.getProperty('TEST_CODE');
    if (test) cuerpo.test_event_code = test;
    var r = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + pixel + '/events?access_token=' + encodeURIComponent(token), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(cuerpo), muteHttpExceptions: true
    });
    return salida({ ok: r.getResponseCode() === 200, meta: r.getContentText() });
  } catch (err) { return salida({ ok: false, error: String(err) }); }
}
function sha(t) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
