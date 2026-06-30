// Generiert die PNG-App-Icons aus icons/icon.svg.
// Einmalig ausführen (Node 18+):  npx --yes sharp-cli ...  ODER:  node tools/gen-icons.mjs
// Benötigt das Paket "sharp" (nur als Dev-Tool, nicht zur Laufzeit der App).
//   npm install --no-save sharp && node tools/gen-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'icons');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('„sharp" ist nicht installiert. Bitte ausführen: npm install --no-save sharp');
  process.exit(1);
}

const svg = await readFile(join(iconsDir, 'icon.svg'));

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 29, g: 78, b: 216, alpha: 1 } })
    .png()
    .toBuffer();
  await writeFile(join(iconsDir, file), png);
  console.log('✓', file, `(${size}×${size})`);
}
console.log('Fertig.');
