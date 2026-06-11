// Genera public/icons/favicon.ico a partir de public/icons/logo.PNG
// Formato: ICO con PNG embebido (soportado desde Windows Vista / todos los navegadores modernos)
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'public/icons/logo.PNG');
const out = resolve(root, 'public/icons/favicon.ico');

// Generar PNG de 32x32 (tamaño estándar de favicon)
const png32 = await sharp(src)
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// Construir ICO con PNG embebido (ICO type 1, 1 imagen)
const headerSize = 6;
const dirEntrySize = 16;
const dataOffset = headerSize + dirEntrySize;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);           // reserved
header.writeUInt16LE(1, 2);           // type = ICO
header.writeUInt16LE(1, 4);           // número de imágenes = 1

const dirEntry = Buffer.alloc(dirEntrySize);
dirEntry.writeUInt8(32, 0);           // ancho
dirEntry.writeUInt8(32, 1);           // alto
dirEntry.writeUInt8(0, 2);            // colores en paleta (0 = truecolor)
dirEntry.writeUInt8(0, 3);            // reserved
dirEntry.writeUInt16LE(1, 4);         // planes de color
dirEntry.writeUInt16LE(32, 6);        // bits por pixel
dirEntry.writeUInt32LE(png32.length, 8);   // tamaño del PNG
dirEntry.writeUInt32LE(dataOffset, 12);    // offset al PNG

const ico = Buffer.concat([header, dirEntry, png32]);
writeFileSync(out, ico);

console.log(`✓ favicon.ico generado en public/icons/ (${ico.length} bytes)`);
