// Builds an MP4 slideshow from N JPEG frames using FFmpeg.
// Output: 1080×1920 (9:16 for IG Reels), H.264 + AAC silent track, ~13s total
// Each frame is 3s with a 0.3s crossfade between adjacent frames.
//
// Source frames are 1080×1080 (carousel slides) — we letterbox onto 1080×1920
// canvas with the brand dark navy (#0a0e1a) so they blend with slides 2-4.

const ffmpeg       = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs           = require('fs').promises;
const path         = require('path');
const os           = require('os');
const crypto       = require('crypto');

ffmpeg.setFfmpegPath(ffmpegStatic);

// Obtiene duración real del audio usando ffprobe
function getAudioDuration(audioPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err || !metadata) { resolve(null); return; }
      resolve(metadata.format?.duration ?? null);
    });
  });
}

const FRAME_DURATION = 3;     // seconds per slide
const XFADE_DURATION = 0.3;   // crossfade duration
const TARGET_W = 1080;
const TARGET_H = 1920;
const PAD_COLOR = '0x0a0e1a'; // brand dark navy
const FRAME_RATE = 30;
const VIDEO_BITRATE = '4M';

// Builds the FFmpeg filter_complex string for N frames with crossfades.
// For 5 frames @ 5s with 0.5s xfade: total ≈ 5 + 4*(5-0.5) = 23s
function buildFilter(n, frameDuration) {
  const scaleAndPad = [];
  for (let i = 0; i < n; i++) {
    scaleAndPad.push(
      `[${i}:v]scale=${TARGET_W}:${TARGET_W}:force_original_aspect_ratio=decrease,` +
      `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:${PAD_COLOR},setsar=1,fps=${FRAME_RATE}[v${i}]`
    );
  }
  // Chain xfades: v0+v1=vf01, vf01+v2=vf02, ...
  const xfades = [];
  let prevLabel = 'v0';
  let runningOffset = 0;
  for (let i = 1; i < n; i++) {
    const offset = runningOffset + frameDuration - XFADE_DURATION;
    runningOffset = offset; // next xfade starts at the previous offset + (FRAME - XFADE)
    const outLabel = (i === n - 1) ? 'vout' : `vf0${i}`;
    xfades.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${offset}[${outLabel}]`
    );
    prevLabel = outLabel;
  }
  return [...scaleAndPad, ...xfades].join(';');
}

// Total duration: first frame plays Ns, each subsequent frame adds (N - 0.3)s
function totalDuration(n) {
  return FRAME_DURATION + (n - 1) * (FRAME_DURATION - XFADE_DURATION);
}

async function writeFramesToTmp(frameBuffers) {
  const id = crypto.randomBytes(6).toString('hex');
  const dir = path.join(os.tmpdir(), `reel-${id}`);
  await fs.mkdir(dir, { recursive: true });
  const paths = [];
  for (let i = 0; i < frameBuffers.length; i++) {
    const p = path.join(dir, `frame${i}.jpg`);
    await fs.writeFile(p, frameBuffers[i]);
    paths.push(p);
  }
  return { dir, paths };
}

// Generates an MP4 from frame buffers.
// Returns { buffer: Buffer, sizeBytes: number, duration: number }
// Generates a minimal silent PCM WAV buffer (avoids dependency on lavfi/anullsrc).
function createSilentWav(durationSec) {
  const sampleRate = 44100;
  const channels = 2;
  const bitsPerSample = 16;
  const numSamples = Math.ceil(durationSec * sampleRate);
  const dataSize = numSamples * channels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize, 0);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);                                         // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buf.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf; // rest is zeros = silence
}

// audioBuffer es opcional. Si se pasa, lo usa como pista de audio (típicamente mp3 de TTS).
// Si no, genera silencio para mantener la pista de audio válida.
// musicBuffer es opcional. Si se pasa, se mezcla como música de fondo al 12% de volumen.
async function buildReel(frameBuffers, { audioBuffer = null, audioExt = 'mp3', musicBuffer = null, musicExt = 'mp3' } = {}) {
  if (!Array.isArray(frameBuffers) || frameBuffers.length < 2) {
    throw new Error('buildReel requires at least 2 frame buffers');
  }
  const n = frameBuffers.length;
  const { dir, paths } = await writeFramesToTmp(frameBuffers);
  const outputPath = path.join(dir, 'output.mp4');

  // Pista de audio: voz si viene buffer, silencio si no.
  let audioPath;
  if (audioBuffer && Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0) {
    audioPath = path.join(dir, `voice.${audioExt}`);
    await fs.writeFile(audioPath, audioBuffer);
  } else {
    audioPath = path.join(dir, 'silence.wav');
    await fs.writeFile(audioPath, createSilentWav(totalDuration(n) + 1));
  }

  // Calcular duración real del audio para ajustar la duración de cada frame
  let voiceDuration = null;
  if (audioBuffer && Buffer.isBuffer(audioBuffer) && audioBuffer.length > 0) {
    voiceDuration = await getAudioDuration(audioPath);
    console.log(`[build-reel] Audio duration: ${voiceDuration?.toFixed(2) ?? 'unknown'}s`);
  }

  // Frame duration dinámico: si el audio es más largo que el video por defecto, extender
  // Agrega 1s de padding al final para que el audio no se corte
  const targetVideoDuration = voiceDuration ? voiceDuration + 1.0 : totalDuration(n);
  const frameDuration = Math.max(FRAME_DURATION, targetVideoDuration / n);
  console.log(`[build-reel] frameDuration=${frameDuration.toFixed(2)}s targetVideo=${targetVideoDuration.toFixed(2)}s`);

  // Música de fondo opcional
  let musicPath = null;
  if (musicBuffer && Buffer.isBuffer(musicBuffer) && musicBuffer.length > 0) {
    musicPath = path.join(dir, `music.${musicExt}`);
    await fs.writeFile(musicPath, musicBuffer);
  }

  await new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Inputs: frames con duración dinámica
    paths.forEach((p) => {
      cmd.input(p).inputOptions(['-loop', '1', '-t', String(frameDuration)]);
    });

    // Input de audio (voz o silencio)
    cmd.input(audioPath);

    // Input de música de fondo (si existe), con stream_loop para que se repita
    if (musicPath) {
      cmd.input(musicPath).inputOptions(['-stream_loop', '-1']);
    }

    // Filter video
    const videoFilter = buildFilter(n, frameDuration);

    // Filter audio: mezclar voz + música si hay música
    const audioIdx = n;       // índice del input de voz
    const musicIdx = n + 1;   // índice del input de música

    let fullFilter;
    let audioMap;
    if (musicPath) {
      // Voz al 100%, música al 12%. amix duration=first → termina con la voz
      const audioFilter = `[${audioIdx}:a]apad=whole_dur=${Math.ceil(targetVideoDuration + 2)}[vpadded];` +
                          `[${musicIdx}:a]volume=0.12[musicvol];` +
                          `[vpadded][musicvol]amix=inputs=2:duration=first[aout]`;
      fullFilter = videoFilter + ';' + audioFilter;
      audioMap = '[aout]';
    } else {
      fullFilter = videoFilter;
      audioMap = `${audioIdx}:a`;
    }

    cmd.complexFilter(fullFilter)
       .outputOptions([
         '-map', '[vout]',
         '-map', audioMap,
         '-c:v', 'libx264',
         '-pix_fmt', 'yuv420p',
         '-b:v', VIDEO_BITRATE,
         '-r', String(FRAME_RATE),
         '-c:a', 'aac',
         '-b:a', '128k',
         '-movflags', '+faststart',
         // Sin -shortest: el video dura exactamente targetVideoDuration (ya calculado para cubrir el audio)
       ])
       .on('start', (cl) => console.log('[ffmpeg start]', cl))
       .on('stderr', (line) => { if (process.env.FFMPEG_VERBOSE) console.log('[ffmpeg]', line); })
       .on('error', reject)
       .on('end', resolve)
       .save(outputPath);
  });

  const buffer = await fs.readFile(outputPath);
  // Cleanup tmp dir (best-effort)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});

  return { buffer, sizeBytes: buffer.length, duration: targetVideoDuration };
}

module.exports = { buildReel };
