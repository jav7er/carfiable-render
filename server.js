const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use('/ideas', express.static('ideas'));

// --- API Proxy (protege el token en el servidor) ---
const CARFIABLE_TOKEN = process.env.CARFIABLE_TOKEN || '';
const CARFIABLE_API = 'https://carfiable.mx/api';

app.get('/api/search', async (req, res) => {
  try {
    const r = await fetch(`${CARFIABLE_API}/cars/search?q=${encodeURIComponent(req.query.q || '')}`, {
      headers: { 'Authorization': `Bearer ${CARFIABLE_TOKEN}`, 'Accept': '*/*' }
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/car/:id', async (req, res) => {
  try {
    const r = await fetch(`${CARFIABLE_API}/cars/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${CARFIABLE_TOKEN}`, 'Accept': '*/*' }
    });
    res.status(r.status).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Helper compartido para todas las plantillas ---
function prepareTemplateData(data) {
  const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });
  const fmtNum = new Intl.NumberFormat('es-MX');
  let imgs = Array.isArray(data.exterior) ? data.exterior
           : typeof data.exterior === 'string' ? [data.exterior] : [];
  const placeholder = 'https://via.placeholder.com/1080x1920?text=Sin+imagen';
  const mainImage = imgs[0] || placeholder;
  const shuffled = [...imgs].slice(1).sort(() => 0.5 - Math.random());

  // Precio: usa precio_oferta si es menor, o precio manual si lo mandan
  const precioBase = data.precio || 0;
  const precioOferta = data.precio_oferta ? Number(data.precio_oferta) : null;
  const precioNum = (precioOferta && precioOferta < precioBase) ? precioOferta : precioBase;

  // Lógica de kilometraje / año
  const currentYear = new Date().getFullYear();
  const anio = parseInt(data.anio) || currentYear;
  const yearsOld = Math.max(1, currentYear - anio);
  const km = parseInt(data.km || data.kilometraje || 0);
  const kmPerYear = km / yearsOld;
  const altaRotacion = kmPerYear > 20000; // más de 20,000 km/año = alto uso

  // Formato del km para mostrar
  const kmDisplay = km ? `${fmtNum.format(km)} km` : null;

  // Dato alternativo si km es alto: se muestra algo más favorable
  const motor = data.motor || data.cilindros || null;
  const datoAlternativo = motor
    ? motor
    : data.version || null;

  // Registro / procedencia
  const rawRegistroKey = (data.registration_type || data.procedencia || data.registro || '').toLowerCase().trim();
  const registro = (data.registration_type || data.procedencia || data.registro || 'MEXICANO DE AGENCIA').toUpperCase().trim();

  // Lógica de financiamiento según tipo de registro (mismo criterio que el frontend)
  // nacional_agencia → 60 meses / 1% | resto → 48 meses / 2%
  const esMexAgencia = rawRegistroKey === 'nacional_agencia'
    || registro.includes('MEXICANO') && registro.includes('AGENCIA');
  const plazoDefault    = esMexAgencia ? '60 meses' : '48 meses';
  const tasaDefault     = esMexAgencia ? '1%'       : '2%';
  const enganchePct     = esMexAgencia ? 0.10       : 0.15; // 10% agencia / 15% otros

  const ofertaLabel = data.ofertaLabel || 'PRECIO';
  const plazo       = data.plazo       || plazoDefault;
  const tasaLabel   = data.tasaLabel   || 'Tasa mensual desde';
  const tasa        = data.tasa        || tasaDefault;

  return {
    precio: fmt.format(precioNum),
    precioNum,
    enganche: fmt.format(precioNum * enganchePct),
    mensual: fmt.format(precioNum * 0.025),
    ofertaLabel, plazo, tasaLabel, tasa,
    km, kmDisplay, kmPerYear, altaRotacion,
    datoAlternativo, registro, motor,
    imagesArray: imgs, mainImage, shuffled, placeholder, fmt
  };
}

const WA_ICON = `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>`;

// --- PLANTILLA 1: Dark Cinema ---
const generateHTML = (data) => {
  const { precio, kmDisplay, altaRotacion, datoAlternativo, registro,
          ofertaLabel, plazo, tasaLabel, tasa,
          mainImage, imagesArray } = prepareTemplateData(data);
  const marca  = (data.marca  || '').toUpperCase();
  const modelo = (data.modelo || '').toUpperCase();
  const version = data.version || '';
  const anio    = data.anio   || '';

  let otherImages = [...imagesArray].slice(1).sort(() => 0.5 - Math.random()).slice(0, 2);
  while (otherImages.length < 2) otherImages.push(mainImage);

  const kmRow = kmDisplay
    ? `<div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">
        <span style="font-size:38px;font-weight:700;color:rgba(255,255,255,0.75);">
          ${altaRotacion && datoAlternativo ? datoAlternativo : kmDisplay}
        </span>
        ${!altaRotacion ? `<span style="font-size:32px;color:rgba(255,255,255,0.4);font-weight:600;">· ${registro}</span>` : ''}
      </div>`
    : '';

  const rawLen   = precio.replace(/[^0-9]/g, '').length;
  const pFontSize = rawLen >= 8 ? 80 : rawLen >= 7 ? 92 : rawLen >= 6 ? 104 : 116;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
  <style>body{font-family:'Montserrat',sans-serif;margin:0;}.skew{transform:skewX(-12deg)}.unskew{transform:skewX(12deg) scale(1.2)}</style>
</head>
<body style="background:#111;display:flex;justify-content:center;">
  <div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#000;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="position:absolute;inset:0;">
      <img src="${mainImage}" style="width:100%;height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.4);"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.88) 0%,transparent 40%,rgba(0,0,0,0.94) 100%);"></div>
    </div>

    <!-- TOP: logo + car info -->
    <div style="position:relative;z-index:20;padding:120px 80px 0;display:flex;flex-direction:column;align-items:center;text-align:center;">
      <img src="http://localhost:3000/ideas/negativo-color.svg" style="height:88px;object-fit:contain;margin-bottom:56px;">
      ${marca ? `<p style="font-size:44px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:0.2em;margin-bottom:8px;">${marca}</p>` : ''}
      <h1 style="font-size:140px;font-weight:900;color:#fff;text-transform:uppercase;line-height:0.85;letter-spacing:-0.03em;font-style:italic;">${modelo}</h1>
      ${version ? `<p style="font-size:48px;font-weight:800;color:#3865E9;text-transform:uppercase;letter-spacing:0.18em;margin-top:20px;">${version}${anio ? ' · ' + anio : ''}</p>` : ''}
    </div>

    <!-- BOTTOM: km, precio, financing, photos, phone -->
    <div style="position:relative;z-index:20;padding:0 80px 72px;display:flex;flex-direction:column;align-items:center;">
      ${kmRow}

      <!-- Precio centrado (único) -->
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:48px;">
        <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(180deg,#4F6BFF,#00C6FF);border-radius:6px;padding:6px 20px;margin-bottom:16px;">
          <span style="width:22px;height:22px;color:white;display:flex;align-items:center;flex-shrink:0;">${TAG_ICON}</span>
          <span style="color:#fff;font-size:34px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${ofertaLabel}</span>
        </div>
        <span style="font-size:${pFontSize}px;font-weight:900;color:#fff;white-space:nowrap;line-height:1;">${precio}</span>
      </div>

      <!-- Financiamiento: plazo | tasa -->
      <div style="display:flex;align-items:center;width:100%;margin-bottom:52px;">
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
          <span style="font-size:26px;color:rgba(255,255,255,0.55);font-weight:600;text-transform:uppercase;letter-spacing:1px;">Plazos hasta</span>
          <span style="font-size:56px;font-weight:900;color:#fff;">${plazo}</span>
        </div>
        <div style="width:2px;height:96px;background:rgba(255,255,255,0.2);"></div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
          <span style="font-size:26px;color:rgba(255,255,255,0.55);font-weight:600;text-transform:uppercase;letter-spacing:1px;">${tasaLabel}</span>
          <span style="font-size:56px;font-weight:900;background:linear-gradient(180deg,#4F6BFF,#00C6FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${tasa}</span>
        </div>
      </div>

      <!-- Photo strips -->
      <div style="width:120%;margin-left:-10%;overflow:hidden;margin-bottom:56px;">
        <div style="display:flex;height:288px;gap:8px;" class="skew">
          ${otherImages.map(img => `<div style="flex:1;overflow:hidden;border:1px solid rgba(255,255,255,0.1);background:#1f2937;"><img src="${img}" style="width:100%;height:100%;object-fit:cover;" class="unskew"></div>`).join('')}
        </div>
      </div>

      <!-- Phone -->
      <div style="display:flex;align-items:center;justify-content:center;gap:20px;background:#3865E9;border-radius:60px;padding:22px 56px;margin-bottom:32px;">
        <svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:white;flex-shrink:0;">${WA_ICON}</svg>
        <span style="font-size:52px;font-weight:900;color:white;">${FIXED_PHONE}</span>
      </div>
      <p style="font-size:22px;color:rgba(255,255,255,0.3);font-weight:500;">*Aplican Restricciones.</p>
    </div>
  </div>
</body>
</html>`;
};

// Teléfono fijo en todas las plantillas
const FIXED_PHONE = '656 121 0910';

// Lucide icons (inline SVG)
const GAUGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>`;
const TAG_ICON   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

// Shared: info-box inner HTML (952×240)
function infoBoxHTML(marca, modelo, version, anio, ofertaLabel, precio) {
  const rawLen = precio.replace(/[^0-9]/g, '').length;
  const pFontSize = rawLen >= 8 ? 54 : rawLen >= 7 ? 62 : rawLen >= 6 ? 72 : 85;
  const modeloFs  = modelo.length > 11 ? 62 : modelo.length > 8 ? 78 : 96;
  return `
    <!-- Left: marca / modelo / trim — bounded right so it never overlaps price -->
    <span style="position:absolute;left:28px;top:22px;right:370px;color:#fff;font-family:'Inter',sans-serif;font-size:32px;font-weight:600;letter-spacing:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${marca}</span>
    <span style="position:absolute;left:28px;top:62px;right:370px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:${modeloFs}px;font-weight:800;line-height:0.9;white-space:nowrap;overflow:hidden;">${modelo}</span>
    <span style="position:absolute;left:28px;top:168px;right:370px;color:rgba(255,255,255,0.9);font-family:'Inter',sans-serif;font-size:44px;font-weight:500;letter-spacing:1px;white-space:nowrap;overflow:hidden;">${version ? `${version} · ${anio}` : anio}</span>
    <!-- Right: badge + precio — anchored to right edge, text-align right -->
    <div style="position:absolute;right:24px;top:24px;width:360px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;">
      <div style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(180deg,#4F6BFF,#00C6FF);border-radius:4px;padding:4px 14px;flex-shrink:0;">
        <span style="width:20px;height:20px;color:white;display:flex;align-items:center;flex-shrink:0;">${TAG_ICON}</span>
        <span style="color:#fff;font-family:'Inter',sans-serif;font-size:34px;font-weight:700;letter-spacing:2px;white-space:nowrap;">${ofertaLabel}</span>
      </div>
      <span style="color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:${pFontSize}px;font-weight:800;line-height:0.9;text-align:right;white-space:nowrap;">${precio}</span>
    </div>`;
}

// Shared: km section HTML — positioned at (0,0), caller sets absolute position
// darkBg=true wraps with semi-transparent dark panel (for overlays on photos)
function kmSectionHTML(kmInfo, altaRotacion, registro, plazo, tasaLabel, tasa, sectionW, darkBg) {
  const w = sectionW || 800;
  const inner = `
    ${kmInfo ? `
    <div style="display:flex;align-items:center;gap:16px;padding:0 0 20px 0;">
      <span style="width:40px;height:40px;color:rgba(255,255,255,0.9);flex-shrink:0;">${GAUGE_ICON}</span>
      <span style="color:rgba(255,255,255,0.9);font-family:'Inter',sans-serif;font-size:38px;font-weight:400;white-space:nowrap;">${kmInfo}</span>
      ${!altaRotacion ? `<span style="color:rgba(255,255,255,0.75);font-family:'Inter',sans-serif;font-size:38px;font-weight:400;white-space:nowrap;">· ${registro}</span>` : ''}
    </div>
    <div style="width:100%;height:2px;background:rgba(255,255,255,0.85);margin-bottom:20px;"></div>` : ''}
    <div style="width:100%;display:flex;align-items:center;">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <span style="color:rgba(255,255,255,0.73);font-family:'Inter',sans-serif;font-size:33px;font-weight:400;white-space:nowrap;">Plazos hasta</span>
        <span style="color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:65px;font-weight:800;line-height:1;white-space:nowrap;">${plazo}</span>
      </div>
      <div style="width:2px;height:96px;background:rgba(255,255,255,0.85);flex-shrink:0;"></div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <span style="color:rgba(255,255,255,0.73);font-family:'Inter',sans-serif;font-size:33px;font-weight:400;white-space:nowrap;">${tasaLabel}</span>
        <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:65px;font-weight:800;line-height:1;white-space:nowrap;background:linear-gradient(180deg,#4F6BFF,#00C6FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${tasa}</span>
      </div>
    </div>`;
  if (darkBg) {
    return `<div style="background:rgba(10,14,26,0.82);border-radius:6px;padding:20px 28px 24px 28px;width:${w}px;">${inner}</div>`;
  }
  return `<div style="width:${w}px;">${inner}</div>`;
}

const PEN_FONTS = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">`;

// ─── PLANTILLA 2: Pen1 (plantilla1) — Dark top + Info-box + Foto + Strips ──
const generatePen1 = (data) => {
  const { precio, ofertaLabel, plazo, tasaLabel, tasa,
          kmDisplay, altaRotacion, datoAlternativo, registro,
          imagesArray, placeholder } = prepareTemplateData(data);
  const marca   = (data.marca  || '').toUpperCase();
  const modelo  = data.modelo  || '';
  const version = data.version || '';
  const anio    = data.anio    || '';
  const kmInfo  = kmDisplay
    ? (altaRotacion && datoAlternativo ? datoAlternativo : kmDisplay)
    : null;

  const img1 = imagesArray[0] || placeholder;
  const img2 = imagesArray[1] || img1;
  const img3 = imagesArray[2] || img1;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${PEN_FONTS}
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',sans-serif;}</style>
  </head><body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#0a0e1a;">

  <!-- Car photo: y=505 h=966 (ends y=1471) -->
  <img src="${img1}" style="position:absolute;left:0;top:505px;width:1080px;height:966px;object-fit:cover;object-position:center;">

  <!-- Gradient: bottom of car photo → dark, so km section reads over it -->
  <div style="position:absolute;left:0;top:1080px;width:1080px;height:391px;background:linear-gradient(180deg,transparent 0%,rgba(10,14,26,0.55) 50%,rgba(10,14,26,0.85) 100%);pointer-events:none;"></div>

  <!-- Secondary photo: y=1471 w=561 h=449 -->
  <img src="${img2}" style="position:absolute;left:0;top:1471px;width:561px;height:449px;object-fit:cover;">
  <!-- Tertiary photo: y=1471 w=520 h=449 -->
  <img src="${img3}" style="position:absolute;left:561px;top:1471px;width:520px;height:449px;object-fit:cover;">
  <!-- Dark gradient over top of photo strips (for phone readability) -->
  <div style="position:absolute;left:0;top:1471px;width:1080px;height:200px;background:linear-gradient(180deg,rgba(10,14,26,0.7) 0%,transparent 100%);pointer-events:none;"></div>
  <!-- Dark gradient at very bottom (disclaimer) -->
  <div style="position:absolute;left:0;top:1760px;width:1080px;height:160px;background:linear-gradient(180deg,transparent 0%,rgba(10,14,26,0.9) 100%);pointer-events:none;"></div>

  <!-- Dark top solid: y=64 h=539 covers y=64–603 -->
  <div style="position:absolute;left:0;top:64px;width:1080px;height:539px;background:#0a0e1a;"></div>
  <!-- Gradient: bottom edge of dark top → transparent (blends into photo) -->
  <div style="position:absolute;left:0;top:539px;width:1080px;height:80px;background:linear-gradient(180deg,#0a0e1a 0%,transparent 100%);pointer-events:none;"></div>

  <!-- Logo: x=383 y=188 w=313 h=69 -->
  <img src="http://localhost:3000/ideas/negativo-color.svg" style="position:absolute;left:383px;top:188px;width:313px;height:69px;object-fit:contain;">

  <!-- Info-box: x=65 y=311 w=952 h=240 -->
  <div style="position:absolute;left:65px;top:311px;width:952px;height:240px;border:2px solid rgba(255,255,255,0.8);border-radius:6px;background:rgba(10,14,26,0.35);backdrop-filter:blur(2px);">
    ${infoBoxHTML(marca, modelo, version, anio, ofertaLabel, precio)}
  </div>

  <!-- km section: x=68 y=1220 (floats on faded car photo) -->
  <div style="position:absolute;left:68px;top:1220px;">
    ${kmSectionHTML(kmInfo, altaRotacion, registro, plazo, tasaLabel, tasa, 944, false)}
  </div>

  <!-- Phone: centrado sobre photo strips -->
  <div style="position:absolute;left:0;right:0;top:1490px;display:flex;align-items:center;justify-content:center;gap:14px;z-index:10;">
    <svg viewBox="0 0 24 24" style="width:34px;height:34px;fill:#25D366;flex-shrink:0;">${WA_ICON}</svg>
    <span style="font-family:'Inter',sans-serif;font-size:38px;font-weight:700;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.9);">${FIXED_PHONE}</span>
  </div>

  <!-- Disclaimer -->
  <div style="position:absolute;left:64px;bottom:24px;width:952px;color:rgba(255,255,255,0.55);font-family:'Inter',sans-serif;font-size:26px;font-weight:400;text-align:center;">*Aplican restricciones. Condiciones de crédito sujetas a perfil crediticio.</div>

</div></body></html>`;
};

// ─── PLANTILLA 3: Pen2 (plantilla2) — Info-box sobre foto + Barra dark ─────
const generatePen2 = (data) => {
  const { precio, ofertaLabel, plazo, tasaLabel, tasa,
          kmDisplay, altaRotacion, datoAlternativo, registro,
          imagesArray, placeholder } = prepareTemplateData(data);
  const marca   = (data.marca  || '').toUpperCase();
  const modelo  = data.modelo  || '';
  const version = data.version || '';
  const anio    = data.anio    || '';
  const kmInfo  = kmDisplay
    ? (altaRotacion && datoAlternativo ? datoAlternativo : kmDisplay)
    : null;

  const img1 = imagesArray[0] || placeholder;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${PEN_FONTS}
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',sans-serif;}</style>
  </head><body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#0a0e1a;">

  <!-- Car photo: y=344 h=1155 (ends y=1499) -->
  <img src="${img1}" style="position:absolute;left:0;top:344px;width:1080px;height:1155px;object-fit:cover;object-position:center;">

  <!-- Gradient top of photo: dark → transparent (blends dark header into photo) -->
  <div style="position:absolute;left:0;top:344px;width:1080px;height:340px;background:linear-gradient(180deg,#0a0e1a 0%,rgba(10,14,26,0.6) 55%,transparent 100%);pointer-events:none;"></div>

  <!-- Gradient bottom of photo → dark section (smooth transition) -->
  <div style="position:absolute;left:0;top:1150px;width:1080px;height:280px;background:linear-gradient(180deg,transparent 0%,rgba(10,14,26,0.7) 60%,#0a0e1a 100%);pointer-events:none;"></div>

  <!-- Dark solid bottom: y=1330 h=590 (extends to canvas bottom) -->
  <div style="position:absolute;left:0;top:1330px;width:1080px;height:590px;background:#0a0e1a;"></div>

  <!-- Logo: x=353 y=182 w=300 h=66 -->
  <img src="http://localhost:3000/ideas/negativo-color.svg" style="position:absolute;left:353px;top:182px;width:300px;height:66px;object-fit:contain;">

  <!-- Info-box: x=64 y=290 w=952 h=240 -->
  <div style="position:absolute;left:64px;top:290px;width:952px;height:240px;border:2px solid rgba(255,255,255,0.8);border-radius:6px;background:rgba(10,14,26,0.25);">
    ${infoBoxHTML(marca, modelo, version, anio, ofertaLabel, precio)}
  </div>

  <!-- km section: y=1360 — on dark background -->
  <div style="position:absolute;left:85px;top:1360px;">
    ${kmSectionHTML(kmInfo, altaRotacion, registro, plazo, tasaLabel, tasa, 910, false)}
  </div>

  <!-- Phone centrado -->
  <div style="position:absolute;left:0;right:0;top:1640px;display:flex;align-items:center;justify-content:center;gap:14px;">
    <svg viewBox="0 0 24 24" style="width:36px;height:36px;fill:#25D366;flex-shrink:0;">${WA_ICON}</svg>
    <span style="font-family:'Inter',sans-serif;font-size:40px;font-weight:700;color:#fff;">${FIXED_PHONE}</span>
  </div>

  <!-- Disclaimer -->
  <div style="position:absolute;left:43px;bottom:28px;width:994px;color:rgba(255,255,255,0.55);font-family:'Inter',sans-serif;font-size:26px;font-weight:400;text-align:center;">*Aplican restricciones. Condiciones de crédito sujetas a perfil crediticio.</div>

</div></body></html>`;
};

// ─── PLANTILLA 4: Pen3 (plantilla3) — Top fotos + Foto hero + km MID + Info-box abajo ───
const generatePen3 = (data) => {
  const { precio, ofertaLabel, plazo, tasaLabel, tasa,
          kmDisplay, altaRotacion, datoAlternativo, registro,
          imagesArray, placeholder } = prepareTemplateData(data);
  const marca   = (data.marca  || '').toUpperCase();
  const modelo  = data.modelo  || '';
  const version = data.version || '';
  const anio    = data.anio    || '';
  const kmInfo  = kmDisplay
    ? (altaRotacion && datoAlternativo ? datoAlternativo : kmDisplay)
    : null;

  const img1 = imagesArray[0] || placeholder;
  const img2 = imagesArray[1] || img1;
  const img3 = imagesArray[2] || img1;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${PEN_FONTS}
  <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Inter',sans-serif;}</style>
  </head><body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#0a0e1a;">

  <!-- Top photos split: y=0 h=478 -->
  <img src="${img2}" style="position:absolute;left:0;top:0;width:540px;height:478px;object-fit:cover;">
  <img src="${img3}" style="position:absolute;left:541px;top:0;width:539px;height:478px;object-fit:cover;">
  <!-- 1px gap between top photos -->
  <div style="position:absolute;left:540px;top:0;width:1px;height:478px;background:#0a0e1a;"></div>

  <!-- Gradient bottom of top photos → transparent (km section sits here) -->
  <div style="position:absolute;left:0;top:300px;width:1080px;height:178px;background:linear-gradient(180deg,transparent 0%,rgba(10,14,26,0.72) 100%);pointer-events:none;"></div>

  <!-- Main car photo: y=478 h=1232 (ends y=1710) -->
  <img src="${img1}" style="position:absolute;left:0;top:478px;width:1080px;height:1232px;object-fit:cover;object-position:center;">

  <!-- Gradient top of car photo (blends from km section bg) -->
  <div style="position:absolute;left:0;top:478px;width:1080px;height:120px;background:linear-gradient(180deg,rgba(10,14,26,0.5) 0%,transparent 100%);pointer-events:none;"></div>

  <!-- Gradient bottom of car photo → dark section -->
  <div style="position:absolute;left:0;top:1220px;width:1080px;height:280px;background:linear-gradient(180deg,transparent 0%,rgba(10,14,26,0.75) 65%,#0a0e1a 100%);pointer-events:none;"></div>

  <!-- Dark bottom: y=1369 → canvas bottom -->
  <div style="position:absolute;left:0;top:1369px;width:1080px;height:551px;background:#0a0e1a;"></div>

  <!-- km section: floats at bottom of top photos with dark pill bg -->
  <div style="position:absolute;left:64px;top:320px;">
    ${kmSectionHTML(kmInfo, altaRotacion, registro, plazo, tasaLabel, tasa, 952, true)}
  </div>

  <!-- Logo: x=383 y=1390 -->
  <img src="http://localhost:3000/ideas/negativo-color.svg" style="position:absolute;left:383px;top:1390px;width:313px;height:69px;object-fit:contain;">

  <!-- Info-box: y=1480 h=240 -->
  <div style="position:absolute;left:64px;top:1480px;width:952px;height:240px;border:2px solid rgba(255,255,255,0.8);border-radius:6px;background:transparent;">
    ${infoBoxHTML(marca, modelo, version, anio, ofertaLabel, precio)}
  </div>

  <!-- Phone centrado -->
  <div style="position:absolute;left:0;right:0;top:1740px;display:flex;align-items:center;justify-content:center;gap:14px;">
    <svg viewBox="0 0 24 24" style="width:32px;height:32px;fill:#25D366;flex-shrink:0;">${WA_ICON}</svg>
    <span style="font-family:'Inter',sans-serif;font-size:36px;font-weight:700;color:#fff;">${FIXED_PHONE}</span>
  </div>

  <!-- Disclaimer -->
  <div style="position:absolute;left:64px;bottom:24px;width:952px;color:rgba(255,255,255,0.55);font-family:'Inter',sans-serif;font-size:26px;font-weight:400;text-align:center;">*Aplican restricciones. Condiciones de crédito sujetas a perfil crediticio.</div>

</div></body></html>`;
};

// --- Endpoint principal ---
app.post('/generate-story', async (req, res) => {
  let browser;
  try {
    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH
      || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: chromePath
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });

    const tpl = parseInt(req.body.template) || 1;
    const fn = { 1: generateHTML, 2: generatePen1, 3: generatePen2, 4: generatePen3 }[tpl] || generateHTML;
    const htmlContent = fn(req.body);

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000)); // wait for fonts/images
    const imageBuffer = await page.screenshot({ type: 'jpeg', quality: 90 });

    await browser.close();
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);

  } catch (error) {
    if (browser) await browser.close();
    console.error("Error generando imagen:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Render Server listo en puerto 3000'));
