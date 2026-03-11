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
  let imgs = Array.isArray(data.exterior) ? data.exterior
           : typeof data.exterior === 'string' ? [data.exterior] : [];
  const placeholder = 'https://via.placeholder.com/1080x1920?text=Sin+imagen';
  const mainImage = imgs[0] || placeholder;
  const shuffled = [...imgs].slice(1).sort(() => 0.5 - Math.random());
  return {
    precio: fmt.format(data.precio),
    enganche: fmt.format(data.precio * 0.10),
    mensual: fmt.format(data.precio * 0.025),
    imagesArray: imgs, mainImage, shuffled, placeholder, fmt
  };
}

const WA_ICON = `<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>`;

// --- PLANTILLA 1: Dark Cinema (original) ---
const generateHTML = (data) => {
  const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });
  const enganche = fmt.format(data.precio * 0.10);
  const precio = fmt.format(data.precio);

  let imagesArray = [];
  if (Array.isArray(data.exterior)) {
    imagesArray = data.exterior;
  } else if (typeof data.exterior === 'string') {
    imagesArray = [data.exterior];
  }

  const mainImage = imagesArray[0] || 'https://via.placeholder.com/1080x1920?text=No+Image';

  let otherImages = [];
  if (imagesArray.length > 1) {
    otherImages = [...imagesArray].slice(1).sort(() => 0.5 - Math.random()).slice(0, 2);
  }
  while (otherImages.length < 2) {
    otherImages.push(mainImage);
  }

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Montserrat', sans-serif; }
      .skew-container { transform: skewX(-12deg); }
      .unskew-content { transform: skewX(12deg) scale(1.2); }
    </style>
  </head>
  <body class="bg-gray-900 m-0 p-0 flex justify-center">
    <div class="relative bg-black overflow-hidden flex flex-col justify-between" style="width: 1080px; height: 1920px;">
      <div class="absolute inset-0 z-0">
        <img src="${mainImage}" class="w-full h-full object-cover object-center" />
        <div class="absolute inset-0 bg-black/40"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/90 via-transparent to-black/95"></div>
      </div>
      <div class="relative z-20 pt-32 px-12 flex flex-col items-center w-full text-center">
        <div class="mb-16">
          <img src="http://localhost:3000/ideas/negativo-color.svg" class="h-24 object-contain" />
        </div>
        <div class="w-full space-y-2">
          <p class="text-6xl font-bold text-white tracking-tighter">${data.anio}</p>
          <h1 class="text-[140px] font-black text-white uppercase leading-[0.85] tracking-tighter italic drop-shadow-2xl">
            ${data.modelo}
          </h1>
          <p class="text-5xl font-extrabold uppercase tracking-[0.2em] text-[#3865E9] mt-4">
            ${data.version}
          </p>
        </div>
      </div>
      <div class="relative z-20 w-full pb-20 flex flex-col items-center">
        <div class="w-full flex justify-center items-center gap-12 mb-12 px-10">
          <div class="flex flex-col items-center leading-none">
            <span class="text-xl text-gray-300 uppercase font-bold mb-2">Precio</span>
            <span class="text-6xl font-bold text-white">${precio}</span>
          </div>
          <div class="w-[1px] h-20 bg-white/20"></div>
          <div class="flex flex-col items-center leading-none">
            <span class="text-xl uppercase font-bold text-[#3865E9] mb-2">Enganche</span>
            <span class="text-7xl font-bold text-white">${enganche}</span>
          </div>
        </div>
        <div class="w-[120%] -ml-[10%] mb-16 overflow-hidden">
          <div class="flex h-72 gap-2 skew-container">
            ${otherImages.map(img => `
              <div class="flex-1 relative overflow-hidden border-x border-white/10 bg-gray-800">
                <img src="${img}" class="w-full h-full object-cover unskew-content" />
              </div>
            `).join('')}
          </div>
        </div>
        <div class="w-full flex justify-center mb-8">
          <div class="flex items-center gap-5 text-white py-6 px-12 rounded-full shadow-xl" style="background-color: #3865E9;">
            <svg viewBox="0 0 24 24" class="w-10 h-10 fill-current">${WA_ICON}</svg>
            <span class="text-5xl font-bold tracking-tighter">${data.telefono}</span>
          </div>
        </div>
        <p class="text-xl text-gray-500 font-medium opacity-60 text-center">*Aplican Restricciones.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

// --- PLANTILLA 2: Frame Box ---
const generateHTML2 = (data) => {
  const { precio, enganche, mensual, mainImage } = prepareTemplateData(data);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap" rel="stylesheet">
  <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Montserrat',sans-serif; }</style>
</head>
<body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#0a0c12;">

  <!-- Fondo full-bleed -->
  <img src="${mainImage}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;">
  <!-- Overlay 65% -->
  <div style="position:absolute;inset:0;background:rgba(10,12,20,0.65);"></div>

  <!-- Logo arriba centrado -->
  <div style="position:absolute;top:80px;left:0;right:0;display:flex;justify-content:center;z-index:10;">
    <img src="http://localhost:3000/ideas/negativo-color.svg" style="height:72px;object-fit:contain;">
  </div>

  <!-- Marco rectangular blanco -->
  <div style="position:absolute;top:220px;left:70px;width:940px;height:680px;border:2px solid rgba(255,255,255,0.8);border-radius:6px;z-index:10;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px 72px;">
    <!-- Año -->
    <p style="font-size:40px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.18em;text-transform:uppercase;margin-bottom:12px;">
      ${data.anio}
    </p>
    <!-- Modelo grande centrado -->
    <h1 style="font-size:120px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:0.87;letter-spacing:-0.02em;text-align:center;margin-bottom:20px;">
      ${data.modelo}
    </h1>
    <!-- Versión azul -->
    <p style="font-size:42px;font-weight:800;color:#3865E9;text-transform:uppercase;letter-spacing:0.12em;text-align:center;margin-bottom:48px;">
      ${data.version}
    </p>
    <!-- Separador -->
    <div style="width:100%;height:1px;background:rgba(255,255,255,0.2);margin-bottom:48px;"></div>
    <!-- Precio alineado a la derecha -->
    <div style="width:100%;display:flex;justify-content:flex-end;align-items:baseline;gap:20px;">
      <span style="font-size:30px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;">Precio</span>
      <span style="font-size:88px;font-weight:900;color:#ffffff;line-height:1;letter-spacing:-0.02em;">${precio}</span>
    </div>
  </div>

  <!-- Barra inferior sólida -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:580px;background:rgba(17,24,39,0.96);z-index:10;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 72px;">
    <!-- 3 columnas -->
    <div style="width:100%;display:flex;align-items:center;justify-content:center;margin-bottom:56px;">
      <!-- Enganche -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <span style="font-size:26px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Enganche</span>
        <span style="font-size:66px;font-weight:900;color:#ffffff;line-height:1;">${enganche}</span>
      </div>
      <!-- Divisor -->
      <div style="width:1px;height:130px;background:rgba(255,255,255,0.15);"></div>
      <!-- Mensualidad -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <span style="font-size:26px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Mensualidad est.</span>
        <span style="font-size:38px;font-weight:800;color:#3865E9;line-height:1;">Desde</span>
        <span style="font-size:52px;font-weight:900;color:#ffffff;line-height:1;">${mensual}</span>
      </div>
      <!-- Divisor -->
      <div style="width:1px;height:130px;background:rgba(255,255,255,0.15);"></div>
      <!-- WhatsApp -->
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:14px;">
        <span style="font-size:26px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">WhatsApp</span>
        <div style="display:flex;align-items:center;gap:12px;">
          <svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:#25D366;flex-shrink:0;">${WA_ICON}</svg>
          <span style="font-size:48px;font-weight:900;color:#ffffff;">${data.telefono}</span>
        </div>
      </div>
    </div>
    <!-- Disclaimer -->
    <p style="font-size:22px;font-weight:500;color:rgba(255,255,255,0.25);text-align:center;">
      *Aplican restricciones. Mensualidad estimada, sujeta a aprobación crediticia.
    </p>
  </div>

</div>
</body>
</html>`;
};

// --- PLANTILLA 3: Split Blue ---
const generateHTML3 = (data) => {
  const { precio, enganche, mainImage } = prepareTemplateData(data);
  // Para nombres largos, usar solo primera palabra a 210px y nombre completo más abajo
  const modelWords = data.modelo.toUpperCase().split(' ');
  const modelBig = modelWords[0];
  const modelRest = modelWords.slice(1).join(' ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
  <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Montserrat',sans-serif; }</style>
</head>
<body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#111827;">

  <!-- Lado derecho: foto del auto (paralelo) -->
  <div style="position:absolute;inset:0;clip-path:polygon(44% 0%, 100% 0%, 100% 100%, 32% 100%);">
    <img src="${mainImage}" style="width:100%;height:100%;object-fit:cover;object-position:center;">
    <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(17,24,39,0.5),transparent 40%);"></div>
  </div>

  <!-- Lado izquierdo: fondo navy (paralelo) -->
  <div style="position:absolute;inset:0;clip-path:polygon(0% 0%, 50% 0%, 38% 100%, 0% 100%);background:#111827;"></div>

  <!-- Franja diagonal azul -->
  <div style="position:absolute;inset:0;clip-path:polygon(38% 0%, 50% 0%, 38% 100%, 26% 100%);background:linear-gradient(160deg,#3bd8ff 0%,#3b61ff 100%);opacity:0.92;"></div>

  <!-- CONTENIDO: panel izquierdo -->
  <div style="position:absolute;top:0;left:0;width:600px;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:80px 64px 80px 72px;z-index:20;">

    <!-- Arriba: año + versión -->
    <div>
      <p style="font-size:42px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">
        ${data.anio}
      </p>
      <p style="font-size:32px;font-weight:800;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.06em;line-height:1.3;">
        ${data.version}
      </p>
    </div>

    <!-- Nombre del modelo enorme (desborda hacia la foto) -->
    <div style="position:absolute;top:340px;left:72px;width:920px;z-index:30;">
      <h1 style="font-size:${modelBig.length > 7 ? '160' : '210'}px;font-weight:900;font-style:italic;color:#ffffff;text-transform:uppercase;line-height:0.85;letter-spacing:-0.04em;white-space:nowrap;text-shadow:0 0 80px rgba(0,0,0,0.9),0 4px 24px rgba(0,0,0,1);">
        ${modelBig}
      </h1>
      ${modelRest ? `<h2 style="font-size:90px;font-weight:900;font-style:italic;color:rgba(255,255,255,0.7);text-transform:uppercase;line-height:0.9;letter-spacing:-0.03em;white-space:nowrap;text-shadow:0 0 40px rgba(0,0,0,0.9);">${modelRest}</h2>` : ''}
    </div>

    <!-- Abajo: precio, enganche, teléfono -->
    <div>
      <!-- Precio con gradiente -->
      <div style="margin-bottom:36px;">
        <p style="font-size:26px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Precio</p>
        <p style="font-size:84px;font-weight:900;line-height:1;letter-spacing:-0.02em;background:radial-gradient(circle at 20% 50%,#3bd8ff 0%,#3b61ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
          ${precio}
        </p>
      </div>
      <!-- Enganche -->
      <div style="margin-bottom:44px;">
        <p style="font-size:24px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Enganche desde</p>
        <p style="font-size:58px;font-weight:900;color:#ffffff;line-height:1;">${enganche}</p>
      </div>
      <!-- Badge teléfono -->
      <div style="display:inline-flex;align-items:center;gap:16px;background:#3865E9;border-radius:60px;padding:18px 40px;margin-bottom:44px;">
        <svg viewBox="0 0 24 24" style="width:34px;height:34px;fill:white;flex-shrink:0;">${WA_ICON}</svg>
        <span style="font-size:46px;font-weight:900;color:white;letter-spacing:-0.01em;">${data.telefono}</span>
      </div>
      <!-- Logo carfiable -->
      <div>
        <img src="http://localhost:3000/ideas/negativo-color.svg" style="height:44px;object-fit:contain;opacity:0.8;">
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
};

// --- PLANTILLA 4: Grid Collage ---
const generateHTML4 = (data) => {
  const { precio, enganche, imagesArray, mainImage, placeholder } = prepareTemplateData(data);

  // 6 celdas para el grid, repite si no hay suficientes fotos
  const allImgs = [...imagesArray];
  while (allImgs.length < 6) allImgs.push(...imagesArray);
  const gridImgs = allImgs.slice(0, 6);
  const heroImg = imagesArray[0] || placeholder;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,800;0,900;1,900&display=swap" rel="stylesheet">
  <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Montserrat',sans-serif; }</style>
</head>
<body>
<div style="width:1080px;height:1920px;position:relative;overflow:hidden;background:#0a0c12;">

  <!-- Grid 3×2 (primeros 750px) -->
  <div style="position:absolute;top:0;left:0;right:0;height:750px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4px;background:#0a0c12;">
    ${gridImgs.map(url => `
      <div style="overflow:hidden;position:relative;">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;object-position:center;">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.12);"></div>
      </div>
    `).join('')}
  </div>

  <!-- Separador -->
  <div style="position:absolute;top:750px;left:0;right:0;height:4px;background:#0a0c12;z-index:5;"></div>

  <!-- Foto hero (1166px inferiores) -->
  <div style="position:absolute;top:754px;left:0;right:0;bottom:0;">
    <img src="${heroImg}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;">
    <!-- Vignette radial en las esquinas -->
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 100%,rgba(0,0,0,0) 15%,rgba(0,0,0,0.65) 100%);"></div>
    <!-- Gradiente fuerte hacia abajo para la barra de info -->
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 35%,rgba(0,0,0,0.82) 72%,rgba(0,0,0,0.97) 100%);"></div>
  </div>

  <!-- Logo carfiable sobre la línea divisoria -->
  <div style="position:absolute;top:726px;left:60px;z-index:20;">
    <div style="background:rgba(10,12,18,0.82);padding:10px 28px;border-radius:6px;backdrop-filter:blur(6px);">
      <img src="http://localhost:3000/ideas/negativo-color.svg" style="height:36px;object-fit:contain;">
    </div>
  </div>

  <!-- Barra info inferior (frosted glass) -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:280px;background:rgba(10,12,18,0.88);border-top:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;padding:0 72px;gap:0;z-index:30;">
    <!-- Izquierda: año + modelo -->
    <div style="flex:2;min-width:0;">
      <p style="font-size:30px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:2px;">
        ${data.anio}
      </p>
      <h2 style="font-size:${data.modelo.length > 10 ? '72' : '88'}px;font-weight:900;font-style:italic;color:#ffffff;line-height:0.88;letter-spacing:-0.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${data.modelo}
      </h2>
    </div>
    <!-- Divisor -->
    <div style="width:1px;height:160px;background:rgba(255,255,255,0.12);margin:0 52px;flex-shrink:0;"></div>
    <!-- Derecha: precio, enganche, teléfono -->
    <div style="flex:1.3;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:baseline;gap:12px;">
        <span style="font-size:20px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;">Precio</span>
        <span style="font-size:50px;font-weight:900;color:#ffffff;line-height:1;">${precio}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:12px;">
        <span style="font-size:20px;font-weight:700;color:#3865E9;text-transform:uppercase;">Enganche</span>
        <span style="font-size:42px;font-weight:800;color:#ffffff;line-height:1;">${enganche}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
        <svg viewBox="0 0 24 24" style="width:28px;height:28px;fill:#25D366;flex-shrink:0;">${WA_ICON}</svg>
        <span style="font-size:38px;font-weight:800;color:#ffffff;">${data.telefono}</span>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
};

// --- Endpoint principal ---
app.post('/generate-story', async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });

    const tpl = parseInt(req.body.template) || 1;
    const fn = { 1: generateHTML, 2: generateHTML2, 3: generateHTML3, 4: generateHTML4 }[tpl] || generateHTML;
    const htmlContent = fn(req.body);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
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
