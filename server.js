const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());

// --- PLANTILLA HTML (V7 - Corregida) ---
const generateHTML = (data) => {
  const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });
  const enganche = fmt.format(data.precio * 0.10);
  const precio = fmt.format(data.precio);

  // VALIDACIÓN DE IMÁGENES: Convertimos a array si es un string
  let imagesArray = [];
  if (Array.isArray(data.exterior)) {
    imagesArray = data.exterior;
  } else if (typeof data.exterior === 'string') {
    imagesArray = [data.exterior];
  }

  const mainImage = imagesArray[0] || 'https://via.placeholder.com/1080x1920?text=No+Image';

  // Lógica para las miniaturas (evitar error de .sort)
  let otherImages = [];
  if (imagesArray.length > 1) {
    // Si hay varias, barajamos y agarramos 3
    otherImages = [...imagesArray].slice(1).sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  // Si faltan imágenes para llenar los 3 espacios, repetimos la principal
  while (otherImages.length < 3) {
    otherImages.push(mainImage);
  }

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,700;0,900;1,900&display=swap" rel="stylesheet">
    <style>body { font-family: 'Montserrat', sans-serif; }</style>
  </head>
  <body class="bg-gray-900 m-0 p-0 flex justify-center">
    <div class="relative bg-black overflow-hidden flex flex-col justify-between" style="width: 1080px; height: 1920px;">
      <div class="absolute inset-0 z-0">
        <img src="${mainImage}" class="w-full h-full object-cover object-center" />
        <div class="absolute inset-0 bg-black/30"></div>
        <div class="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 opacity-100"></div>
      </div>
      <div class="relative z-20 pt-60 px-12 flex flex-col items-center w-full text-center">
        <div class="mb-12">
          <img src="https://carfiable.mx/wp-content/uploads/2026/01/negativo-color.svg" class="h-16 object-contain" />
        </div>
        <div class="w-full">
          <p class="text-4xl font-bold text-gray-300 leading-none">${data.anio}</p>
          <h1 class="text-7xl font-black text-white uppercase italic leading-tight my-2">${data.modelo}</h1>
          <p class="text-2xl font-bold uppercase tracking-widest text-[#3865E9]">${data.version}</p>
        </div>
      </div>
      <div class="relative z-20 w-full pb-60 flex flex-col items-center">
        <div class="w-full flex justify-center items-center gap-8 mb-8 px-4">
          <div class="flex flex-col items-end leading-tight">
            <span class="text-xl text-gray-400 uppercase font-bold">Precio</span>
            <span class="text-4xl font-bold text-white">${precio}</span>
          </div>
          <div class="w-1 h-16 bg-gray-600"></div>
          <div class="flex flex-col items-start leading-tight">
            <span class="text-xl uppercase font-bold text-[#3865E9]">Enganche</span>
            <span class="text-5xl font-black text-white">${enganche}</span>
          </div>
        </div>
        <div class="w-full mb-12">
          <div class="flex h-40 w-[120%] -ml-[10%] gap-2 transform -skew-x-12">
            ${otherImages.map(img => `
              <div class="flex-1 relative overflow-hidden border-r border-white/20 bg-gray-800">
                <img src="${img}" class="w-full h-full object-cover transform skew-x-12 scale-125" />
              </div>
            `).join('')}
          </div>
        </div>
        <div class="w-full flex justify-center mb-4">
          <div class="flex items-center gap-4 text-white py-4 px-10 rounded-full shadow-lg" style="background-color: #3865E9;">
            <svg viewBox="0 0 24 24" class="w-8 h-8 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            <span class="text-3xl font-bold tracking-tight">${data.telefono}</span>
          </div>
        </div>
        <p class="text-xs text-gray-500 opacity-60 text-center">*Aplican Restricciones.</p>
      </div>
    </div>
  </body>
  </html>
  `;
};

app.post('/generate-story', async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", // Quitamos el warning
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    const htmlContent = generateHTML(req.body);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
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
