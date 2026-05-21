// Cliente de TTS para el renderer.
// Llama al endpoint /api/ai/voice del panel (que internamente usa OpenRouter).
// Devuelve un Buffer mp3 listo para pasar a buildReel({ audioBuffer }).
//
// Variables de entorno:
//   PANEL_URL — URL interna del panel (ej. https://socialplanner.carfiable.mx
//               o http://carfiable-social-panel:3000 en Docker network)
//   PANEL_AI_TOKEN — bearer opcional si el endpoint queda protegido (no implementado aún)

async function fetchVoiceover({ script = null, carData = null }) {
  if (!script && !carData) {
    throw new Error('voiceover: necesitas pasar script o carData');
  }

  const baseUrl = process.env.PANEL_URL;
  if (!baseUrl) throw new Error('PANEL_URL no configurado en .env');

  const body = script ? { script } : { carData };

  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/ai/voice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.PANEL_AI_TOKEN ? { 'Authorization': `Bearer ${process.env.PANEL_AI_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Panel TTS error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('audio/')) {
    // Probablemente un JSON de error
    const errJson = await res.json().catch(() => ({}));
    throw new Error(`Panel TTS devolvió ${ct}: ${JSON.stringify(errJson).slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const scriptUsed = decodeURIComponent(res.headers.get('x-script-used') ?? '');
  return { buffer: Buffer.from(arrayBuffer), scriptUsed };
}

module.exports = { fetchVoiceover };
