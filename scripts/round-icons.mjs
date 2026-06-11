/**
 * Genera todos los íconos de public/icons/ a partir de logo.PNG:
 * - Fondo negro (#000) — coincide con la imagen fuente
 * - Safe zone de 10% de padding en cada lado
 * - Esquinas redondeadas al estilo iOS/Android squircle
 * - Sombra interior suave (efecto difuminado de borde)
 *
 * Uso: node scripts/round-icons.mjs
 */

import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const SOURCE      = path.join(__dirname, '../public/icons/logo.PNG');
const ICONS_DIR   = path.join(__dirname, '../public/icons');

const SIZES         = [72, 96, 128, 144, 152, 192, 384, 512];
const RADIUS_RATIO  = 0.22;  // ~iOS squircle
const PADDING_RATIO = 0.10;  // 10% por lado → logo ocupa 80% del canvas

function roundedMaskSvg(size) {
  const r = Math.round(size * RADIUS_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>` +
    `</svg>`
  );
}

function innerShadowSvg(size) {
  const r    = Math.round(size * RADIUS_RATIO);
  const blur = Math.round(size * 0.04);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<defs>` +
    `  <filter id="f">` +
    `    <feFlood flood-color="rgba(0,0,0,0.30)"/>` +
    `    <feComposite in2="SourceGraphic" operator="out"/>` +
    `    <feGaussianBlur stdDeviation="${blur}"/>` +
    `    <feComposite in2="SourceGraphic" operator="atop"/>` +
    `  </filter>` +
    `</defs>` +
    `<rect width="${size}" height="${size}" rx="${r}" ry="${r}"` +
    `  fill="transparent" filter="url(#f)"/>` +
    `</svg>`
  );
}

async function generateIcon(size) {
  const pad       = Math.round(size * PADDING_RATIO);
  const innerSize = size - pad * 2;

  // 1. Redimensionar el logo fuente al área interior
  const logoResized = await sharp(SOURCE)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();

  // 2. Pegar el logo sobre un canvas negro del tamaño final
  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: logoResized, top: pad, left: pad }])
    .png()
    .toBuffer();

  // 3. Recortar esquinas → transparente (quita el cuadro)
  const rounded = await sharp(canvas)
    .composite([{ input: roundedMaskSvg(size), blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 4. Sombra interior difuminada
  const final = await sharp(rounded)
    .composite([{ input: innerShadowSvg(size), blend: 'over' }])
    .png()
    .toBuffer();

  const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
  await writeFile(outPath, final);

  const kb = (final.length / 1024).toFixed(1);
  console.log(`✓  icon-${size}.png  (${size}×${size}, pad=${pad}px, ${kb} KB)`);
}

console.log(`Fuente: logo.PNG\nGenerando ${SIZES.length} íconos...\n`);
for (const size of SIZES) {
  await generateIcon(size);
}
console.log('\n¡Listo!');
