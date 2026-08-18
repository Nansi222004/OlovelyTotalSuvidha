import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function createFaviconWithBg() {
  const logoPath = path.join(rootDir, 'public', 'assets', 'olovelylogo_transparent.png');
  
  // Trim transparent padding from the logo so the actual emblem/text fills the icon
  const trimmedLogoBuffer = await sharp(logoPath)
    .trim()
    .toBuffer();

  const trimmedMeta = await sharp(trimmedLogoBuffer).metadata();
  console.log('Trimmed logo metadata:', trimmedMeta);

  const size = 512;
  const padding = 32; // Slight padding so the logo stays well inside the circle
  const targetWidth = size - padding * 2;
  const targetHeight = size - padding * 2;

  // Resize trimmed logo to fit into target area maintaining aspect ratio
  const resizedLogo = await sharp(trimmedLogoBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  const resizedMeta = await sharp(resizedLogo).metadata();
  const left = Math.round((size - (resizedMeta.width || targetWidth)) / 2);
  const top = Math.round((size - (resizedMeta.height || targetHeight)) / 2);

  // Create a clean solid white circle SVG
  const circleSvg = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${(size/2)}" fill="#ffffff"/>
    </svg>
  `);

  // Composite: Solid white circle + centered logo
  const circleFavicon = await sharp(circleSvg)
    .composite([
      {
        input: resizedLogo,
        top: top,
        left: left
      }
    ])
    .png()
    .toBuffer();

  // Create a clean solid white rounded squircle SVG (great for app icons)
  const squircleSvg = Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="115" fill="#ffffff"/>
    </svg>
  `);

  const squircleFavicon = await sharp(squircleSvg)
    .composite([
      {
        input: resizedLogo,
        top: top,
        left: left
      }
    ])
    .png()
    .toBuffer();

  // Save to public assets and public root
  const publicDir = path.join(rootDir, 'public');
  const publicAssetsDir = path.join(publicDir, 'assets');

  // Let's save circular and squircle versions
  await sharp(circleFavicon).resize(512, 512).toFile(path.join(publicAssetsDir, 'favicon-circle.png'));
  await sharp(circleFavicon).resize(192, 192).toFile(path.join(publicAssetsDir, 'favicon-circle-192.png'));
  await sharp(circleFavicon).resize(64, 64).toFile(path.join(publicAssetsDir, 'favicon-circle-64.png'));
  await sharp(circleFavicon).resize(32, 32).toFile(path.join(publicAssetsDir, 'favicon-circle-32.png'));

  // Also save as primary favicon.png, favicon.ico, and logo files
  await sharp(circleFavicon).resize(192, 192).toFile(path.join(publicDir, 'favicon.png'));
  await sharp(circleFavicon).resize(192, 192).toFile(path.join(publicDir, 'favicon.ico'));
  await sharp(circleFavicon).resize(192, 192).toFile(path.join(publicDir, 'logo192.png'));
  await sharp(circleFavicon).resize(512, 512).toFile(path.join(publicDir, 'logo512.png'));

  // Also save squircle version for options
  await sharp(squircleFavicon).resize(512, 512).toFile(path.join(publicAssetsDir, 'favicon-squircle.png'));

  console.log('✓ Successfully generated high-contrast favicon with white background!');
}

createFaviconWithBg().catch(console.error);
