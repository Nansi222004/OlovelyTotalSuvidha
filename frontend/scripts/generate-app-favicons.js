import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const apps = [
  { name: 'user', file: 'user_logo.jpg' },
  { name: 'seller', file: 'seller_logo.jpg' },
  { name: 'delivery', file: 'delivery_logo.jpg' }
];

async function generateFaviconForApp(appName, sourceFileName) {
  const sourcePath = path.join(rootDir, 'assets', sourceFileName);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const trimmed = await sharp(sourcePath).trim().toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();

  const size = 512;
  const padding = 36;
  const targetW = size - padding * 2;
  const targetH = size - padding * 2;

  const resized = await sharp(trimmed)
    .resize(targetW, targetH, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .toBuffer();

  const resizedMeta = await sharp(resized).metadata();
  const left = Math.round((size - (resizedMeta.width || targetW)) / 2);
  const top = Math.round((size - (resizedMeta.height || targetH)) / 2);

  const squircleSvg = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="100" fill="#ffffff"/>
    </svg>
  `);

  const baseImage = await sharp(squircleSvg)
    .composite([{ input: resized, top, left }])
    .png()
    .toBuffer();

  const targets = [
    path.join(rootDir, 'public', 'assets'),
    path.join(rootDir, 'assets')
  ];

  for (const targetDir of targets) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await sharp(baseImage).resize(512, 512).toFile(path.join(targetDir, `favicon-${appName}.png`));
    await sharp(baseImage).resize(192, 192).toFile(path.join(targetDir, `favicon-${appName}-192.png`));
    await sharp(baseImage).resize(48, 48).toFile(path.join(targetDir, `favicon-${appName}-48.png`));
    await sharp(baseImage).resize(32, 32).toFile(path.join(targetDir, `favicon-${appName}-32.png`));
    await sharp(baseImage).resize(16, 16).toFile(path.join(targetDir, `favicon-${appName}-16.png`));
    await sharp(baseImage).resize(32, 32).toFile(path.join(targetDir, `favicon-${appName}.ico`));
  }

  console.log(`✓ Generated favicons for ${appName} (${sourceFileName})`);
}

async function run() {
  for (const app of apps) {
    await generateFaviconForApp(app.name, app.file);
  }
  console.log('✓ All app-specific favicons generated successfully!');
}

run().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
