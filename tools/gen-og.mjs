// Rendert tools/og-image.svg -> og-image.png (1200×630) für Link-Vorschauen (Open Graph).
// Einmalig ausführen:  npm install --no-save sharp && node tools/gen-og.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('„sharp" fehlt. Bitte: npm install --no-save sharp');
  process.exit(1);
}

const svg = await readFile(join(root, 'tools', 'og-image.svg'));
const png = await sharp(svg, { density: 144 })
  .resize(1200, 630)   // exakt OG-Maße
  .png()
  .toBuffer();
await writeFile(join(root, 'og-image.png'), png);
console.log('✓ og-image.png (1200×630)');
